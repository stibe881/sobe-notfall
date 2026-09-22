/**
 * Adresse zu Koordinaten – über Nominatim (OpenStreetMap).
 *
 * Der Dienst ist frei, braucht keinen Schlüssel und deckt die Schweiz gut ab.
 * Die Anfrage stellt der Browser, nicht der Alarmserver: Ein Server ohne
 * Internetzugang steht dem also nicht im Weg. Gesucht wird nur, wenn jemand im
 * Portal eine Adresse eingibt – nie automatisch im Hintergrund und nie mit
 * Personendaten.
 *
 * Nominatim verlangt einen erkennbaren Absender und höchstens eine Anfrage pro
 * Sekunde. Der Browser sendet den Referer automatisch mit; die Bremse steht
 * unten. Bei ausbleibender Antwort bleiben die bisherigen Koordinaten stehen –
 * geraten wird nichts.
 */

export interface Fundstelle {
  lat: number
  lng: number
  /** Vollständige Bezeichnung, wie der Dienst sie kennt – zur Kontrolle */
  bezeichnung: string
}

const DIENST = 'https://nominatim.openstreetmap.org/search'

/** Nominatim erlaubt eine Anfrage pro Sekunde – der Abstand wird hier gewahrt */
let letzteAnfrage = 0
async function bremse(): Promise<void> {
  const abstand = Date.now() - letzteAnfrage
  if (abstand < 1100) await new Promise((r) => setTimeout(r, 1100 - abstand))
  letzteAnfrage = Date.now()
}

/**
 * Adresse suchen. Liefert die besten Treffer, damit bei mehrdeutigen Angaben
 * («Bahnhofstrasse») gewählt werden kann statt blind der erste genommen wird.
 */
export async function sucheAdresse(adresse: string, anzahl = 5): Promise<Fundstelle[]> {
  const text = adresse.trim()
  if (text.length < 3) return []
  await bremse()
  const url = `${DIENST}?format=jsonv2&addressdetails=0&limit=${anzahl}&q=${encodeURIComponent(text)}`
  const antwort = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!antwort.ok) throw new Error(`Der Adressdienst antwortet mit Status ${antwort.status}.`)
  const treffer = (await antwort.json()) as { lat: string; lon: string; display_name: string }[]
  return treffer
    .map((t) => ({ lat: Number(t.lat), lng: Number(t.lon), bezeichnung: t.display_name }))
    .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng))
}
