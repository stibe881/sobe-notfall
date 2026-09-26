import { notrufbild } from './notrufsymbole'

let fehler = 0
function pruefe(name: string, bedingung: boolean): void {
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

pruefe('Polizei 117 bekommt das Schild', notrufbild('Polizei', '117').symbol === 'shield')
pruefe('Feuerwehr 118 bekommt die Flamme', notrufbild('Feuerwehr', '118').symbol === 'flame')
pruefe('Sanität 144 bekommt den Krankenwagen', notrufbild('Sanität', '144').symbol === 'ambulance')
pruefe('Rega 1414 bekommt das Fluggerät', notrufbild('Rega', '1414').symbol === 'plane')
pruefe('Tox 145 bekommt den Kolben', notrufbild('Tox Info Suisse', '145').symbol === 'flask')
pruefe('147 bekommt das Kindersymbol', notrufbild('Pro Juventute', '147').symbol === 'baby')

pruefe('Lebensgefahr ist rot', notrufbild('Sanität', '144').farbe === 'rot')
pruefe('Beratung ist bernsteinfarben', notrufbild('Dargebotene Hand', '143').farbe === 'bernstein')

pruefe('Formatierte Nummern werden erkannt', notrufbild('Polizei', '+41 117').symbol === 'shield')
pruefe('Ein umbenannter Eintrag bleibt richtig', notrufbild('Kapo Zug', '117').symbol === 'shield')

pruefe('Eigener Eintrag über das Stichwort', notrufbild('Gemeindepolizei Baar', '041 728 00 00').symbol === 'shield')
pruefe('Unbekanntes bekommt den Hörer', notrufbild('Hauswart', '079 000 00 00').symbol === 'phone')
pruefe('Unbekanntes ist grau', notrufbild('Hauswart', '079 000 00 00').farbe === 'grau')

console.log(`\n${13 - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
