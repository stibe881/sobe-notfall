/**
 * Konfigurationsbefehle für die Alarmknöpfe.
 *
 * Wie lange eine Taste gedrückt werden muss, entscheidet das Gerät, nicht der
 * Alarmserver. Geändert wird es mit einem Downlink – einem Funkbefehl, den der
 * Netzserver im Gateway in die Warteschlange legt.
 *
 * **Der Alarmserver kann diesen Befehl nicht selbst senden.** Das Gateway steht
 * im Schulhaus hinter dem Router, der Alarmserver beim Hoster; alle
 * Verbindungen gehen von innen nach aussen. Genau das macht die Einrichtung
 * einfach – und verschliesst zugleich den Rückweg.
 *
 * Was hier bleibt, ist die Rechenarbeit: Das Portal bildet den fertigen
 * Hex-Befehl, der im Gateway nur noch einzufügen ist.
 */

export interface Haltezeit {
  /** Kleinster einstellbarer Wert */
  min: number
  /** Grösster einstellbarer Wert */
  max: number
  einheit: 'Sekunden' | 'Millisekunden'
  /** Übliche Werkseinstellung – nur als Anhaltspunkt */
  werk: number
  /** Schrittweite der Eingabe */
  schritt: number
  /** Hinweis zur Einstellung, sofern die Herstellerangabe unklar ist */
  vorbehalt?: string
}

export const HALTEZEIT: Record<string, Haltezeit> = {
  'dragino-trackerd': { min: 0, max: 10, einheit: 'Sekunden', werk: 5, schritt: 1 },
  'dragino-pb01': {
    min: 0, max: 1000, einheit: 'Millisekunden', werk: 0, schritt: 50,
    vorbehalt:
      'Die Herstellerdokumentation nennt 0 bis 1000 Millisekunden, widerspricht sich an anderer Stelle aber selbst. ' +
      'Prüfen Sie am Gerät, ob der gewünschte Wert wirklich gilt.',
  },
}

/** Zahl als Hex-Bytes, links mit Nullen aufgefüllt */
function hex(wert: number, bytes: number): string {
  return Math.round(wert).toString(16).toUpperCase().padStart(bytes * 2, '0')
}

export interface Befehl {
  /** Hex-Bytes für das Feld «HEX Bytes» im Downlink des Gateways */
  downlink: string
  /** Derselbe Befehl über die Kabelverbindung */
  at: string
}

/**
 * Befehl für die Haltezeit bilden.
 *
 * TrackerD: `BA` + ein Byte Sekunden. PB01: `A2` + zwei Byte Millisekunden.
 * Werte ausserhalb des zulässigen Bereichs werden begrenzt statt abgewiesen –
 * es ist eine Eingabehilfe, kein Formular, das jemanden aufhält.
 */
export function haltezeitBefehl(geraetetyp: string | undefined, wert: number): Befehl | null {
  const grenzen = geraetetyp ? HALTEZEIT[geraetetyp] : undefined
  if (!grenzen) return null
  const gekappt = Math.min(grenzen.max, Math.max(grenzen.min, Math.round(wert)))
  if (geraetetyp === 'dragino-trackerd') {
    return { downlink: `BA${hex(gekappt, 1)}`, at: `AT+EAT=${gekappt}` }
  }
  return { downlink: `A2${hex(gekappt, 2)}`, at: `AT+STIME=${gekappt}` }
}
