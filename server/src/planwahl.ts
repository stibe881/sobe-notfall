import type { AlarmPlan } from './types.js'

/**
 * Welcher Alarmplan zu einer Auslösung gehört.
 *
 * Bis September 2026 entschied das der Client – und meist gar nicht: Das
 * Portal wandte den Plan nur an, wenn jemand ihn aus einem Dropdown
 * «optional» wählte; die App ignorierte die Pläne vollständig und schickte
 * für jedes Szenario dieselbe fest verdrahtete Eskalation. Der sorgfältig
 * konfigurierte Brandalarm (Evakuationsteam nach drei Minuten, Krisenstab
 * nach zehn) griff aus der App also nie.
 *
 * Jetzt löst der Server den Plan auf, sobald der Client keinen nennt. Damit
 * gelten die Pläne an einer Stelle – für Portal, App, Knopf und Fremdsystem
 * gleichermassen.
 *
 * Reihenfolge bei mehreren Plänen zum selben Szenario:
 *   1. ein Plan, dessen Standorte die Alarmstandorte treffen,
 *   2. ein Plan ohne Standortbindung (gilt überall),
 *   3. notfalls ein Plan eines anderen Standorts – seine Stufen sind das
 *      Drehbuch des Szenarios, und die Empfänger löst der Alarm ohnehin nach
 *      seinen eigenen Standorten auf.
 * Innerhalb einer Stufe entscheidet der Name, damit die Wahl nie zufällig ist.
 */
export function planFuer(plaene: AlarmPlan[], scenarioId: string, locationIds: string[]): AlarmPlan | null {
  if (!scenarioId) return null
  const kandidaten = plaene.filter((p) => p.scenarioId === scenarioId)
  if (kandidaten.length === 0) return null

  const rang = (p: AlarmPlan): number => {
    if (p.locationIds.length === 0) return 1
    if (p.locationIds.some((id) => locationIds.includes(id))) return 0
    return 2
  }
  return [...kandidaten].sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'))[0]
}
