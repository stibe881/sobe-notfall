/**
 * Ausgehende Aufrufe mit Frist.
 *
 * Bis September 2026 hatte kein einziger ausgehender Aufruf des Servers
 * einen Timeout – nicht an den Push-Dienst, nicht an SMS-Anbieter, nicht an
 * Webhooks. Ein hängender Aufruf hielt den Eskalationsdurchlauf fest, während
 * alle fünf Sekunden ein neuer startete; dieselbe Stufe konnte mehrfach
 * zünden, genau dann, wenn die Lage ohnehin angespannt war.
 *
 * Acht Sekunden sind grosszügig für jeden Dienst, der funktioniert, und kurz
 * genug, dass ein toter Dienst den Alarmserver nicht mitnimmt. Wer die Frist
 * anders braucht, gibt sie mit.
 */
export const STANDARDFRIST_MS = 8_000

export async function fetchMitFrist(eingabe: string | URL, init: RequestInit = {}, fristMs = STANDARDFRIST_MS): Promise<Response> {
  // Eine mitgegebene Abbruchsteuerung bleibt massgebend
  if (init.signal) return fetch(eingabe, init)
  const abbruch = new AbortController()
  const frist = setTimeout(() => abbruch.abort(new Error(`Keine Antwort innert ${fristMs / 1000} s`)), fristMs)
  try {
    return await fetch(eingabe, { ...init, signal: abbruch.signal })
  } finally {
    clearTimeout(frist)
  }
}
