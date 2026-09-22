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
import { datenbankPfad, ladeEnv } from './pfade.mjs'

ladeEnv()

const quelle = datenbankPfad()
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

// Kennungen sammeln statt Treffer zählen: dieselbe fehlende Zeile steht meist
// in mehreren Sicherungen und würde sonst mehrfach gezählt
const fehlendGesamt = new Set()
let unlesbar = 0
let veraltet = 0
const juengste = new Set()

for (const name of dateien) {
  const s = lies(join(sicherungen, name))
  if (s.fehler) {
    unlesbar++
    console.log(`  ${name}   NICHT LESBAR (${s.fehler})`)
    continue
  }
  // Einträge, die diese Sicherung kennt, die laufende Datei aber nicht mehr
  const fehlend = [...s.ids].filter((id) => !live.ids.has(id))
  for (const id of fehlend) fehlendGesamt.add(id)
  juengste.add(s.juengster ?? 0)
  // Eine Sicherung vom 20. September, deren Protokoll am 4. September endet,
  // stammt nicht aus der laufenden Datenbank
  const stichtag = new Date(`${name.slice(5, 15)}T00:00:00`).getTime()
  const hinkt = !s.juengster || stichtag - s.juengster > 2 * 86_400_000
  if (hinkt) veraltet++
  console.log(
    `  ${name}   ${String(s.anzahl).padStart(4)} Einträge, bis ${zeit(s.juengster)}` +
      (fehlend.length ? `   ← ${fehlend.length} davon fehlen in der laufenden Datenbank` : '') +
      (hinkt ? '   ← VERALTET' : ''),
  )
}

console.log('')
if (fehlendGesamt.size === 0) {
  console.log('Ereignisprotokoll: Keine Sicherung enthält Einträge, die der laufenden')
  console.log('Datenbank fehlen. Es ist nichts verloren gegangen.')
} else {
  console.log(`Ereignisprotokoll: ${fehlendGesamt.size} Einträge stehen in Sicherungen, aber nicht mehr in`)
  console.log('der laufenden Datenbank. Der Server hat zwischenzeitlich auf eine andere Datei')
  console.log('geschrieben oder wurde zurückgesetzt. Überschreiben Sie nichts, bevor die')
  console.log('Ursache geklärt ist.')
}

/**
 * Der Zustand der Sicherungen wird eigens beurteilt.
 *
 * Der Abgleich oben kann nur finden, was in einer Sicherung überhaupt steht.
 * Kopiert der Sicherungslauf seit Wochen eine verwaiste Datei, sähe er sauber
 * aus, obwohl es in Wahrheit keine brauchbare Sicherung gibt – das ist die
 * gefährlichere Lage und gehört getrennt benannt.
 */
console.log('')
if (dateien.length === 0) {
  console.log('Sicherungen: Keine gefunden. Richten Sie «npm run sicherung» als täglichen')
  console.log('Cron-Eintrag ein (siehe Handbuch 4).')
} else if (veraltet === 0 && unlesbar === 0) {
  console.log(`Sicherungen: ${dateien.length} vorhanden, alle lesbar und aktuell.`)
} else {
  console.log(`Sicherungen: ${veraltet} veraltet, ${unlesbar} unlesbar von ${dateien.length}.`)
  if (juengste.size === 1 && veraltet > 1) {
    console.log('Alle haben denselben jüngsten Eintrag – der Sicherungslauf kopiert seit')
    console.log('längerem dieselbe, nicht mehr benutzte Datenbankdatei.')
  }
  console.log('')
  console.log('Das heisst: Für diesen Zeitraum gibt es keine brauchbare Sicherung.')
  console.log('Der Sicherungslauf liest eine andere Datei als der Server. Prüfen Sie den')
  console.log('Cron-Eintrag und setzen Sie SOBE_DB_PATH in server/.env auf den absoluten')
  console.log(`Pfad: ${quelle}`)
  console.log('Danach «npm run sicherung» einmal von Hand ausführen und die Ausgabe prüfen.')
  process.exitCode = 2
}
