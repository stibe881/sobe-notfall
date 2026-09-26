import type { Alarm, EscalationLevel } from './types.js'

/** Mehr als die Kennung braucht die Entscheidung nicht – so passen Nutzer:innen aus jeder Quelle hinein */
export interface Aufzubietende { id: string }

/**
 * Wer bei einer Eskalationsstufe aufgeboten wird – und ob überhaupt.
 *
 * Die Entscheidung steht hier für sich, ohne Datenbank und ohne Uhr, damit
 * sie prüfbar ist. Sie ist folgenreich genug dafür: Ein Fehler an dieser
 * Stelle bedeutet, dass der Krisenstab im Ernstfall nie aufgeboten wird.
 *
 * Genau das war der Fall. Bis September 2026 genügte **eine einzige** Zusage,
 * um jede weitere Stufe abzuschalten – `deliveries.some(ack === 'acknowledged')`.
 * Bei einem Brandalarm an alle Mitarbeitenden tippt innerhalb von drei Minuten
 * praktisch sicher irgendwer «ich komme»; Evakuationsteam und Krisenstab
 * wurden daraufhin nie erreicht. Die Oberfläche versprach derweil das
 * Gegenteil («solange nicht alle quittiert haben»).
 *
 * Seither entscheidet die Stufe selbst, welcher Art sie ist – siehe
 * `nurWennUnbeantwortet` in den Typen.
 */
export type Eskalationsentscheid<T extends Aufzubietende = Aufzubietende> =
  | { art: 'warten' }
  | { art: 'entfaellt'; grund: string }
  | { art: 'aufbieten'; empfaenger: T[] }

/** Wer bereits zugesagt hat – diese Personen sind unterwegs, sie erneut anzuklingeln bringt nichts */
export function zusagen(alarm: Alarm): Set<string> {
  return new Set(alarm.deliveries.filter((d) => d.ack === 'acknowledged').map((d) => d.userId))
}

/**
 * @param stufenEmpfaenger  Alle Personen der Stufengruppen am Alarmstandort,
 *                          Abwesende bereits aussortiert.
 */
export function eskalationsentscheid<T extends Aufzubietende>(
  alarm: Alarm,
  stufe: EscalationLevel,
  stufenEmpfaenger: T[],
  jetzt: number,
): Eskalationsentscheid<T> {
  if (jetzt - alarm.triggeredAt <= stufe.afterMinutes * 60_000) return { art: 'warten' }

  const bereitsZugesagt = zusagen(alarm)

  // Rückfallebene: entfällt, sobald jemand zugesagt hat. Der geplante Ablauf
  // (Standard) zündet unabhängig davon – bei einem Brand gehören
  // Evakuationsteam und Krisenstab gerade dann aufgeboten, wenn vor Ort
  // schon jemand handelt.
  if (stufe.nurWennUnbeantwortet && bereitsZugesagt.size > 0) {
    return { art: 'entfaellt', grund: `${bereitsZugesagt.size} Zusage(n) liegen vor (Stufe ist als Rückfallebene gesetzt)` }
  }

  const empfaenger = stufenEmpfaenger.filter((e) => !bereitsZugesagt.has(e.id))
  if (empfaenger.length === 0) {
    return {
      art: 'entfaellt',
      grund: stufenEmpfaenger.length === 0
        ? 'die Gruppe ist am Standort nicht besetzt'
        : 'alle haben bereits zugesagt',
    }
  }
  return { art: 'aufbieten', empfaenger }
}
