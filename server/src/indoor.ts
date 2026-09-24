import type { IndoorPosition, IntegrationSettings } from './types.js'

/**
 * Indoor-Ortung über Aruba Meridian: Prüfen und Benennen der Positionen, die
 * die App mit einem Alarm schickt.
 *
 * Die App ortet sich mit dem Meridian-SDK anhand der Bluetooth-Beacons der
 * Access Points und liefert eine Karte (ein Stockwerk) samt Pixelposition auf
 * deren Grundriss. Der Server kennt die Karten mit Klarnamen aus dem Portal –
 * daraus wird «Hauptgebäude, 2. OG» für Alarmtexte und Protokoll.
 */

/** Eine Position, die älter ist, beschreibt nicht mehr, wo die Person jetzt ist */
export const INDOOR_HOECHSTALTER_MS = 10 * 60_000

const KARTEN_ID = /^[A-Za-z0-9_-]{1,64}$/

const endlich = (wert: unknown): wert is number => typeof wert === 'number' && Number.isFinite(wert)

/**
 * Position aus einer Anfrage übernehmen – oder null, wenn sie fehlt, unbrauchbar
 * oder veraltet ist. Eine fehlerhafte Position verhindert nie den Alarm selbst.
 */
export function liesIndoor(roh: unknown, jetzt = Date.now()): IndoorPosition | null {
  if (!roh || typeof roh !== 'object') return null
  const o = roh as Record<string, unknown>
  const mapId = typeof o.mapId === 'string' ? o.mapId.trim() : ''
  if (!KARTEN_ID.test(mapId) || !endlich(o.x) || !endlich(o.y)) return null
  // Die Uhr des Telefons kann etwas vorgehen – dann gilt die Serverzeit
  const ermitteltAt = endlich(o.ermitteltAt) ? Math.min(o.ermitteltAt, jetzt) : jetzt
  if (jetzt - ermitteltAt > INDOOR_HOECHSTALTER_MS) return null
  const position: IndoorPosition = { mapId, x: o.x, y: o.y, ermitteltAt }
  if (endlich(o.genauigkeitM) && o.genauigkeitM >= 0) position.genauigkeitM = Math.round(o.genauigkeitM * 10) / 10
  if (o.quelle === 'beacons' || o.quelle === 'wlan' || o.quelle === 'system' || o.quelle === 'unbekannt') position.quelle = o.quelle
  return position
}

/** Klarname der Karte, z. B. «Hauptgebäude, 2. OG» – ohne Eintrag im Portal die Kennung */
export function indoorOrt(position: IndoorPosition, integ: IntegrationSettings): string {
  const karte = integ.meridian.karten.find((k) => k.mapId === position.mapId)
  return karte?.name || `Karte ${position.mapId}`
}

/** Ort samt Genauigkeit für Alarmtexte: «Hauptgebäude, 2. OG (±3 m)» */
export function indoorText(position: IndoorPosition, integ: IntegrationSettings): string {
  const ort = indoorOrt(position, integ)
  return position.genauigkeitM !== undefined ? `${ort} (±${Math.max(1, Math.round(position.genauigkeitM))} m)` : ort
}
