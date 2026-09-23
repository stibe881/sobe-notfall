/**
 * Nutzlast bekannter Geräte im Alarmserver übersetzen.
 *
 * Normalerweise übersetzt der Netzserver die rohen Funkbytes, bevor er sie
 * weiterreicht. Der in Gateways eingebaute Netzserver kann das oft nicht: Beim
 * RAK WisGate stehen als Payload-Format nur «None» und «CayenneLPP» zur
 * Auswahl – für ein Gerät, das weder das eine noch das andere spricht, bliebe
 * der Knopfdruck unerkannt.
 *
 * Deshalb übersetzt der Alarmserver die Nutzlast der hier hinterlegten Modelle
 * selbst. Das ist zugleich der robustere Weg: ein Decoder weniger, der im
 * Gateway gepflegt werden muss, und er gilt unverändert weiter, falls das Netz
 * später über einen anderen Netzserver läuft.
 *
 * **Übersetzt wird nur, was für die Alarmierung zählt: Alarmzustand und
 * Batterie.** Position und Messwerte bleiben aussen vor – ihre Byte-Reihenfolge
 * ist der Herstellerdokumentation nicht zweifelsfrei zu entnehmen, und eine
 * falsch gedeutete Koordinate wäre schlechter als gar keine.
 *
 * Quellen der Byte-Tabellen:
 *   TrackerD https://docs.dragino.com/docs/LoRaWAN-End-Node/trackers-buttons-beacons/trackerd/
 *   PB01     https://docs.dragino.com/docs/LoRaWAN-End-Node/trackers-buttons-beacons/pb01/
 */

export interface GeraeteTyp {
  id: string
  name: string
  /** Kurzhinweis für die Auswahl im Portal */
  hinweis: string
}

/** Auswahl im Portal. 'auto' heisst: Der Netzserver übersetzt, nicht wir. */
export const GERAETETYPEN: GeraeteTyp[] = [
  {
    id: 'auto',
    name: 'Netzserver übersetzt (Standard)',
    hinweis: 'Im Netzserver ist ein Payload-Decoder hinterlegt. Gilt für alle Geräte, die hier nicht aufgeführt sind.',
  },
  {
    id: 'dragino-trackerd',
    name: 'Dragino TrackerD',
    hinweis: 'Ortungsgerät mit roter Alarmtaste. Der Alarmserver übersetzt die Nutzlast selbst – im Netzserver ist kein Decoder nötig.',
  },
  {
    id: 'dragino-pb01',
    name: 'Dragino PB01',
    hinweis: 'Notfallknopf. Der Alarmserver übersetzt die Nutzlast selbst – im Netzserver ist kein Decoder nötig.',
  },
]

export interface RohErgebnis {
  alarm: boolean
  /** Zellspannung in Millivolt – die Umrechnung in Prozent macht der Aufrufer */
  batterieMv?: number
}

/**
 * Rohdaten in Bytes wandeln.
 *
 * Der Netzserver schickt sie je nach Einstellung Base64-kodiert oder als
 * Hex-Zeichenkette. Welche der beiden Lesarten stimmt, entscheidet die Länge:
 * Nur eine davon ergibt eine Nutzlast, die das Gerät überhaupt sendet.
 */
export function bytesAus(daten: string): number[][] {
  const kandidaten: number[][] = []
  const text = daten.trim()
  if (!text) return kandidaten
  if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
    kandidaten.push([...Buffer.from(text, 'hex')])
  }
  try {
    const roh = Buffer.from(text, 'base64')
    if (roh.length > 0) kandidaten.push([...roh])
  } catch {
    // keine gültige Base64-Zeichenkette
  }
  return kandidaten
}

/**
 * Dragino TrackerD.
 *
 * Alle Nutzlasten tragen dasselbe Zwei-Byte-Feld «Alarm & BAT»:
 * ein reserviertes Bit, ein Alarmbit, vierzehn Bit Spannung in Millivolt.
 * Nur seine Lage im Paket hängt vom Port ab.
 */
function trackerD(bytes: number[], fPort?: number): RohErgebnis | null {
  const alarmUndBat = (pos: number): RohErgebnis | null => {
    if (bytes.length < pos + 2) return null
    const hoch = bytes[pos]
    return { alarm: (hoch & 0x40) !== 0, batterieMv: ((hoch & 0x3f) << 8) | bytes[pos + 1] }
  }

  // Port 7: reine Alarmmeldung, drei Byte, Feld ganz vorn
  if (fPort === 7 && bytes.length >= 2) return alarmUndBat(0)
  // Port 3: Standardbetrieb, elf Byte – Position, Feld, Kennzeichen
  if (fPort === 3 && bytes.length >= 10) return alarmUndBat(8)
  // Port 2: wie Port 3, ab Firmware 1.5.4 mit Geschwindigkeit und Kurs davor
  if (fPort === 2) return alarmUndBat(bytes.length >= 15 ? 12 : 8)
  // Port 5: Gerätezustand – nur Spannung, nie ein Alarm
  if (fPort === 5 && bytes.length >= 7) {
    return { alarm: false, batterieMv: (bytes[5] << 8) | bytes[6] }
  }
  return null
}

/**
 * Dragino PB01.
 *
 * Port 2, acht Byte: Spannung (2), Ton-Kennzeichen (1), Alarm (1),
 * Temperatur (2), Feuchte (2). Die oberen Bits der Spannung werden
 * vorsorglich ausmaskiert – jede denkbare Zellspannung passt in vierzehn Bit.
 */
function pb01(bytes: number[], fPort?: number): RohErgebnis | null {
  if (fPort === 5 && bytes.length >= 7) {
    return { alarm: false, batterieMv: ((bytes[5] << 8) | bytes[6]) & 0x3fff }
  }
  if (bytes.length >= 4) {
    return { alarm: bytes[3] !== 0, batterieMv: ((bytes[0] << 8) | bytes[1]) & 0x3fff }
  }
  return null
}

/**
 * Nutzlast eines bekannten Modells übersetzen.
 *
 * Passt keine der Lesarten der Rohdaten zum Gerät, wird nichts zurückgegeben –
 * lieber keine Aussage als eine erfundene. Der Uplink erscheint dann in
 * «Letzte Uplinks» als «ohne übersetzte Nutzlast», und die Einrichtung merkt es.
 */
export function dekodiere(typ: string | undefined, daten: string, fPort?: number): RohErgebnis | null {
  const geraet = typ === 'dragino-trackerd' ? trackerD : typ === 'dragino-pb01' ? pb01 : null
  if (!geraet) return null
  for (const bytes of bytesAus(daten)) {
    const ergebnis = geraet(bytes, fPort)
    if (ergebnis) return ergebnis
  }
  return null
}
