import { randomBytes, timingSafeEqual } from 'node:crypto'
import { db, getSetting, setSetting } from './db.js'
import { broadcast } from './events.js'
import { addAudit } from './store.js'
import type { RedundanzConfig, RedundanzStatus, ServerInfo } from './types.js'

/**
 * Redundanz: Ein zweiter Alarmserver (Standby) spiegelt den Datenbestand des
 * Hauptservers (Primary) und übernimmt, wenn dieser ausfällt.
 *
 * Funktionsweise:
 * - Beide Instanzen laufen mit identischem Stand der Software; im Portal wird
 *   pro Instanz die Rolle, die Adresse des Partners und ein gemeinsames
 *   Geheimnis hinterlegt.
 * - Der Standby holt sich in kurzen Abständen einen vollständigen Abzug der
 *   Datenbank des Primary (inklusive Konten, Sitzungen und Push-Token – damit
 *   angemeldete Geräte beim Ausweichen angemeldet bleiben).
 * - Solange der Abgleich läuft, bleibt der Standby passiv: Seine Alarm-Engine
 *   (Eskalationen, Alleinarbeits-Timer, Testmeldungen) ist angehalten, sonst
 *   würden beide Server dieselben SMS und Pushes doppelt versenden.
 * - Bleibt der Primary länger als die Karenzzeit unerreichbar, übernimmt der
 *   Standby (Failover): Engine an, Alarme können ausgelöst und verarbeitet
 *   werden. Kommt der Primary zurück, meldet der Standby dort ausgelöste
 *   Alarme, Protokolleinträge und Alleinarbeits-Timer an ihn zurück und wird
 *   wieder passiv.
 *
 * Die eigene Redundanz-Konfiguration (Rolle, Partner, Geheimnis) wird bewusst
 * NIE repliziert – sie beschreibt die Instanz, nicht den Datenbestand.
 */

const CONFIG_KEY = 'redundanz'

/** Reihenfolge beachten: users zuerst, darauf verweisen sessions/push_tokens/presence */
const TABELLEN = [
  'users', 'groups', 'locations', 'scenarios', 'plans', 'contacts', 'buttons',
  'alarms', 'lone_work', 'audit', 'sessions', 'push_tokens', 'presence',
] as const
type Tabelle = (typeof TABELLEN)[number]

/** Diese Tabellen darf der Standby im Failover verändern – Extras bleiben erhalten und gehen zurück an den Primary */
const RUECKMELDE_TABELLEN: Tabelle[] = ['alarms', 'lone_work', 'audit']

/** Einstellungs-Schlüssel, die zur Instanz gehören und nie repliziert werden */
const INSTANZ_SCHLUESSEL = new Set([CONFIG_KEY])

type Zeile = Record<string, unknown>

export interface Abzug {
  v: 1
  exportedAt: number
  tabellen: Partial<Record<Tabelle, Zeile[]>>
  settings: { key: string; value: string }[]
}

// ---------- Konfiguration ----------

const VORGABE: RedundanzConfig = { enabled: false, role: 'primary', peerUrl: '', secret: '', intervalS: 30 }

export function redundanzConfig(): RedundanzConfig {
  const roh = JSON.parse(getSetting(CONFIG_KEY) ?? '{}') as Partial<RedundanzConfig>
  const cfg = { ...VORGABE, ...roh }
  cfg.intervalS = Math.min(600, Math.max(10, Number(cfg.intervalS) || 30))
  cfg.peerUrl = String(cfg.peerUrl ?? '').trim().replace(/\/+$/, '')
  return cfg
}

export function speichereRedundanz(cfg: RedundanzConfig): void {
  setSetting(CONFIG_KEY, JSON.stringify(cfg))
  starteReplikation()
}

export function neuesRedundanzGeheimnis(): string {
  return `rd_${randomBytes(24).toString('hex')}`
}

