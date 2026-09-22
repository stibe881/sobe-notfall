/**
 * Rechnen mit dem Standort-Umriss.
 *
 * Ein Standort wird als Vieleck mit bis zu zehn Eckpunkten erfasst – ein
 * Schulhaus ist selten rund. Betriebssysteme überwachen aber nur Kreise: iOS
 * und Android kennen ausschliesslich kreisförmige Regionen. Deshalb wird aus
 * dem Umriss ein umschliessender Kreis berechnet, den das Gerät überwacht; ob
 * jemand tatsächlich am Standort ist, entscheidet danach der Umriss.
 */

export interface Punkt { lat: number; lng: number }

export const MAX_PUNKTE = 10
export const MIN_PUNKTE = 3

/** Abstand zweier Koordinaten in Metern (Haversine) */
export function distanzM(a: Punkt, b: Punkt): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Mittelpunkt eines Umrisses – Durchschnitt der Eckpunkte */
export function mittelpunkt(punkte: Punkt[]): Punkt {
  const n = punkte.length
  return {
    lat: punkte.reduce((s, p) => s + p.lat, 0) / n,
    lng: punkte.reduce((s, p) => s + p.lng, 0) / n,
  }
}

/**
 * Kreis, der den Umriss vollständig enthält. Der Zuschlag von 20 Metern sorgt
 * dafür, dass das Gerät die Grenze sicher meldet, bevor jemand mittendrin
 * steht: Die Ortung ist auf wenige Meter genau, nicht exakt.
 */
export function umschliessenderKreis(punkte: Punkt[]): { lat: number; lng: number; radiusM: number } {
  const m = mittelpunkt(punkte)
  const weiteste = punkte.reduce((max, p) => Math.max(max, distanzM(m, p)), 0)
  return { lat: m.lat, lng: m.lng, radiusM: Math.max(50, Math.round(weiteste + 20)) }
}

/**
 * Liegt der Punkt im Umriss? Strahlenverfahren (ray casting).
 *
 * Für Flächen in der Grösse eines Schulareals ist die Rechnung in
 * Grad-Koordinaten genau genug – die Verzerrung über wenige hundert Meter
 * liegt weit unter der Genauigkeit der Ortung.
 */
export function imUmriss(p: Punkt, umriss: Punkt[]): boolean {
  let drin = false
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const a = umriss[i]
    const b = umriss[j]
    const schneidet = a.lat > p.lat !== b.lat > p.lat
    if (schneidet && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) drin = !drin
  }
  return drin
}

/** Näherungsweise Fläche in Quadratmetern – für die Angabe im Portal */
export function flaecheM2(punkte: Punkt[]): number {
  if (punkte.length < 3) return 0
  const m = mittelpunkt(punkte)
  const mProGradLat = 111320
  const mProGradLng = 111320 * Math.cos((m.lat * Math.PI) / 180)
  let summe = 0
  for (let i = 0, j = punkte.length - 1; i < punkte.length; j = i++) {
    const x1 = (punkte[j].lng - m.lng) * mProGradLng
    const y1 = (punkte[j].lat - m.lat) * mProGradLat
    const x2 = (punkte[i].lng - m.lng) * mProGradLng
    const y2 = (punkte[i].lat - m.lat) * mProGradLat
    summe += x1 * y2 - x2 * y1
  }
  return Math.abs(summe / 2)
}

/** Viereck um einen Punkt – Startform, die sich danach zurechtziehen lässt */
export function startViereck(mitte: Punkt, seiteM = 60): Punkt[] {
  const dLat = seiteM / 2 / 111320
  const dLng = seiteM / 2 / (111320 * Math.cos((mitte.lat * Math.PI) / 180))
  return [
    { lat: mitte.lat + dLat, lng: mitte.lng - dLng },
    { lat: mitte.lat + dLat, lng: mitte.lng + dLng },
    { lat: mitte.lat - dLat, lng: mitte.lng + dLng },
    { lat: mitte.lat - dLat, lng: mitte.lng - dLng },
  ].map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) }))
}
