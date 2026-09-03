import { db, getSetting, setSetting } from './db.js'
import { broadcast } from './events.js'
import { allAlarms, findAlarm, saveAlarm } from './store.js'
import type { DeliveryStatus } from './types.js'

/**
 * Echte Push-Nachrichten über den Expo-Push-Dienst.
 * Voraussetzung ist ein eigener App-Build (TestFlight/App Store) – Expo Go kann
 * seit SDK 53 keine Remote-Push-Nachrichten mehr empfangen.
 */
const EXPO_PUSH_URL = process.env.SOBE_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS_URL = process.env.SOBE_PUSH_RECEIPTS_URL ?? 'https://exp.host/--/api/v2/push/getReceipts'

export function registerPushToken(userId: string, token: string, platform = 'ios', criticalAlerts = false): void {
  db.prepare(`
    INSERT INTO push_tokens (token, userId, platform, updatedAt, criticalAlerts) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET userId = excluded.userId, platform = excluded.platform,
      updatedAt = excluded.updatedAt, criticalAlerts = excluded.criticalAlerts
  `).run(token, userId, platform, Date.now(), criticalAlerts ? 1 : 0)
}

export function removePushToken(token: string): void {
  db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token)
}

export interface PushZiel {
  token: string
  userId: string
  /** Gerät darf Alarme auch bei stummem Telefon hörbar machen */
  criticalAlerts: boolean
}

/** Geräte pro Person – für die Bereitschaftsübersicht */
export function geraeteProPerson(): Map<string, { geraete: number; critical: boolean }> {
  const zeilen = db
    .prepare('SELECT userId, COUNT(*) AS geraete, MAX(criticalAlerts) AS critical FROM push_tokens GROUP BY userId')
    .all() as { userId: string; geraete: number; critical: number }[]
  return new Map(zeilen.map((z) => [z.userId, { geraete: z.geraete, critical: Boolean(z.critical) }]))
}

/**
 * Zustellstatus einer Person für den Push-Kanal setzen. «sent» heisst: Expo hat
 * die Nachricht angenommen, «delivered»: das Gerät hat sie erhalten (Quittung).
 */
export function markierePushZustellung(alarmId: string, userId: string, status: DeliveryStatus): boolean {
  const alarm = findAlarm(alarmId)
  if (!alarm) return false
  let veraendert = false
  const deliveries = alarm.deliveries.map((d) => {
    if (d.userId !== userId || d.channel !== 'push') return d
    // Eine bestätigte Zustellung wird nicht mehr zurückgestuft
    if (d.status === 'delivered' && status !== 'delivered') return d
    if (d.status === status) return d
    veraendert = true
    return { ...d, status, updatedAt: Date.now() }
  })
  if (veraendert) saveAlarm({ ...alarm, deliveries })
  return veraendert
}

/** Alle Push-Zustellungen eines Alarms, für die kein Gerät bekannt ist, als fehlgeschlagen markieren */
export function markiereOhneGeraet(alarmId: string, userIds: string[]): void {
  const mitGeraet = new Set(tokensForUsers(userIds).map((z) => z.userId))
  let veraendert = false
  for (const id of userIds) {
    if (!mitGeraet.has(id) && markierePushZustellung(alarmId, id, 'failed')) veraendert = true
  }
  if (veraendert) broadcast('state')
}

export function tokensForUsers(userIds: string[]): PushZiel[] {
  if (userIds.length === 0) return []
  const platzhalter = userIds.map(() => '?').join(',')
  const zeilen = db
    .prepare(`SELECT token, userId, criticalAlerts FROM push_tokens WHERE userId IN (${platzhalter})`)
    .all(...userIds) as { token: string; userId: string; criticalAlerts: number }[]
  return zeilen.map((r) => ({ token: r.token, userId: r.userId, criticalAlerts: Boolean(r.criticalAlerts) }))
}

