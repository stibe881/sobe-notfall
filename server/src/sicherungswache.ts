import Database from 'better-sqlite3'
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { db, getSetting, setSetting } from './db.js'

/**
 * Wachhund über die Sicherungen.
 *
 * Eine Sicherung mit frischem Datum ist noch keine brauchbare Sicherung. Genau
 * daran ist dieses System schon einmal vorbeigelaufen: Der Sicherungslauf
 * schrieb täglich eine Datei, doch wegen eines relativ aufgelösten Pfades
 * kopierte er wochenlang dieselbe veraltete Datenbank. Die Dateiliste sah
 * tadellos aus, die Dateien waren wertlos, und es fiel niemandem auf.
 *
 * Deshalb prüft der Server nicht das Änderungsdatum, sondern den **Inhalt**:
 * Wie viele Einträge hat das Ereignisprotokoll der Sicherung, und wie alt ist
 * ihr jüngster? Weicht das vom Livebestand ab, stimmt etwas nicht – ganz
 * gleich, wie frisch der Zeitstempel der Datei ist.
 */

/** Ab dieser Rückstandsdauer gilt eine Sicherung als veraltet */
const HOECHSTALTER_MS = 48 * 3600_000
/** Nicht öfter als einmal täglich melden – eine Warnung, die nervt, wird abgeschaltet */
const MELDUNG_ABSTAND_MS = 24 * 3600_000

export type Sicherungslage = 'gut' | 'veraltet' | 'unlesbar' | 'keine'

export interface Sicherungsbefund {
  lage: Sicherungslage
  /** Name der jüngsten Sicherungsdatei */
  datei?: string
  /** Änderungsdatum der Datei – sagt für sich allein nichts über den Inhalt */
  dateiZeit?: number
  /** Jüngster Protokolleintrag **in der Sicherung** – das ist der ehrliche Stand */
  standZeit?: number
  /** Wie viele Protokolleinträge dem Livebestand gegenüber fehlen */
  fehlend?: number
  /** Klartext für Portal und Meldung */
  text: string
}

function sicherungsordner(): string {
  return resolve(process.env.SOBE_BACKUP_DIR ?? join(homedir(), 'sicherung'))
}

/** Kennzahlen des Ereignisprotokolls einer Datei */
function kennzahlen(pfad: string): { anzahl: number; juengster: number } | null {
  let datenbank: Database.Database | null = null
  try {
    datenbank = new Database(pfad, { readonly: true, fileMustExist: true })
    const zeile = datenbank
      .prepare('SELECT COUNT(*) AS anzahl, MAX(ts) AS juengster FROM audit')
      .get() as { anzahl: number; juengster: number | null }
    return { anzahl: zeile.anzahl, juengster: zeile.juengster ?? 0 }
  } catch {
    return null
  } finally {
    datenbank?.close()
  }
}

/**
 * Die jüngste Sicherung dem Livebestand gegenüberstellen.
 *
 * Bewertet wird nach dem Inhalt, nicht nach dem Dateidatum: Eine Sicherung von
 * heute Morgen, deren jüngster Eintrag drei Wochen alt ist, gilt als veraltet.
 */
