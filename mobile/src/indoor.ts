import { useEffect, useState } from 'react'
import { AppState, PermissionsAndroid, Platform } from 'react-native'
import * as Location from 'expo-location'
import MeridianIndoor from '../modules/meridian-indoor'
import { api, authToken } from './api'
import type { IndoorPosition } from './types'

/**
 * Indoor-Ortung über Aruba Meridian.
 *
 * Die Access Points senden Bluetooth-Beacons; das Meridian-SDK rechnet daraus,
 * auf welchem Stockwerk (Karte) und wo auf dem Grundriss das Telefon ist.
 *
 * Datenschutz: Die Position bleibt auf dem Gerät. Übermittelt wird sie nur mit
 * einem Alarm – beim Auslösen und, solange der eigene Alarm läuft, wenn die
 * Person sich bewegt. So finden Helfende sie auch, wenn sie den Raum wechselt.
 *
 * Geortet wird, solange die App im Vordergrund ist – dort wird ein Alarm
 * ausgelöst – und darüber hinaus nur, solange ein eigener Alarm läuft.
 */

/** Älter darf eine Position beim Auslösen nicht sein – sonst ist die Person vielleicht längst woanders */
const FRISCH_MS = 2 * 60_000
/** Abstand der Nachführungen auf demselben Stockwerk; ein Stockwerkwechsel geht sofort */
const NACHFUEHREN_MS = 10_000

export type IndoorStatus =
  | 'aus' // im Portal nicht eingeschaltet
  | 'nicht-verfuegbar' // App ohne das native Modul (Expo Go, alte Version)
  | 'keine-berechtigung'
  | 'bluetooth-aus'
  | 'sucht'
  | 'aktiv'

export interface IndoorKonfig {
  aktiv: boolean
  region: 'us' | 'eu'
  appId: string
  sdkToken: string
}

let konfig: IndoorKonfig | null = null
let letzteKonfig = ''
let laeuft = false
let position: IndoorPosition | null = null
let status: IndoorStatus = MeridianIndoor ? 'aus' : 'nicht-verfuegbar'
const zuhoerende = new Set<() => void>()

function melde(): void {
  for (const z of zuhoerende) z()
}

function setzeStatus(neu: IndoorStatus): void {
  if (status === neu) return
  status = neu
  melde()
}

/** Letzte Position – nur solange sie frisch genug ist, um etwas auszusagen */
export function aktuellePosition(): IndoorPosition | null {
  return position && Date.now() - position.ermitteltAt <= FRISCH_MS ? position : null
}

/** Position und Zustand für die Anzeige; zeichnet bei jeder neuen Ortung neu */
export function useIndoor(): { position: IndoorPosition | null; status: IndoorStatus } {
  const [, setZaehler] = useState(0)
  useEffect(() => {
    const neu = () => setZaehler((n) => n + 1)
    zuhoerende.add(neu)
    // Ohne neue Ortung soll eine alte Position trotzdem aus der Anzeige verschwinden
    const uhr = setInterval(neu, 30_000)
    return () => {
      zuhoerende.delete(neu)
      clearInterval(uhr)
    }
  }, [])
  return { position: aktuellePosition(), status }
}

// ---------- Nachführung laufender eigener Alarme ----------

interface EigenerAlarm {
  id: string
  /** Zeitpunkt der Position, die der Server schon kennt */
  indoorAt?: number
  indoorMapId?: string
}

let eigeneAlarme: EigenerAlarm[] = []
const gesendet = new Map<string, { at: number; mapId: string }>()

function nachfuehren(): void {
  const p = aktuellePosition()
  if (!p || !authToken()) return
  const jetzt = Date.now()
  for (const a of eigeneAlarme) {
    if (a.indoorAt !== undefined && a.indoorAt >= p.ermitteltAt) continue
    const zuletzt = gesendet.get(a.id)
    const stockwerk = (zuletzt?.mapId ?? a.indoorMapId) !== p.mapId
    if (zuletzt && !stockwerk && jetzt - zuletzt.at < NACHFUEHREN_MS) continue
    gesendet.set(a.id, { at: jetzt, mapId: p.mapId })
    // Scheitert es (Server weg, Alarm eben beendet), versucht es die nächste
    // Ortung frühestens nach NACHFUEHREN_MS erneut
    api.indoorReport(a.id, p).catch(() => {})
  }
}

