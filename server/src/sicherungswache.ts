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
  /**
   * Die Kopie an einem anderen Ort (SOBE_BACKUP_ZWEITZIEL). Eine Sicherung
   * auf demselben Rechner wie die Datenbank ist keine: Stirbt der Host oder
   * verschlüsselt ein Angreifer das Konto, sind beide weg.
   */
  extern: { lage: 'gut' | 'veraltet' | 'fehlt' | 'nicht-konfiguriert'; datei?: string; standZeit?: number; text: string }
}

/** Jüngste Sicherungsdatei in einem Ordner – oder null */
function juengsteDatei(ordner: string): { pfad: string; datei: string; ts: number } | null {
  let neuste: { pfad: string; datei: string; ts: number } | null = null
  for (const name of readdirSync(ordner)) {
    if (!/^sobe-.*\.sqlite$/.test(name)) continue
    const pfad = join(ordner, name)
    const ts = statSync(pfad).mtimeMs
    if (!neuste || ts > neuste.ts) neuste = { pfad, datei: name, ts }
  }
  return neuste
}

/** Zustand der externen Kopie – nach Inhalt, nicht nach Dateidatum */
export function pruefeExterneKopie(jetzt = Date.now()): Sicherungsbefund['extern'] {
  const ziel = process.env.SOBE_BACKUP_ZWEITZIEL
  if (!ziel) {
    return { lage: 'nicht-konfiguriert', text: 'Kein zweites Sicherungsziel gesetzt (SOBE_BACKUP_ZWEITZIEL) – die Sicherung liegt nur auf diesem Rechner.' }
  }
  let neuste: ReturnType<typeof juengsteDatei>
  try {
    neuste = juengsteDatei(resolve(ziel))
  } catch {
    return { lage: 'fehlt', text: `Zweites Sicherungsziel ${ziel} nicht lesbar – dort liegt keine Kopie.` }
  }
  if (!neuste) return { lage: 'fehlt', text: `Keine Kopie im zweiten Sicherungsziel ${ziel}.` }
  const zahlen = kennzahlen(neuste.pfad)
  if (!zahlen || zahlen.juengster === 0 || jetzt - zahlen.juengster > HOECHSTALTER_MS) {
    return {
      lage: 'veraltet', datei: neuste.datei, standZeit: zahlen?.juengster,
      text: `Die externe Kopie ${neuste.datei} ist veraltet oder unlesbar – der Sicherungslauf erreicht das Zweitziel nicht mehr.`,
    }
  }
  return { lage: 'gut', datei: neuste.datei, standZeit: zahlen.juengster, text: `Externe Kopie ${neuste.datei}, Stand ${new Date(zahlen.juengster).toLocaleString('de-CH')}.` }
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
  const extern = pruefeExterneKopie(jetzt)
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
    return { lage: 'keine', text: `Sicherungsordner ${ordner} nicht lesbar – es wird nichts gesichert.`, extern }
  }
  if (!neuste) {
    return { lage: 'keine', text: `Keine Sicherung in ${ordner} gefunden – es wird nichts gesichert.`, extern }
  }

  const gesichert = kennzahlen(neuste.pfad)
  if (!gesichert) {
    return {
      lage: 'unlesbar', datei: neuste.datei, dateiZeit: neuste.ts, extern,
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
      lage: 'veraltet', datei: neuste.datei, dateiZeit: neuste.ts, standZeit: gesichert.juengster, fehlend, extern,
      text:
        `Die jüngste Sicherung ${neuste.datei} trägt zwar das Datum vom ${new Date(neuste.ts).toLocaleString('de-CH')}, ` +
        `enthält aber nur Einträge bis ${gesichert.juengster ? new Date(gesichert.juengster).toLocaleString('de-CH') : 'unbekannt'}` +
        `${tage > 0 ? ` – ${tage} Tag(e) Rückstand` : ''}. Es fehlen ${fehlend} Protokolleinträge. ` +
        `Prüfen Sie den Sicherungslauf: Vermutlich kopiert er die falsche Datei.`,
    }
  }

  return {
    lage: 'gut', datei: neuste.datei, dateiZeit: neuste.ts, standZeit: gesichert.juengster, fehlend, extern,
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
  // Für die Meldung zählt die schlechtere der beiden Lagen: Eine gute lokale
  // Sicherung ohne externe Kopie ist ein Mangel, den jemand erfahren muss.
  const externSchlecht = befund.extern.lage !== 'gut'
  const lageGesamt = befund.lage !== 'gut' ? befund.lage : externSchlecht ? `extern-${befund.extern.lage}` : 'gut'
  const vorher = zuletztGemeldet()
  const gleich = vorher.lage === lageGesamt
  if (gleich && jetzt - vorher.ts < MELDUNG_ABSTAND_MS) return befund
  // Ein stiller Normalzustand: «gut» wird nur gemeldet, wenn vorher etwas war
  if (lageGesamt === 'gut' && (vorher.lage === '' || vorher.lage === 'gut')) {
    setSetting('sicherungswacheGemeldet', JSON.stringify({ lage: 'gut', ts: jetzt }))
    return befund
  }
  setSetting('sicherungswacheGemeldet', JSON.stringify({ lage: lageGesamt, ts: jetzt }))
  if (lageGesamt === 'gut') {
    protokoll(`Sicherung wieder in Ordnung: ${befund.text} ${befund.extern.text}`)
    await melden('Die Sicherung ist wieder in Ordnung – lokal und extern.')
    return befund
  }
  const text = befund.lage !== 'gut' ? befund.text : befund.extern.text
  protokoll(`Sicherung beanstandet: ${text}`)
  await melden(text)
  return befund
}
