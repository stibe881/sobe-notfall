import { brauchtRollentrennung, eigeneSchritteNachRolle, rollenkonflikte, haeufigstePrioritaet, zeigePrioritaet, haeufigeSzenarien } from './scenarios'
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
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
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

// ---------- Prioritäts-Kennzeichen ----------
{
  const sz = (id: string, priority: 'hoch' | 'mittel' | 'tief', active = true) =>
    ({ id, priority, active, title: id, icon: '', category: '', instructions: [], followUp: [],
       checklist: [], silentDefault: false, defaultChannels: [], responsibleGroupIds: [], contactIds: [] }) as unknown as Scenario

  const alleHoch = ['a','b','c','d'].map((i) => sz(i, 'hoch'))
  pruefe('steht alles auf hoch, sagt das Kennzeichen nichts – es entfällt',
    !zeigePrioritaet('hoch', alleHoch))

  const gemischt = [sz('a','hoch'), sz('b','hoch'), sz('c','hoch'), sz('d','tief')]
  pruefe('der Ausreisser wird gezeigt', zeigePrioritaet('tief', gemischt))
  pruefe('das Übliche bleibt stumm', !zeigePrioritaet('hoch', gemischt))

  const ausgeglichen = [sz('a','hoch'), sz('b','tief')]
  pruefe('ohne klare Mehrheit wird alles gezeigt',
    zeigePrioritaet('hoch', ausgeglichen) && zeigePrioritaet('tief', ausgeglichen))

  const mitInaktiven = [sz('a','hoch'), sz('b','hoch'), sz('c','hoch'), sz('d','tief', false), sz('e','tief', false)]
  pruefe('abgeschaltete Szenarien zählen nicht mit',
    haeufigstePrioritaet(mitInaktiven) === 'hoch' && zeigePrioritaet('tief', mitInaktiven))

  pruefe('bei einem einzigen Szenario gibt es kein «üblich»',
    haeufigstePrioritaet([sz('a','hoch')]) === null && zeigePrioritaet('hoch', [sz('a','hoch')]))
}

// ---------- Kacheln auf dem Startbildschirm ----------
{
  const sz = (id: string, priority: 'hoch' | 'mittel' | 'tief', title = id, active = true) =>
    ({ id, priority, title, active, icon: '', category: '', instructions: [], followUp: [],
       checklist: [], silentDefault: false, defaultChannels: [], responsibleGroupIds: [], contactIds: [] }) as unknown as Scenario

  const vorrat = [
    sz('sc-sos', 'hoch', 'SOS'),
    sz('sc-brand', 'hoch', 'Brand'),
    sz('sc-medizin', 'hoch', 'Medizinischer Notfall'),
    sz('sc-strom', 'tief', 'Stromausfall'),
    sz('sc-unwetter', 'mittel', 'Unwetter'),
    sz('sc-alt', 'hoch', 'Abgeschaltet', false),
  ]

  pruefe('SOS gehört nicht auf die Kacheln – dafür gibt es den grossen Knopf',
    !haeufigeSzenarien(vorrat, [], 4).some((s) => s.id === 'sc-sos'))
  pruefe('abgeschaltete Szenarien erscheinen nicht',
    !haeufigeSzenarien(vorrat, [], 4).some((s) => s.id === 'sc-alt'))
  pruefe('ohne Verlauf entscheidet die Priorität, dann der Titel',
    haeufigeSzenarien(vorrat, [], 4).map((s) => s.id).join(',') === 'sc-brand,sc-medizin,sc-unwetter,sc-strom')
  pruefe('was hier oft ausgelöst wurde, steht vorn',
    haeufigeSzenarien(vorrat, [{ scenarioId: 'sc-strom' }, { scenarioId: 'sc-strom' }], 2)[0].id === 'sc-strom')
  pruefe('bei gleicher Häufigkeit bleibt die Priorität massgebend',
    haeufigeSzenarien(vorrat, [{ scenarioId: 'sc-strom' }, { scenarioId: 'sc-brand' }], 2).map((s) => s.id).join(',') === 'sc-brand,sc-strom')
  pruefe('die gewünschte Anzahl wird eingehalten', haeufigeSzenarien(vorrat, [], 2).length === 2)
  pruefe('Alarme ohne Szenario stören nicht',
    haeufigeSzenarien(vorrat, [{}, { scenarioId: undefined }], 4).length === 4)
}

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