export interface PushNachricht {
  title: string
  body: string
  data?: Record<string, unknown>
  /**
   * Nicht stiller Alarm: Ton auch bei stummgeschaltetem Telefon.
   * Geräte ohne bewilligte Critical-Alert-Berechtigung erhalten stattdessen
   * «time-sensitive» – das durchbricht immerhin Fokus-Modi.
   */
  critical?: boolean
  /**
   * Stiller Alarm: Die Mitteilung kommt an und erscheint auf dem Sperrbildschirm,
   * aber ohne Ton und ohne Vibration – niemand soll auf sich aufmerksam machen.
   */
  silent?: boolean
  /** Ohne Alarmton, aber wichtig genug, um Fokus-Modi zu durchbrechen (z. B. Entwarnung) */
  wichtig?: boolean
}

/**
 * Android-Kanäle – die App legt sie beim Start an. «Alarme» läuft über den
 * Alarm-Audiokanal (klingt wie ein Wecker auch bei Lautlos), «still» bleibt
 * lautlos. Die Ids müssen mit der App übereinstimmen (notifications.ts);
 * «-v2», weil Android Kanal-Einstellungen nach dem Anlegen einfriert.
 */
export const KANAL_ALARM = 'alarme-v2'
export const KANAL_STILL = 'alarme-still-v2'

/**
 * Zahl auf dem App-Symbol: wie viele laufende Alarme eine Person betreffen.
 * Wird jeder Push-Nachricht mitgegeben, damit das Symbol auch dann stimmt,
 * wenn die App geschlossen ist – die Entwarnung zählt sie wieder herunter.
 */
export function offeneAlarmeProPerson(userIds: string[]): Map<string, number> {
  const zaehler = new Map<string, number>(userIds.map((id) => [id, 0]))
  for (const alarm of allAlarms()) {
    if (alarm.status !== 'active') continue
    const betroffen = new Set(alarm.deliveries.map((d) => d.userId))
    betroffen.add(alarm.triggeredByUserId)
    for (const id of betroffen) {
      const bisher = zaehler.get(id)
      if (bisher !== undefined) zaehler.set(id, bisher + 1)
    }
  }
  return zaehler
}

/**
 * Versand an alle Geräte der genannten Personen. Fehler werden protokolliert,
 * aber nie weitergereicht: Ein nicht erreichbarer Push-Dienst darf die
 * Alarmauslösung nicht verhindern.
 */
export async function sendPush(userIds: string[], nachricht: PushNachricht): Promise<number> {
  const ziele = tokensForUsers(userIds)
  if (ziele.length === 0) return 0

  const abzeichen = offeneAlarmeProPerson(userIds)
  const nachrichten = ziele.map((ziel) => ({
    to: ziel.token,
    title: nachricht.title,
    body: nachricht.body,
    data: nachricht.data ?? {},
    // Stiller Alarm: kein Ton – auf iOS entfällt damit auch die Vibration
    sound: nachricht.silent ? null : 'default',
    priority: 'high',
    channelId: nachricht.silent ? KANAL_STILL : KANAL_ALARM,
    // Zahl auf dem App-Symbol (iOS; Android zeigt je nach Launcher Punkt oder Zahl)
    badge: abzeichen.get(ziel.userId) ?? 0,
    // Critical Alert nur an Geräte, die ihn tatsächlich dürfen – sonst lehnt
    // Apple die Nachricht ab. Ohne Bewilligung bleibt «time-sensitive».
    // Ein stiller Alarm bleibt «time-sensitive»: sichtbar trotz Fokus, aber lautlos.
    interruptionLevel: nachricht.critical && !nachricht.silent
      ? (ziel.criticalAlerts ? 'critical' : 'time-sensitive')
      : nachricht.silent || nachricht.wichtig ? 'time-sensitive' : 'active',
    // Ein Alarm, der eine Stunde später eintrifft, hilft niemandem mehr
    ttl: nachricht.critical || nachricht.silent ? 3600 : undefined,
  }))

  try {
    const antwort = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(nachrichten),
    })
    if (!antwort.ok) {
      console.warn('[push] Expo antwortete mit', antwort.status)
      return 0
    }
    const ergebnis = (await antwort.json()) as { data?: { status: string; id?: string; details?: { error?: string } }[] }
    const alarmId = typeof nachricht.data?.alarmId === 'string' ? nachricht.data.alarmId : null
    const ticket = db.prepare('INSERT OR REPLACE INTO push_tickets (id, token, userId, alarmId, createdAt) VALUES (?, ?, ?, ?, ?)')
    let zustellungVeraendert = false
    ergebnis.data?.forEach((eintrag, i) => {
      const ziel = ziele[i]
      if (!ziel) return
      if (eintrag.status === 'ok') {
        // Angenommen – die Quittung kommt später (siehe pruefeEmpfangsbestaetigungen)
        if (alarmId && eintrag.id) {
          ticket.run(eintrag.id, ziel.token, ziel.userId, alarmId, Date.now())
          if (markierePushZustellung(alarmId, ziel.userId, 'sent')) zustellungVeraendert = true
        }
        return
      }
      // Von Expo abgelehnte Tokens (App deinstalliert) entfernen
      if (eintrag.details?.error === 'DeviceNotRegistered') removePushToken(ziel.token)
      if (alarmId && markierePushZustellung(alarmId, ziel.userId, 'failed')) zustellungVeraendert = true
    })
    if (zustellungVeraendert) broadcast('state')
    zuletztErreichbar = { ok: true, geprueft: Date.now() }
    return ziele.length
  } catch (fehler) {
    console.warn('[push] Versand fehlgeschlagen:', (fehler as Error).message)
    return 0
  }
}

