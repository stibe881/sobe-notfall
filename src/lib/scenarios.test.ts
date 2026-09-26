import { brauchtRollentrennung, eigeneSchritteNachRolle, rollenkonflikte } from './scenarios'
import type { Scenario } from '../types'

const brand = {
  id: 'sc-brand', title: 'Brand', active: true,
  responseSteps: [
    { text: 'Gebäude verlassen' },
    { text: 'Sammelplatz sichern', groupIds: ['gr-evak'] },
    { text: 'Vollzähligkeit melden', groupIds: ['gr-evak'] },
    { text: 'Führungsraum beziehen', groupIds: ['gr-krisenstab'] },
    { text: 'Nur IT', groupIds: ['gr-it'] },
  ],
} as unknown as Scenario

const medizin = {
  id: 'sc-med', title: 'Medizin', active: true,
  responseSteps: [{ text: 'Erste Hilfe leisten', groupIds: ['gr-ersthelfer'] }],
} as unknown as Scenario

let fehler = 0
function pruefe(name: string, bedingung: boolean): void {
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

// Eine Rolle: ein Block für alle, einer für die Rolle – keine Trennung nötig
const eine = eigeneSchritteNachRolle(brand, ['gr-evak'])
pruefe('Eine Rolle ergibt zwei Blöcke', eine.length === 2)
pruefe('Der erste Block gilt allen', eine[0].groupId === undefined)
pruefe('Fremde Schritte bleiben draussen', !eine.some((b) => b.schritte.some((s) => s.text === 'Nur IT')))
pruefe('Bei einer Rolle keine Trennung', !brauchtRollentrennung(eine))

// Zwei Rollen: getrennte Blöcke, und die Trennung lohnt
const zwei = eigeneSchritteNachRolle(brand, ['gr-evak', 'gr-krisenstab'])
pruefe('Zwei Rollen ergeben drei Blöcke', zwei.length === 3)
pruefe('Evakuationsschritte stehen zusammen',
  zwei.find((b) => b.groupId === 'gr-evak')?.schritte.length === 2)
pruefe('Krisenstab bekommt einen eigenen Block',
  zwei.find((b) => b.groupId === 'gr-krisenstab')?.schritte.length === 1)
pruefe('Bei zwei Rollen wird getrennt', brauchtRollentrennung(zwei))

// Ein Schritt für zwei eigene Gruppen darf nicht doppelt erscheinen
const doppelt = {
  id: 'sc-x', title: 'X', active: true,
  responseSteps: [{ text: 'Gemeinsam', groupIds: ['gr-a', 'gr-b'] }],
} as unknown as Scenario
const einmal = eigeneSchritteNachRolle(doppelt, ['gr-a', 'gr-b'])
pruefe('Ein Schritt für zwei eigene Gruppen erscheint einmal',
  einmal.reduce((n, b) => n + b.schritte.length, 0) === 1)

// Konflikte erkennen
const konflikte = rollenkonflikte(['gr-evak', 'gr-krisenstab'], [brand, medizin])
pruefe('Brand gilt als Rollenkonflikt', konflikte.length === 1 && konflikte[0].scenario.id === 'sc-brand')
pruefe('Der Konflikt nennt beide Rollen', konflikte[0].groupIds.length === 2)
pruefe('Eine einzelne Rolle ist kein Konflikt', rollenkonflikte(['gr-evak'], [brand, medizin]).length === 0)
pruefe('Inaktive Szenarien zählen nicht',
  rollenkonflikte(['gr-evak', 'gr-krisenstab'], [{ ...brand, active: false } as Scenario]).length === 0)

console.log(`\n${13 - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
