/**
 * Was geschieht, wenn ein Alarm den Server nicht erreicht.
 *
 * Bis September 2026 war die einzige Rückmeldung ein Toast, der nach 3,5
 * Sekunden verschwand: «Der Alarmserver hat die Aktion abgelehnt.» Wer im
 * Treppenhaus mit schlechtem Empfang SOS drückte, sah ein graues Fähnchen
 * vorbeiziehen und ging davon aus, dass Hilfe unterwegs ist. In einem
 * Gebäude mit Funklöchern war das die wahrscheinlichste stille
 * Fehlfunktion des ganzen Systems.
 *
 * Jetzt gilt: Ein Alarm, der nicht raus ist, bleibt sichtbar, bis ihn
 * jemand losgeworden oder verworfen hat.
 */

/** Wartezeiten zwischen den Versuchen. Kurz genug, um zu helfen; lang genug,
 *  dass ein kurzer Funkschatten überbrückt wird. */
export const WARTEZEITEN_MS = [2_000, 5_000, 10_000, 20_000]

/** Ab so vielen erfolglosen Versuchen schlägt die App den Notruf vor. */
export const NOTRUF_AB_VERSUCH = 2

export interface Versandlage {
  /** Wie viele Versuche sind gescheitert */
  versuche: number
  /** Läuft gerade ein Versuch? */
  laeuft: boolean
  /** Die letzte Fehlermeldung des Servers oder der Verbindung */
  fehler: string
}

/**
 * Wartezeit bis zum nächsten Versuch.
 * `null`: keine automatische Wiederholung mehr – von Hand oder Notruf.
 */
export function naechsteWartezeit(versuche: number): number | null {
  return versuche >= 1 && versuche <= WARTEZEITEN_MS.length ? WARTEZEITEN_MS[versuche - 1] : null
}

/** Soll der Notruf angeboten werden? */
export function notrufAnbieten(versuche: number): boolean {
  return versuche >= NOTRUF_AB_VERSUCH
}

/** Wird noch automatisch weiterversucht? */
export function versuchtNoch(lage: Versandlage): boolean {
  return lage.laeuft || naechsteWartezeit(lage.versuche) !== null
}

/**
 * Ein Satz, der ohne Fachwissen sagt, woran man ist. Bewusst ohne
 * Beschönigung: Solange der Alarm nicht draussen ist, darf nichts danach
 * aussehen, als wäre er es.
 */
export function lagetext(lage: Versandlage): string {
  if (lage.laeuft) return `Versuch ${lage.versuche + 1} läuft …`
  const warten = naechsteWartezeit(lage.versuche)
  if (warten !== null) return `${lage.versuche} Versuch${lage.versuche === 1 ? '' : 'e'} fehlgeschlagen – nächster in ${Math.round(warten / 1000)} Sekunden`
  return `${lage.versuche} Versuche fehlgeschlagen. Die App versucht es nicht mehr von selbst.`
}
