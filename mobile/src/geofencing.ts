import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
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
}

/** Regionen, in denen sich das Gerät laut den letzten Ereignissen befindet */
const innerhalb = new Set<string>()

// Läuft auch, wenn iOS die App nur für das Geofence-Ereignis im Hintergrund weckt
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return
  const { eventType, region } = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion }
  const id = region.identifier
  if (!id) return
  if (eventType === Location.GeofencingEventType.Enter) innerhalb.add(id)
  else innerhalb.delete(id)
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
  try {
    if (!konfig) {
      if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK)
      }
      innerhalb.clear()
      return
    }

    const vordergrund = await Location.requestForegroundPermissionsAsync()
    if (!vordergrund.granted) {
      letzteKonfig = ''
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
    const dort = regionen.find(
      (r) => distanzM(position.coords.latitude, position.coords.longitude, r.lat, r.lng) <= r.radiusM,
    )
    innerhalb.clear()
    if (dort) innerhalb.add(dort.id)
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
  try {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK)
    }
  } catch {
    // nichts zu beenden
  }
}
