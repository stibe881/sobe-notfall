import type { ResponseStep, Scenario, ScenarioPriority } from './types'

/**
 * Nur aktive Szenarien erscheinen in der App und bei der Alarmauslösung.
 * Ältere Datenbestände kennen das Feld nicht – dort gilt alles als aktiv.
 */
export function isActive(scenario: Scenario): boolean {
  return scenario.active !== false
}

export function activeScenarios(scenarios: Scenario[]): Scenario[] {
  return scenarios.filter(isActive)
}

/**
 * Schritte für Empfänger:innen – aus dem neuen Feld, oder aus dem alten ohne
 * Gruppenzuordnung, falls ein selbst erstelltes Szenario noch so gespeichert ist.
 */
export function responseStepsOf(scenario: Scenario): ResponseStep[] {
  if (scenario.responseSteps?.length) return scenario.responseSteps
  return (scenario.responseInstructions ?? []).map((text) => ({ text }))
}

/**
 * Was eine bestimmte Person tut: Schritte ohne Gruppen gelten für alle, die
 * übrigen nur für Mitglieder der genannten Gruppen. «andere» bleibt einsehbar,
 * damit man weiss, was die Kolleg:innen gerade tun.
 */
export function responseStepsFor(scenario: Scenario, groupIds: string[]): { eigene: ResponseStep[]; andere: ResponseStep[] } {
  const eigene: ResponseStep[] = []
  const andere: ResponseStep[] = []
  for (const schritt of responseStepsOf(scenario)) {
    const fuerAlle = !schritt.groupIds || schritt.groupIds.length === 0
    if (fuerAlle || schritt.groupIds!.some((g) => groupIds.includes(g))) eigene.push(schritt)
    else andere.push(schritt)
  }
  return { eigene, andere }
}

/** Ein Block eigener Schritte, entweder rollenlos oder zu einer Gruppe gehörend */
export interface SchrittBlock {
  /** Gruppen-Id; fehlt bei Schritten, die allen Alarmierten gelten */
  groupId?: string
  schritte: ResponseStep[]
}

/**
 * Eigene Schritte nach Rolle getrennt.
 *
 * Wer in mehreren alarmierten Gruppen ist, bekommt Aufgaben aus jeder – beim
 * Brand etwa «Gebäude verlassen» (alle), «Sammelplatz sichern»
 * (Evakuationsteam) und «Führungsraum beziehen» (Krisenstab). Das sind drei
 * Aufgaben an drei Orten; niemand kann sie gleichzeitig erfüllen.
 *
 * In einer einzigen Liste untereinander sieht das aus, als gehöre es zusammen,
 * und man arbeitet unter Druck von oben nach unten. Getrennt nach Rolle sieht
 * man sofort, dass man zwei Hüte aufhat – und kann entscheiden, statt
 * abzuarbeiten.
 *
 * Hat jemand nur eine Rolle, entsteht genau ein Block ohne Überschrift; für
 * den Regelfall ändert sich also nichts.
 */
export function eigeneSchritteNachRolle(scenario: Scenario, groupIds: string[]): SchrittBlock[] {
  const { eigene } = responseStepsFor(scenario, groupIds)
  const bloecke: SchrittBlock[] = []
  for (const schritt of eigene) {
    // Ein Schritt, der auf mehrere eigene Gruppen passt, gehört unter die
    // erste davon – doppelt aufführen hiesse, ihn doppelt zu tun.
    const rolle = schritt.groupIds?.find((g) => groupIds.includes(g))
    const vorhanden = bloecke.find((b) => b.groupId === rolle)
    if (vorhanden) vorhanden.schritte.push(schritt)
    else bloecke.push({ groupId: rolle, schritte: [schritt] })
  }
  return bloecke
}

/**
 * Lohnt die Aufteilung nach Rollen überhaupt?
 *
 * Nur wenn wirklich mehr als ein Block mit Rollenbezug entsteht. Sonst wäre
 * eine Überschrift über der einzigen Liste bloss Lärm.
 */
export function brauchtRollentrennung(bloecke: SchrittBlock[]): boolean {
  return bloecke.filter((b) => b.groupId !== undefined).length > 1
}

/**
 * Szenarien, in denen diese Gruppenzugehörigkeiten zu widersprüchlichen
 * Aufgaben führen.
 *
 * Zwei Rollen in derselben Lage heissen zwei Aufgabenlisten – und im Ernstfall
 * eine Person, die an zwei Orten sein müsste. Die Software kann das nicht
 * auflösen; sie kann es nur zeigen, solange man die Zuteilung noch ändern kann.
 */
export function rollenkonflikte(
  groupIds: string[],
  scenarios: Scenario[],
): { scenario: Scenario; groupIds: string[] }[] {
  const treffer: { scenario: Scenario; groupIds: string[] }[] = []
  for (const scenario of scenarios) {
    if (scenario.active === false) continue
    const betroffen = new Set<string>()
    for (const schritt of responseStepsOf(scenario)) {
      for (const g of schritt.groupIds ?? []) if (groupIds.includes(g)) betroffen.add(g)
    }
    if (betroffen.size > 1) treffer.push({ scenario, groupIds: [...betroffen] })
  }
  return treffer
}

/**
 * Was nach der Entwarnung zu tun ist. Fehlt das Feld (selbst erstelltes
 * Szenario), greifen die weiterführenden Massnahmen.
 */
export function allClearStepsOf(scenario: Scenario): string[] {
  if (scenario.allClearSteps?.length) return scenario.allClearSteps
  return scenario.followUp ?? []
}

/**
 * Lohnt sich das Prioritäts-Kennzeichen bei diesem Szenario?
 *
 * In der Praxis stehen fast alle aktiven Szenarien auf «hoch» – bei der
 * Erstbefüllung sind es alle zwölf. Ein Kennzeichen, das überall gleich
 * lautet, unterscheidet nichts: Es kostet Platz auf jeder Karte und stumpft
 * gegen den Fall ab, in dem es wirklich etwas zu sagen hat.
 *
 * Deshalb erscheint es nur, wo die Priorität vom häufigsten Wert abweicht.
 * Sobald die Prioritäten tatsächlich gestaffelt sind, kommt es von selbst
 * zurück – es gibt nichts einzustellen.
 */
export function haeufigstePrioritaet(scenarios: Scenario[]): ScenarioPriority | null {
  const aktiv = activeScenarios(scenarios)
  if (aktiv.length < 2) return null
  const zaehler = new Map<ScenarioPriority, number>()
  for (const s of aktiv) zaehler.set(s.priority, (zaehler.get(s.priority) ?? 0) + 1)
  const [[wert, anzahl]] = [...zaehler.entries()].sort((a, b) => b[1] - a[1])
  // Erst ab einer klaren Mehrheit ist «üblich» ein sinnvoller Begriff
  return anzahl > aktiv.length / 2 ? wert : null
}

/** Kennzeichen zeigen? Nur, wenn die Priorität vom Üblichen abweicht. */
export function zeigePrioritaet(priority: ScenarioPriority, scenarios: Scenario[]): boolean {
  const ueblich = haeufigstePrioritaet(scenarios)
  return ueblich === null || priority !== ueblich
}
