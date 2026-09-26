import { useEffect, useState } from 'react'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, authToken, loadApiSettings } from './api'

/**
 * Geofencing: Alarmierung nach Aufenthaltsort.
 *
 * Die App überwacht die im Portal hinterlegten Standort-Geofences und meldet
 * dem Alarmserver beim Betreten oder Verlassen nur den Standort-Namen
 * (locationId) oder null («an keinem erfassten Standort») – nie eine
 * GPS-Position. Der Server alarmiert damit zusätzlich die Personen, die sich
 * gerade an einem alarmierten Standort aufhalten; ohne aktuelle Meldung gilt
 * weiterhin der Profilstandort.
 */

export const GEOFENCE_TASK = 'sobe-geofence'

export interface GeofenceRegion {
  id: string
  lat: number
  lng: number
  radiusM: number
  /** Umriss des Standorts; ohne ihn gilt der Kreis */
  punkte?: { lat: number; lng: number }[]
}

/** Regionen, in denen sich das Gerät laut den letzten Ereignissen befindet */
const innerhalb = new Set<string>()

/**
 * Zuletzt festgestellter Aufenthaltsort – derselbe Wert, den die App dem
 * Alarmserver meldet.
 *
 * null bedeutet «kein erfasster Standort oder noch nicht bestimmt». Für die
 * Anzeige und für ausgelöste Alarme gilt dann – genau wie auf dem Server – der
 * Profilstandort.
 */
const AUFENTHALT_KEY = 'sonnenberg-geofence-aufenthalt-v1'
let aufenthalt: string | null = null
const zuhoerende = new Set<(id: string | null) => void>()

function setzeAufenthalt(id: string | null, vonHand = false): void {
  // Eine Handkorrektur hat Vorrang: Sie wurde bewusst gesetzt, weil die
  // Ortung danebenlag. Sonst käme das nächste Geofence-Ereignis und
  // überschriebe sie sofort wieder.
  if (!vonHand && handkorrekturAktiv()) return
  if (aufenthalt === id) return
  aufenthalt = id
  AsyncStorage.setItem(AUFENTHALT_KEY, id ?? '').catch(() => {})
  for (const melde of zuhoerende) melde(id)
}

/**
 * Aufenthalt von Hand richtigstellen.
 *
 * Die Ortung liegt manchmal daneben: zwischen zwei Gebäuden, im Keller, bei
 * abgeschaltetem Standortzugriff, oder weil ein Standort gar keinen Umriss
 * hat. Da der Standort entscheidet, wer bei einem Alarm aufgeboten wird,
 * muss eine Person ihn in einem Schritt korrigieren können.
 *
 * Die Korrektur hält HANDKORREKTUR_MS lang: Sonst würde das nächste
 * Geofence-Ereignis sie sofort wieder überschreiben, und die Person hätte
 * ins Leere getippt. Danach übernimmt die Ortung wieder – wer das Gebäude
 * inzwischen verlassen hat, soll nicht ewig dort geführt werden.
 */
export const HANDKORREKTUR_MS = 30 * 60_000
let vonHandBis = 0

export async function setzeAufenthaltVonHand(id: string | null): Promise<void> {
  vonHandBis = Date.now() + HANDKORREKTUR_MS
  setzeAufenthalt(id, true)
  // Der Server alarmiert nach seinem eigenen Stand – er muss es also erfahren
  if (!authToken()) await loadApiSettings()
  if (!authToken()) return
  try {
    await api.geoReport(id)
  } catch {
    // Server nicht erreichbar – die nächste Meldung oder der App-Start holt es nach
  }
}

/** Gilt gerade eine Handkorrektur? */
export function handkorrekturAktiv(jetzt = Date.now()): boolean {
  return jetzt < vonHandBis
}

/** Aufenthalt des letzten App-Laufs übernehmen (beim Start aufrufen) */
export async function ladeAufenthalt(): Promise<void> {
  try {
    const roh = await AsyncStorage.getItem(AUFENTHALT_KEY)
    if (roh !== null) setzeAufenthalt(roh || null)
  } catch {
    // Ohne gespeicherten Wert gilt der Profilstandort
  }
}

/**
 * Aufenthaltsort für die Anzeige. Ändert er sich – auch durch ein
 * Geofence-Ereignis im Hintergrund –, zeichnet die Oberfläche neu.
 */
export function useAufenthalt(): string | null {
  const [id, setId] = useState<string | null>(aufenthalt)
  useEffect(() => {
    setId(aufenthalt)
    zuhoerende.add(setId)
    return () => {
      zuhoerende.delete(setId)
    }
  }, [])
  return id
}

/**
 * Zuletzt bekannte Umrisse.
 *
 * Weckt das Betriebssystem die App für ein Geofence-Ereignis, war sie
 * womöglich beendet: Der Task läuft dann in einem frischen Kontext, in dem
 * syncGeofencing nie lief. Deshalb liegen die Umrisse auf dem Gerät und werden
 * bei Bedarf nachgeladen – genauso wie die Serveradresse.
 */
const UMRISS_KEY = 'sonnenberg-geofence-umrisse-v1'
let umrisse: GeofenceRegion[] = []

async function ladeUmrisse(): Promise<void> {
  if (umrisse.length > 0) return
  try {
    const roh = await AsyncStorage.getItem(UMRISS_KEY)
    if (roh) umrisse = JSON.parse(roh) as GeofenceRegion[]
  } catch {
    // Ohne gespeicherte Umrisse gilt der überwachte Kreis
  }
}