export function pruefeSicherung(jetzt = Date.now()): Sicherungsbefund {
  const ordner = sicherungsordner()
  let neuste: { pfad: string; datei: string; ts: number } | null = null
  try {
    for (const name of readdirSync(ordner)) {
      if (!/^sobe-.*\.sqlite$/.test(name)) continue
      const pfad = join(ordner, name)
      const ts = statSync(pfad).mtimeMs
      if (!neuste || ts > neuste.ts) neuste = { pfad, datei: name, ts }
    }
  } catch {
    return { lage: 'keine', text: `Sicherungsordner ${ordner} nicht lesbar – es wird nichts gesichert.` }
  }
  if (!neuste) {
    return { lage: 'keine', text: `Keine Sicherung in ${ordner} gefunden – es wird nichts gesichert.` }
  }

  const gesichert = kennzahlen(neuste.pfad)
  if (!gesichert) {
    return {
      lage: 'unlesbar', datei: neuste.datei, dateiZeit: neuste.ts,
      text: `Die jüngste Sicherung ${neuste.datei} lässt sich nicht lesen – sie taugt nicht zur Wiederherstellung.`,
    }
  }

  const live = db
    .prepare('SELECT COUNT(*) AS anzahl, MAX(ts) AS juengster FROM audit')
    .get() as { anzahl: number; juengster: number | null }
  const fehlend = Math.max(0, live.anzahl - gesichert.anzahl)
  const rueckstand = jetzt - gesichert.juengster

  if (gesichert.juengster === 0 || rueckstand > HOECHSTALTER_MS) {
    const tage = Math.floor(rueckstand / 86_400_000)
    return {
      lage: 'veraltet', datei: neuste.datei, dateiZeit: neuste.ts, standZeit: gesichert.juengster, fehlend,
      text:
        `Die jüngste Sicherung ${neuste.datei} trägt zwar das Datum vom ${new Date(neuste.ts).toLocaleString('de-CH')}, ` +
        `enthält aber nur Einträge bis ${gesichert.juengster ? new Date(gesichert.juengster).toLocaleString('de-CH') : 'unbekannt'}` +
        `${tage > 0 ? ` – ${tage} Tag(e) Rückstand` : ''}. Es fehlen ${fehlend} Protokolleinträge. ` +
        `Prüfen Sie den Sicherungslauf: Vermutlich kopiert er die falsche Datei.`,
    }
  }

  return {
    lage: 'gut', datei: neuste.datei, dateiZeit: neuste.ts, standZeit: gesichert.juengster, fehlend,
    text: `Sicherung ${neuste.datei} vom ${new Date(gesichert.juengster).toLocaleString('de-CH')}, ${gesichert.anzahl} Protokolleinträge.`,
  }
}

/** Zuletzt gemeldete Lage – damit dieselbe Störung nicht täglich neu aufschreckt */
function zuletztGemeldet(): { lage: string; ts: number } {
  const roh = getSetting('sicherungswacheGemeldet')
  if (!roh) return { lage: '', ts: 0 }
  try {
    return JSON.parse(roh) as { lage: string; ts: number }
  } catch {
    return { lage: '', ts: 0 }
  }
}

/**
 * Täglicher Blick auf die Sicherung. Meldet der Administration, sobald etwas
 * nicht stimmt – und einmal, wenn es wieder stimmt, damit klar ist, dass die
 * Störung behoben ist.
 */
export async function ueberwacheSicherung(
  jetzt: number,
  melden: (text: string) => Promise<void>,
  protokoll: (text: string) => void,
): Promise<Sicherungsbefund> {
  const befund = pruefeSicherung(jetzt)
  const vorher = zuletztGemeldet()
  const gleich = vorher.lage === befund.lage
  if (gleich && jetzt - vorher.ts < MELDUNG_ABSTAND_MS) return befund
  // Ein stiller Normalzustand: «gut» wird nur gemeldet, wenn vorher etwas war
  if (befund.lage === 'gut' && (vorher.lage === '' || vorher.lage === 'gut')) {
    setSetting('sicherungswacheGemeldet', JSON.stringify({ lage: 'gut', ts: jetzt }))
    return befund
  }
  setSetting('sicherungswacheGemeldet', JSON.stringify({ lage: befund.lage, ts: jetzt }))
  if (befund.lage === 'gut') {
    protokoll(`Sicherung wieder in Ordnung: ${befund.text}`)
    await melden('Die Sicherung ist wieder in Ordnung.')
    return befund
  }
  protokoll(`Sicherung beanstandet: ${befund.text}`)
  await melden(befund.text)
  return befund
}