/** Zugriffsschutz der Replikations-Endpunkte: Bearer-Vergleich in konstanter Zeit */
export function replikationsZugriffErlaubt(authHeader: string | undefined): boolean {
  const cfg = redundanzConfig()
  if (!cfg.enabled || !cfg.secret) return false
  const token = (authHeader ?? '').startsWith('Bearer ') ? (authHeader ?? '').slice(7) : ''
  const a = Buffer.from(token)
  const b = Buffer.from(cfg.secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ---------- Laufender Zustand ----------

let lastSyncAt: number | null = null
let lastSyncOk: boolean | null = null
let lastSyncError: string | null = null
let lastOkAt: number | null = null
let failoverAktiv = false
let schleifenStart = 0
let timer: NodeJS.Timeout | null = null

export function redundanzStatus(): RedundanzStatus {
  return { lastSyncAt, lastSyncOk, lastSyncError, failoverAktiv }
}

/**
 * Passiv heisst: Dieser Server ist Standby, der Primary lebt – Eskalationen,
 * Timer-Überwachung und automatische Meldungen übernimmt der Primary.
 */
export function standbyPassiv(): boolean {
  const cfg = redundanzConfig()
  return cfg.enabled && cfg.role === 'standby' && !failoverAktiv
}

/** Auskunft für die Clients – die App merkt sich die Ausweichadresse */
export function serverInfo(): ServerInfo {
  const cfg = redundanzConfig()
  if (!cfg.enabled) return { rolle: null, fallbackUrl: null, failover: false }
  return { rolle: cfg.role, fallbackUrl: cfg.peerUrl || null, failover: failoverAktiv }
}

// ---------- Abzug erzeugen (dient dem Partner als Quelle) ----------

export function erzeugeAbzug(): Abzug {
  const tabellen: Partial<Record<Tabelle, Zeile[]>> = {}
  for (const t of TABELLEN) {
    tabellen[t] = db.prepare(`SELECT * FROM ${t}`).all() as Zeile[]
  }
  const settings = (db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[])
    .filter((s) => !INSTANZ_SCHLUESSEL.has(s.key))
  return { v: 1, exportedAt: Date.now(), tabellen, settings }
}

// ---------- Abzug übernehmen (Standby) ----------

function spalten(tabelle: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tabelle})`).all() as { name: string }[]).map((c) => c.name)
}

function einfuegen(tabelle: string, zeilen: Zeile[], oderIgnorieren = false): void {
  if (zeilen.length === 0) return
  const lokal = spalten(tabelle)
  for (const zeile of zeilen) {
    const felder = Object.keys(zeile).filter((k) => lokal.includes(k))
    if (felder.length === 0) continue
    db.prepare(
      `INSERT ${oderIgnorieren ? 'OR IGNORE ' : ''}INTO ${tabelle} (${felder.join(', ')}) VALUES (${felder.map(() => '?').join(', ')})`,
    ).run(...felder.map((f) => (zeile[f] === undefined ? null : (zeile[f] as never))))
  }
}

/**
 * Zeilen, die es nur lokal gibt (z. B. ein während des Failovers ausgelöster
 * Alarm). Sie überleben die Übernahme des Abzugs und werden dem Primary
 * zurückgemeldet, bis er sie selbst führt.
 */
function lokaleExtras(abzug: Abzug): Partial<Record<Tabelle, Zeile[]>> {
  const extras: Partial<Record<Tabelle, Zeile[]>> = {}
  for (const t of RUECKMELDE_TABELLEN) {
    const bekannt = new Set((abzug.tabellen[t] ?? []).map((z) => String(z.id)))
    const eigene = (db.prepare(`SELECT * FROM ${t}`).all() as Zeile[]).filter((z) => !bekannt.has(String(z.id)))
    if (eigene.length > 0) extras[t] = eigene
  }
  return extras
}

export function uebernehmeAbzug(abzug: Abzug): void {
  const extras = lokaleExtras(abzug)
  // Fremdschlüssel während des Austauschs aus – die Reihenfolge der Tabellen
  // stimmt zwar, aber ein Teilzustand während der Transaktion soll nie scheitern
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      for (const t of [...TABELLEN].reverse()) db.prepare(`DELETE FROM ${t}`).run()
      for (const t of TABELLEN) einfuegen(t, abzug.tabellen[t] ?? [])
      // Einstellungen spiegeln – nur die Instanz-Schlüssel bleiben lokal
      const gespiegelt = new Set(abzug.settings.map((s) => s.key))
      for (const { key } of db.prepare('SELECT key FROM settings').all() as { key: string }[]) {
        if (!INSTANZ_SCHLUESSEL.has(key) && !gespiegelt.has(key)) db.prepare('DELETE FROM settings WHERE key = ?').run(key)
      }
      for (const s of abzug.settings) {
        if (!INSTANZ_SCHLUESSEL.has(s.key)) setSetting(s.key, s.value)
      }
      for (const [t, zeilen] of Object.entries(extras)) einfuegen(t, zeilen, true)
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

/** Rückmeldung des Standby beim Primary einarbeiten – nur fehlende Zeilen */
export function uebernehmeRueckmeldung(nutzlast: Partial<Record<Tabelle, Zeile[]>>): number {
  let uebernommen = 0
  db.transaction(() => {
    for (const t of RUECKMELDE_TABELLEN) {
      const zeilen = Array.isArray(nutzlast[t]) ? nutzlast[t]! : []
      for (const zeile of zeilen) {
        const vorhanden = db.prepare(`SELECT 1 FROM ${t} WHERE id = ?`).get(String(zeile.id))
        if (vorhanden) continue
        einfuegen(t, [zeile], true)
        uebernommen++
      }
    }
  })()
  return uebernommen
}

// ---------- Abgleich-Schleife (Standby) ----------

async function peerAnfrage(pfad: string, optionen: RequestInit = {}): Promise<Response> {
  const cfg = redundanzConfig()
  const abbruch = new AbortController()
  const frist = setTimeout(() => abbruch.abort(), 15_000)
  try {
    return await fetch(cfg.peerUrl + pfad, {
      ...optionen,
      signal: abbruch.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.secret}`,
        ...(optionen.headers ?? {}),
      },
    })
  } finally {
    clearTimeout(frist)
  }
}