/**
 * Laufende eigene Alarme übernehmen (bei jedem Datenabgleich). Solange einer
 * läuft, ortet die App auch im Hintergrund weiter, soweit das System sie lässt.
 */
export function verfolgeEigeneAlarme(alarme: EigenerAlarm[]): void {
  const vorher = eigeneAlarme.length
  eigeneAlarme = alarme
  for (const id of [...gesendet.keys()]) if (!alarme.some((a) => a.id === id)) gesendet.delete(id)
  if (vorher === 0 && alarme.length > 0) void starteOderStoppe()
  if (vorher > 0 && alarme.length === 0) void starteOderStoppe()
  nachfuehren()
}

// ---------- Ortung starten und beenden ----------

if (MeridianIndoor) {
  MeridianIndoor.addListener('onLocation', (roh) => {
    if (!roh.mapId || !Number.isFinite(roh.x) || !Number.isFinite(roh.y)) return
    position = {
      mapId: roh.mapId,
      x: roh.x,
      y: roh.y,
      genauigkeitM: Number.isFinite(roh.genauigkeitM) ? roh.genauigkeitM : undefined,
      // Die Zeit des Telefons – kommt vom SDK womöglich in der Zukunft, der Server kappt das
      ermitteltAt: Number.isFinite(roh.ermitteltAt) ? roh.ermitteltAt : Date.now(),
      quelle: roh.quelle,
    }
    status = 'aktiv'
    melde()
    nachfuehren()
  })
  MeridianIndoor.addListener('onError', (fehler) => {
    if (fehler.code === 'bluetooth') setzeStatus('bluetooth-aus')
  })
}

/** Bluetooth-Suche braucht ab Android 12 eine eigene Berechtigung */
async function berechtigungen(): Promise<boolean> {
  const standort = await Location.requestForegroundPermissionsAsync().catch(() => ({ granted: false }))
  if (!standort.granted) return false
  if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
    const scan = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN).catch(() => null)
    if (scan !== PermissionsAndroid.RESULTS.GRANTED) return false
  }
  return true
}

let wechsel: Promise<void> = Promise.resolve()

/** Ortung an Konfiguration, App-Zustand und laufende Alarme anpassen – nacheinander, nie parallel */
function starteOderStoppe(): Promise<void> {
  wechsel = wechsel.then(async () => {
    if (!MeridianIndoor) return
    const soll = Boolean(konfig?.aktiv) && (AppState.currentState === 'active' || eigeneAlarme.length > 0)
    try {
      if (soll && !laeuft) {
        if (!(await berechtigungen())) {
          setzeStatus('keine-berechtigung')
          return
        }
        await MeridianIndoor.configure(konfig!.sdkToken, konfig!.region)
        await MeridianIndoor.start(konfig!.appId)
        laeuft = true
        if (status !== 'aktiv') setzeStatus('sucht')
      } else if (!soll && laeuft) {
        await MeridianIndoor.stop()
        laeuft = false
      }
    } catch {
      laeuft = false
    }
  })
  return wechsel
}

AppState.addEventListener('change', () => {
  if (konfig?.aktiv) void starteOderStoppe()
})

/**
 * Indoor-Ortung mit der Konfiguration des Servers abgleichen. Idempotent – der
 * Aufruf ist bei jedem Datenabgleich unbedenklich.
 */
export async function syncIndoor(neu: IndoorKonfig): Promise<void> {
  const aktiv = neu.aktiv && Boolean(neu.appId && neu.sdkToken)
  const schluessel = aktiv ? JSON.stringify(neu) : ''
  if (schluessel === letzteKonfig) return
  letzteKonfig = schluessel
  const bisher = konfig
  konfig = { ...neu, aktiv }
  if (!MeridianIndoor) return
  // Andere Location-ID oder anderes Token: neu starten
  if (laeuft && bisher && (bisher.appId !== neu.appId || bisher.sdkToken !== neu.sdkToken || bisher.region !== neu.region)) {
    await MeridianIndoor.stop().catch(() => {})
    laeuft = false
  }
  if (!aktiv) {
    position = null
    setzeStatus('aus')
  }
  await starteOderStoppe()
}

/** Abmeldung: Ortung beenden und nichts mehr zurückhalten */
export async function stopIndoor(): Promise<void> {
  await syncIndoor({ aktiv: false, region: 'eu', appId: '', sdkToken: '' })
  eigeneAlarme = []
  gesendet.clear()
}
