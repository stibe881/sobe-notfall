import { lagetext, naechsteWartezeit, notrufAnbieten, versuchtNoch, WARTEZEITEN_MS } from './alarmversand'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

pruefe('nach dem ersten Fehlversuch wird bald erneut versucht', naechsteWartezeit(1) === WARTEZEITEN_MS[0])
pruefe('die Wartezeiten werden länger', WARTEZEITEN_MS.every((w, i) => i === 0 || w > WARTEZEITEN_MS[i - 1]))
// Vier Wartezeiten sind vier Pausen, also fünf Versuche insgesamt
pruefe('die letzte Pause wird noch eingelegt', naechsteWartezeit(WARTEZEITEN_MS.length) !== null)
pruefe('danach wird nicht mehr automatisch wiederholt',
  naechsteWartezeit(WARTEZEITEN_MS.length + 1) === null)
pruefe('ohne Fehlversuch gibt es keine Wartezeit', naechsteWartezeit(0) === null)

pruefe('nach einem Fehlversuch noch kein Notruf-Vorschlag', !notrufAnbieten(1))
pruefe('ab dem zweiten Fehlversuch wird der Notruf vorgeschlagen', notrufAnbieten(2))
pruefe('danach bleibt der Vorschlag', notrufAnbieten(9))

pruefe('solange automatisch wiederholt wird, gilt es als laufend',
  versuchtNoch({ versuche: 1, laeuft: false, fehler: '' }))
pruefe('ein laufender Versuch gilt als laufend',
  versuchtNoch({ versuche: 9, laeuft: true, fehler: '' }))
pruefe('nach dem letzten Versuch gilt es als beendet',
  !versuchtNoch({ versuche: WARTEZEITEN_MS.length + 1, laeuft: false, fehler: '' }))

pruefe('der Text nennt den laufenden Versuch',
  lagetext({ versuche: 1, laeuft: true, fehler: '' }).includes('Versuch 2'))
pruefe('Einzahl bei einem Fehlversuch',
  lagetext({ versuche: 1, laeuft: false, fehler: '' }).startsWith('1 Versuch fehlgeschlagen'))
pruefe('Mehrzahl bei zwei Fehlversuchen',
  lagetext({ versuche: 2, laeuft: false, fehler: '' }).startsWith('2 Versuche fehlgeschlagen'))
pruefe('am Ende sagt der Text, dass nichts mehr von selbst geschieht',
  lagetext({ versuche: WARTEZEITEN_MS.length + 1, laeuft: false, fehler: '' }).includes('nicht mehr von selbst'))

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
