/**
 * Symbol und Farbe je Notfallnummer.
 *
 * Unter Druck liest niemand Text – man sucht die Form und die Farbe. Deshalb
 * bekommt jede Nummer ein eigenes Symbol statt überall desselben Hörers, und
 * die Farbe unterscheidet die Art der Hilfe: Rot für Gefahr in Verzug,
 * Bernstein für Beratung, Grau für alles Übrige.
 *
 * Die Zuordnung hängt an der **Nummer**, nicht am Namen – die Schweizer
 * Notrufnummern sind eindeutig, ein umbenannter Eintrag bleibt dadurch
 * richtig. Für eigene Einträge greift eine Suche nach Stichworten im Namen,
 * und zuletzt der Hörer als Rückfallebene.
 */

export type NotrufSymbol =
  | 'shield' | 'flame' | 'ambulance' | 'plane' | 'flask'
  | 'hand' | 'baby' | 'globe' | 'phone'

export type NotrufFarbe = 'rot' | 'bernstein' | 'grau'

export interface Notrufbild {
  symbol: NotrufSymbol
  farbe: NotrufFarbe
}

/** Nur Ziffern – «144», «+41 144» und «144 » sollen dasselbe sein */
function ziffern(nummer: string): string {
  return nummer.replace(/\D/g, '')
}

const NACH_NUMMER: Record<string, Notrufbild> = {
  '117': { symbol: 'shield', farbe: 'rot' },       // Polizei
  '118': { symbol: 'flame', farbe: 'rot' },        // Feuerwehr
  '144': { symbol: 'ambulance', farbe: 'rot' },    // Sanität
  '112': { symbol: 'globe', farbe: 'rot' },        // Europäischer Notruf
  '1414': { symbol: 'plane', farbe: 'rot' },       // Rega
  '145': { symbol: 'flask', farbe: 'bernstein' },  // Tox Info Suisse
  '143': { symbol: 'hand', farbe: 'bernstein' },   // Dargebotene Hand
  '147': { symbol: 'baby', farbe: 'bernstein' },   // Pro Juventute
}

const NACH_STICHWORT: { woerter: string[]; bild: Notrufbild }[] = [
  { woerter: ['polizei', 'police'], bild: { symbol: 'shield', farbe: 'rot' } },
  { woerter: ['feuer', 'brand'], bild: { symbol: 'flame', farbe: 'rot' } },
  { woerter: ['sanität', 'sanitaet', 'ambulanz', 'rettung', 'notarzt'], bild: { symbol: 'ambulance', farbe: 'rot' } },
  { woerter: ['rega', 'helikopter', 'flug'], bild: { symbol: 'plane', farbe: 'rot' } },
  { woerter: ['gift', 'tox', 'vergiftung'], bild: { symbol: 'flask', farbe: 'bernstein' } },
  { woerter: ['seelsorge', 'hand', 'beratung', 'sorgen'], bild: { symbol: 'hand', farbe: 'bernstein' } },
  { woerter: ['jugend', 'kinder', 'juventute'], bild: { symbol: 'baby', farbe: 'bernstein' } },
]

/**
 * Passendes Bild zu einem Notfallkontakt.
 *
 * Erst die Nummer, dann Stichworte im Namen, zuletzt der Hörer. So bekommt
 * auch ein selbst erfasster Eintrag wie «Gemeindepolizei Baar» das Schild.
 */
export function notrufbild(name: string, nummer: string): Notrufbild {
  const nach = NACH_NUMMER[ziffern(nummer)]
  if (nach) return nach
  const klein = name.toLowerCase()
  for (const { woerter, bild } of NACH_STICHWORT) {
    if (woerter.some((w) => klein.includes(w))) return bild
  }
  return { symbol: 'phone', farbe: 'grau' }
}
