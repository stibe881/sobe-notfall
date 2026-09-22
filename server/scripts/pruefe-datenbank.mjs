/**
 * Prüft, mit welcher Datenbank der Server arbeitet und ob das Ereignisprotokoll
 * lückenlos ist – die laufende Datei und jede Sicherung im Vergleich.
 *
 *   npm run pruefe-datenbank                nach ~/sicherung schauen
 *   npm run pruefe-datenbank -- /pfad       eigener Sicherungsordner
 *
 * Aufzurufen aus dem Ordner server/, damit der Pfad genauso aufgelöst wird wie
 * beim Serverstart. Fehlen in der laufenden Datei Einträge, die eine Sicherung
 * noch hat, steht es in der Zusammenfassung.
 */
import Database from 'better-sqlite3'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const envDatei = resolve(process.env.SOBE_ENV_FILE ?? '.env')
if (existsSync(envDatei)) process.loadEnvFile(envDatei)

const quelle = resolve(process.env.SOBE_DB_PATH ?? 'data/sobe-notfall.sqlite')
const sicherungen = resolve(process.argv[2] ?? process.env.SOBE_BACKUP_DIR ?? join(homedir(), 'sicherung'))

const zeit = (ts) => (ts ? new Date(ts).toLocaleString('de-CH') : '–')
const tag = (ts) => new Date(ts).toISOString().slice(0, 10)

/** Kennzahlen des Ereignisprotokolls einer Datei; null, wenn sie nicht lesbar ist */
function lies(pfad) {
  try {
    const db = new Database(pfad, { readonly: true })
    const { anzahl, aeltester, juengster } = db
      .prepare('SELECT COUNT(*) AS anzahl, MIN(ts) AS aeltester, MAX(ts) AS juengster FROM audit')
      .get()
    const proTag = new Map()
    for (const { ts } of db.prepare('SELECT ts FROM audit').all()) {
      const t = tag(ts)
      proTag.set(t, (proTag.get(t) ?? 0) + 1)
    }
    const ids = new Set(db.prepare('SELECT id FROM audit').all().map((r) => r.id))
    const alarme = db.prepare('SELECT COUNT(*) AS n FROM alarms').get().n
    db.close()
    return { anzahl, aeltester, juengster, proTag, ids, alarme, groesse: statSync(pfad).size }
  } catch (fehler) {
    return { fehler: fehler.message }
  }
}

console.log('Laufende Datenbank')
console.log(`  Pfad            ${quelle}`)
if (!existsSync(quelle)) {
  console.log('  FEHLT – der Server hat hier noch nie geschrieben oder arbeitet anderswo.')
  console.log('  Ursache meist: SOBE_DB_PATH ist nicht gesetzt, und der Server wurde aus')
  console.log('  einem anderen Verzeichnis gestartet. Tragen Sie den absoluten Pfad in .env ein.')
  process.exit(1)
}

const live = lies(quelle)
if (live.fehler) {
  console.log(`  NICHT LESBAR – ${live.fehler}`)
  process.exit(1)
}
console.log(`  Grösse          ${(live.groesse / 1024).toFixed(0)} KB`)
console.log(`  Geändert        ${zeit(statSync(quelle).mtimeMs)}`)
console.log(`  Protokoll       ${live.anzahl} Einträge, ${zeit(live.aeltester)} bis ${zeit(live.juengster)}`)
console.log(`  Alarme          ${live.alarme}`)

console.log('\nEinträge pro Tag (laufende Datenbank)')
for (const t of [...live.proTag.keys()].sort().slice(-14)) {
  console.log(`  ${t}   ${String(live.proTag.get(t)).padStart(4)}`)
}

if (!existsSync(sicherungen)) {
  console.log(`\nKein Sicherungsordner unter ${sicherungen} – Vergleich nicht möglich.`)
  process.exit(0)
}

console.log(`\nSicherungen in ${sicherungen}`)
const dateien = readdirSync(sicherungen)
  .filter((n) => /^sobe-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n))
  .sort()

let verloren = 0
for (const name of dateien) {
  const s = lies(join(sicherungen, name))
  if (s.fehler) {
    console.log(`  ${name}   NICHT LESBAR (${s.fehler})`)
    continue
  }
  // Einträge, die diese Sicherung kennt, die laufende Datei aber nicht mehr
  const fehlend = [...s.ids].filter((id) => !live.ids.has(id)).length
  verloren += fehlend
  console.log(
    `  ${name}   ${String(s.anzahl).padStart(4)} Einträge, bis ${zeit(s.juengster)}` +
      (fehlend ? `   ← ${fehlend} davon fehlen in der laufenden Datenbank` : ''),
  )
}

console.log('')
if (verloren === 0) {
  console.log('Ergebnis: Keine Sicherung enthält Protokolleinträge, die der laufenden')
  console.log('Datenbank fehlen. Das Ereignisprotokoll ist vollständig.')
} else {
  console.log(`Ergebnis: ${verloren} Protokolleinträge stehen in Sicherungen, aber nicht mehr in der`)
  console.log('laufenden Datenbank. Der Server hat zwischenzeitlich auf eine andere Datei')
  console.log('geschrieben oder wurde zurückgesetzt. Setzen Sie SOBE_DB_PATH in server/.env')
  console.log('auf den absoluten Pfad und melden Sie sich, bevor Sie etwas überschreiben.')
}