/**
 * Liegt der Punkt im Umriss? Strahlenverfahren.
 *
 * Für ein Schulareal ist die Rechnung in Grad genau genug; die Verzerrung über
 * wenige hundert Meter liegt weit unter der Genauigkeit der Ortung.
 */
function imUmriss(lat: number, lng: number, umriss: { lat: number; lng: number }[]): boolean {
  let drin = false
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const a = umriss[i]
    const b = umriss[j]
    if (a.lat > lat !== b.lat > lat && lng < ((b.lng - a.lng) * (lat - a.lat)) / (b.lat - a.lat) + a.lng) drin = !drin
  }
  return drin
}

/**
 * Beim Betreten des überwachten Kreises prüfen, ob die Position auch im Umriss
 * liegt.
 *
 * Betriebssysteme überwachen nur Kreise. Der Kreis um einen Umriss ist
 * absichtlich etwas grösser – er weckt die App, und erst hier entscheidet sich,
 * ob jemand wirklich am Standort ist. Lässt sich die Position nicht bestimmen,
 * gilt das Kreisergebnis: Lieber jemanden mitalarmieren, der zwanzig Meter
 * daneben steht, als jemanden übersehen, der drinnen ist.
 */
async function wirklichDrin(id: string): Promise<boolean> {
  await ladeUmrisse()
  const region = umrisse.find((r) => r.id === id)
  if (!region?.punkte || region.punkte.length < 3) return true
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return imUmriss(position.coords.latitude, position.coords.longitude, region.punkte)
  } catch {
    return true
  }
}

// Läuft auch, wenn iOS die App nur für das Geofence-Ereignis im Hintergrund weckt
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return
  const { eventType, region } = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion }
  const id = region.identifier
  if (!id) return
  if (eventType === Location.GeofencingEventType.Enter) {
    if (await wirklichDrin(id)) innerhalb.add(id)
    else innerhalb.delete(id)
  } else innerhalb.delete(id)
  setzeAufenthalt(innerhalb.size > 0 ? [...innerhalb][0] : null)
  // Beim Hintergrund-Start ist der Gerätespeicher noch nicht geladen
  if (!authToken()) await loadApiSettings()
  if (!authToken()) return
  try {
    await api.geoReport(innerhalb.size > 0 ? [...innerhalb][0] : null)
  } catch {
    // Server nicht erreichbar – die nächste Meldung oder der App-Start holt es nach
  }
})

/** Abstand zweier Koordinaten in Metern (Haversine) */
function distanzM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

let letzteKonfig = ''

/**
 * Geofence-Überwachung mit der Konfiguration des Servers abgleichen.
 * Idempotent: Läuft die Überwachung bereits mit denselben Regionen, passiert
 * nichts – der Aufruf ist deshalb bei jedem Datenabgleich unbedenklich.
 */
export async function syncGeofencing(aktiv: boolean, regionen: GeofenceRegion[]): Promise<void> {
  const konfig = aktiv && regionen.length > 0 ? JSON.stringify(regionen) : ''
  if (konfig === letzteKonfig) return
  letzteKonfig = konfig
  umrisse = aktiv ? regionen : []
  AsyncStorage.setItem(UMRISS_KEY, JSON.stringify(umrisse)).catch(() => {})
  try {
    if (!konfig) {
      if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK)
      }
      innerhalb.clear()
      setzeAufenthalt(null)
      return
    }

    const vordergrund = await Location.requestForegroundPermissionsAsync()
    if (!vordergrund.granted) {
      letzteKonfig = ''
      setzeAufenthalt(null)
      return
    }
    // «Immer» ist für Ereignisse im Hintergrund nötig; wird es verweigert,
    // meldet die App den Aufenthalt wenigstens bei jedem App-Start
    const hintergrund = await Location.requestBackgroundPermissionsAsync().catch(() => ({ granted: false }))
    if (hintergrund.granted) {
      await Location.startGeofencingAsync(
        GEOFENCE_TASK,
        regionen.map((r) => ({
          identifier: r.id,
          latitude: r.lat,
          longitude: r.lng,
          radius: r.radiusM,
          notifyOnEnter: true,
          notifyOnExit: true,
        })),
      )
    }

    // Aktuellen Aufenthalt sofort bestimmen und melden – die Geofence-Ereignisse
    // greifen erst bei der nächsten Grenzüberschreitung
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const { latitude, longitude } = position.coords
    // Erst der Kreis, dann – sofern vorhanden – der Umriss
    const dort = regionen.find((r) => {
      if (distanzM(latitude, longitude, r.lat, r.lng) > r.radiusM) return false
      return !r.punkte || r.punkte.length < 3 || imUmriss(latitude, longitude, r.punkte)
    })
    innerhalb.clear()
    if (dort) innerhalb.add(dort.id)
    setzeAufenthalt(dort?.id ?? null)
    if (authToken()) await api.geoReport(dort?.id ?? null)
  } catch {
    // Beim nächsten Abgleich erneut versuchen
    letzteKonfig = ''
  }
}

/** Überwachung beenden (Abmeldung) – ohne weitere Meldung an den Server */
export async function stopGeofencing(): Promise<void> {
  letzteKonfig = ''
  innerhalb.clear()
  setzeAufenthalt(null)
  umrisse = []
  AsyncStorage.removeItem(UMRISS_KEY).catch(() => {})
  try {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK)
    }
  } catch {
    // nichts zu beenden
  }
}