// ---------- Empfangsbestätigungen ----------

/** Zustand des Push-Dienstes, wie zuletzt beobachtet */
let zuletztErreichbar: { ok: boolean; geprueft: number } | null = null

export function pushDienstStatus(): { ok: boolean; geprueft: number } | null {
  return zuletztErreichbar
}

/** Erreichbarkeit des Push-Dienstes prüfen, ohne jemandem eine Nachricht zu schicken */
export async function pruefePushDienst(): Promise<boolean> {
  try {
    const antwort = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })
    zuletztErreichbar = { ok: antwort.ok, geprueft: Date.now() }
  } catch {
    zuletztErreichbar = { ok: false, geprueft: Date.now() }
  }
  return zuletztErreichbar.ok
}

/** Tickets, deren Quittung noch aussteht – frühestens nach einer kurzen Wartezeit */
interface Ticket { id: string; token: string; userId: string; alarmId: string; createdAt: number }

/**
 * Quittungen bei Expo abholen: «ok» heisst, das Gerät hat die Nachricht
 * erhalten – erst dann gilt sie in der Alarmzentrale als zugestellt.
 * Tickets ohne Quittung werden nach einem Tag aufgegeben.
 */
export async function pruefeEmpfangsbestaetigungen(): Promise<number> {
  const jetzt = Date.now()
  db.prepare('DELETE FROM push_tickets WHERE createdAt < ?').run(jetzt - 24 * 3600_000)
  const offen = db
    .prepare('SELECT * FROM push_tickets WHERE createdAt < ? ORDER BY createdAt LIMIT 300')
    .all(jetzt - 15_000) as Ticket[]
  if (offen.length === 0) return 0

  let quittungen: Record<string, { status: string; details?: { error?: string } }>
  try {
    const antwort = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids: offen.map((t) => t.id) }),
    })
    zuletztErreichbar = { ok: antwort.ok, geprueft: Date.now() }
    if (!antwort.ok) return 0
    quittungen = ((await antwort.json()) as { data?: typeof quittungen }).data ?? {}
  } catch {
    zuletztErreichbar = { ok: false, geprueft: Date.now() }
    return 0
  }

  const loeschen = db.prepare('DELETE FROM push_tickets WHERE id = ?')
  let veraendert = false
  let erledigt = 0
  for (const ticket of offen) {
    const q = quittungen[ticket.id]
    if (!q) continue // noch keine Quittung – später erneut
    if (q.status === 'ok') {
      if (markierePushZustellung(ticket.alarmId, ticket.userId, 'delivered')) veraendert = true
    } else {
      if (q.details?.error === 'DeviceNotRegistered') removePushToken(ticket.token)
      if (markierePushZustellung(ticket.alarmId, ticket.userId, 'failed')) veraendert = true
    }
    loeschen.run(ticket.id)
    erledigt++
  }
  if (veraendert) broadcast('state')
  return erledigt
}

/** Zeitpunkt der letzten Testmeldung an die Administration */
export function letzterTestpush(): number | null {
  const wert = getSetting('letzterTestpush')
  return wert ? Number(wert) : null
}

export function merkeTestpush(ts = Date.now()): void {
  setSetting('letzterTestpush', String(ts))
}