async function abgleichsRunde(): Promise<void> {
  const cfg = redundanzConfig()
  if (!cfg.enabled || cfg.role !== 'standby' || !cfg.peerUrl || !cfg.secret) return
  try {
    const antwort = await peerAnfrage('/api/replikation/abzug')
    if (!antwort.ok) throw new Error(`Partner antwortet mit Status ${antwort.status}`)
    const abzug = (await antwort.json()) as Abzug
    if (abzug.v !== 1 || !abzug.tabellen) throw new Error('Abzug in unbekanntem Format')

    // Während des Failovers Erfasstes zuerst an den Primary zurückmelden
    const extras = lokaleExtras(abzug)
    if (Object.keys(extras).length > 0) {
      const rueck = await peerAnfrage('/api/replikation/rueckmeldung', { method: 'POST', body: JSON.stringify(extras) })
      if (!rueck.ok) throw new Error(`Rückmeldung an den Hauptserver fehlgeschlagen (Status ${rueck.status})`)
    }

    uebernehmeAbzug(abzug)
    lastSyncAt = Date.now()
    lastOkAt = lastSyncAt
    lastSyncOk = true
    lastSyncError = null
    if (failoverAktiv) {
      failoverAktiv = false
      addAudit('system', 'Redundanz: Hauptserver wieder erreichbar – dieser Server ist zurück im Standby-Betrieb. Während des Ausfalls Erfasstes wurde zurückgemeldet.')
    }
    broadcast('state')
  } catch (fehler) {
    lastSyncAt = Date.now()
    lastSyncOk = false
    lastSyncError = (fehler as Error).message
    const karenz = Math.max(90_000, 3 * cfg.intervalS * 1000)
    const seit = lastOkAt ?? schleifenStart
    if (!failoverAktiv && Date.now() - seit > karenz) {
      failoverAktiv = true
      addAudit('system', `Redundanz: Hauptserver unter ${cfg.peerUrl} nicht erreichbar – dieser Standby-Server übernimmt die Alarmverarbeitung.`)
      broadcast('state')
    }
  }
}

/** Beim Start und nach jeder Konfigurationsänderung (neu) aufsetzen */
export function starteReplikation(): void {
  if (timer) clearInterval(timer)
  timer = null
  const cfg = redundanzConfig()
  if (!cfg.enabled || cfg.role !== 'standby') {
    failoverAktiv = false
    return
  }
  schleifenStart = Date.now()
  lastOkAt = null
  void abgleichsRunde()
  timer = setInterval(() => void abgleichsRunde(), cfg.intervalS * 1000)
}

/** Erreichbarkeit des Partners – für die Statusanzeige im Portal */
export async function peerErreichbar(): Promise<boolean | null> {
  const cfg = redundanzConfig()
  if (!cfg.enabled || !cfg.peerUrl) return null
  try {
    const abbruch = new AbortController()
    const frist = setTimeout(() => abbruch.abort(), 4000)
    const antwort = await fetch(`${cfg.peerUrl}/api/health`, { signal: abbruch.signal })
    clearTimeout(frist)
    return antwort.ok
  } catch {
    return false
  }
}
