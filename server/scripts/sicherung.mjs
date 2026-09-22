/**
 * Sicherung der Datenbank – auch im laufenden Betrieb.
 *
 *   npm run sicherung                 nach ~/sicherung, 30 Tage aufbewahren
 *   npm run sicherung -- /pfad 90     eigenes Ziel, 90 Tage aufbewahren
 *
 * SQLite legt mit «VACUUM INTO» eine in sich stimmige Kopie an, während der
 * Server weiterschreibt. Ein einfaches Kopieren der Datei wäre riskant: Die
 * zuletzt geschriebenen Daten stehen im Schreibprotokoll (-wal) und fehlten
 * in der Kopie. Das Ergebnis ist eine einzelne Datei ohne Begleitdateien.
 */
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { datenbankPfad, ladeEnv } from './pfade.mjs'

ladeEnv()

const quelle = datenbankPfad()
const ziel = resolve(process.argv[2] ?? process.env.SOBE_BACKUP_DIR ?? join(homedir(), 'sicherung'))
const tage = Number(process.argv[3] ?? process.env.SOBE_BACKUP_TAGE ?? 30)

if (!existsSync(quelle)) {
  console.error(`Keine Datenbank unter ${quelle}`)
  process.exit(1)
}
mkdirSync(ziel, { recursive: true })

const heute = new Date().toISOString().slice(0, 10)
const datei = join(ziel, `sobe-${heute}.sqlite`)
// Ein zweiter Lauf am selben Tag ersetzt die Sicherung; VACUUM INTO verlangt
// eine Datei, die es noch nicht gibt.
if (existsSync(datei)) rmSync(datei)

const db = new Database(quelle, { readonly: true })
db.prepare('VACUUM INTO ?').run(datei)
db.close()

const groesse = (statSync(datei).size / 1024).toFixed(0)
console.log(`Quelle:    ${quelle}`)
console.log(`Gesichert: ${datei} (${groesse} KB)`)

/**
 * Die Sicherung gegenprüfen, statt sie nur zu schreiben.
 *
 * Eine Kopie, die niemand liest, ist keine Sicherung. Kommt hier eine
 * Datenbank ohne Ereignisprotokoll heraus oder endet das Protokoll lange vor
 * heute, dann wurde die falsche Datei kopiert – das fällt sonst erst im
 * Ernstfall auf, wenn wiederhergestellt werden soll.
 */
const pruef = new Database(datei, { readonly: true })
try {
  const { anzahl, juengster } = pruef
    .prepare('SELECT COUNT(*) AS anzahl, MAX(ts) AS juengster FROM audit')
    .get()
  const alter = juengster ? Date.now() - juengster : null
  console.log(
    `Inhalt:    ${anzahl} Protokolleinträge, jüngster vom ` +
      (juengster ? new Date(juengster).toLocaleString('de-CH') : '–'),
  )
  if (alter === null || alter > 3 * 86_400_000) {
    console.error('')
    console.error('WARNUNG: Das Ereignisprotokoll dieser Sicherung endet vor mehr als drei Tagen.')
    console.error('Vermutlich wurde die falsche Datenbankdatei kopiert. Prüfen Sie den Pfad oben')
    console.error('und setzen Sie SOBE_DB_PATH in server/.env auf den absoluten Pfad.')
    process.exitCode = 2
  }
} catch (fehler) {
  console.error('')
  console.error(`WARNUNG: Die Sicherung enthält kein lesbares Ereignisprotokoll (${fehler.message}).`)
  console.error('Vermutlich wurde die falsche Datenbankdatei kopiert – Pfad oben prüfen.')
  process.exitCode = 2
} finally {
  pruef.close()
}

// Alte Sicherungen entfernen
const grenze = Date.now() - tage * 86_400_000
let entfernt = 0
for (const name of readdirSync(ziel)) {
  if (!/^sobe-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)) continue
  const pfad = join(ziel, name)
  if (statSync(pfad).mtimeMs < grenze) {
    rmSync(pfad)
    entfernt++
  }
}
if (entfernt) console.log(`${entfernt} Sicherung(en) älter als ${tage} Tage entfernt.`)
