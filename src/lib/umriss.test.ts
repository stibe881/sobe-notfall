/**
 * Prüfung der Umriss-Rechnung.
 *
 *   npm test
 *
 * Diese Geometrie entscheidet, wer bei einem Alarm als «am Standort» gilt.
 * Ein Fehler darin fällt im Betrieb nicht auf – er zeigt sich erst daran,
 * dass jemand nicht alarmiert wird. Deshalb steht sie unter Prüfung, samt
 * dem Fall, für den es den Umriss überhaupt gibt: einem L-förmigen Gebäude,
 * dessen Innenwinkel ein Kreis mit einschlösse.
 */
import { imUmriss, umschliessenderKreis, flaecheM2, distanzM, startViereck } from './umriss'

let ok = 0, fehl = 0
const pruefe = (name: string, bedingung: boolean, zusatz = ''): void => {
  if (bedingung) { ok++; console.log('OK   ' + name) }
  else { fehl++; console.log('FEHL ' + name + (zusatz ? ' – ' + zusatz : '')) }
}

// Viereck um den Hauptsitz Baar, rund 60 m Seitenlänge
const mitte = { lat: 47.1954, lng: 8.5289 }
const viereck = startViereck(mitte, 60)

pruefe('Mittelpunkt liegt im Umriss', imUmriss(mitte, viereck))
pruefe('Punkt weit ausserhalb liegt nicht im Umriss', !imUmriss({ lat: 47.20, lng: 8.54 }, viereck))
pruefe('Punkt knapp ausserhalb liegt nicht im Umriss', !imUmriss({ lat: mitte.lat + 0.0005, lng: mitte.lng }, viereck))

const flaeche = flaecheM2(viereck)
pruefe('Fläche rund 3600 m²', Math.abs(flaeche - 3600) < 120, `${Math.round(flaeche)} m²`)

const kreis = umschliessenderKreis(viereck)
pruefe('Kreis umschliesst alle Eckpunkte', viereck.every((p) => distanzM(kreis, p) <= kreis.radiusM))
pruefe('Kreismittelpunkt entspricht der Mitte', distanzM(kreis, mitte) < 1, `${distanzM(kreis, mitte).toFixed(2)} m`)
pruefe('Kreis mindestens 50 m', kreis.radiusM >= 50, `${kreis.radiusM} m`)

// L-förmiges Gebäude: die Ecke im Innenwinkel darf nicht als «drin» gelten
const lForm = [
  { lat: 47.1950, lng: 8.5285 }, { lat: 47.1956, lng: 8.5285 },
  { lat: 47.1956, lng: 8.5289 }, { lat: 47.1953, lng: 8.5289 },
  { lat: 47.1953, lng: 8.5293 }, { lat: 47.1950, lng: 8.5293 },
]
pruefe('L-Form: Punkt im Schenkel liegt drin', imUmriss({ lat: 47.1955, lng: 8.5287 }, lForm))
pruefe('L-Form: Punkt im Innenwinkel liegt draussen', !imUmriss({ lat: 47.1955, lng: 8.5291 }, lForm))

console.log(`\n${ok} bestanden, ${fehl} fehlgeschlagen`)
// Ohne process-Typen: ein Fehlschlag wirft, der Aufruf endet mit Rückgabewert 1
if (fehl > 0) throw new Error(`${fehl} Prüfung(en) fehlgeschlagen`)
