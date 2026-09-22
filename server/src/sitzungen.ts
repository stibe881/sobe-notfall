/**
 * Wer ist gerade angemeldet – und wurden Passwörter durchprobiert?
 *
 *   npm run sitzungen              offene Anmeldungen und Fehlversuche zeigen
 *   npm run sitzungen -- beenden   alle Anmeldungen beenden (jede Person muss
 *                                  sich neu anmelden; Alarme bleiben unberührt)
 *
 * Gedacht für den Verdachtsfall: Im Ereignisprotokoll steht, dass sich jemand
 * angemeldet hat. Hier steht, ob diese Anmeldung noch offen ist, von welcher
 * Adresse und von welchem Gerät sie kam.
 */
import { db } from './db.js'
import { offeneSitzungen } from './auth.js'
import { allStoredUsers } from './store.js'

const zeit = (ts: number | null) => (ts ? new Date(ts).toLocaleString('de-CH') : '–')
const beenden = process.argv[2] === 'beenden'

const namen = new Map(allStoredUsers().map((u) => [u.id, `${u.firstName} ${u.lastName} (${u.email})`]))
const sitzungen = offeneSitzungen()

console.log('')
if (sitzungen.length === 0) {
  console.log('Keine offene Anmeldung.')
} else {
  console.log(`${sitzungen.length} offene Anmeldung(en):`)
  console.log('')
  for (const s of sitzungen) {
    console.log(`  ${namen.get(s.userId) ?? s.userId}`)
    console.log(`    angemeldet   ${zeit(s.createdAt)}`)
    console.log(`    zuletzt aktiv ${zeit(s.letzteAktivitaet)}`)
    console.log(`    Adresse      ${s.ip ?? 'nicht erfasst'}`)
    console.log(`    Gerät        ${s.geraet ?? 'nicht erfasst'}`)
    console.log('')
  }
  console.log('  Adresse und Gerät fehlen bei Anmeldungen von vor dieser Version.')
  console.log('')
}

const seit = Date.now() - 7 * 24 * 3600_000
const versuche = db
  .prepare('SELECT ts, email, ip, grund FROM login_versuche WHERE ts > ? ORDER BY ts DESC LIMIT 50')
  .all(seit) as { ts: number; email: string; ip: string | null; grund: string }[]

if (versuche.length === 0) {
  console.log('Keine fehlgeschlagenen Anmeldeversuche in den letzten sieben Tagen.')
} else {
  console.log(`${versuche.length} fehlgeschlagene Anmeldeversuche in den letzten sieben Tagen:`)
  for (const v of versuche) {
    console.log(`  ${zeit(v.ts).padEnd(22)} ${v.email.padEnd(34)} ${(v.ip ?? '–').padEnd(18)} ${v.grund}`)
  }
}
console.log('')

if (beenden) {
  const { changes } = db.prepare('DELETE FROM sessions').run()
  console.log(`${changes} Anmeldung(en) beendet. Alle müssen sich neu anmelden.`)
  console.log('')
}
