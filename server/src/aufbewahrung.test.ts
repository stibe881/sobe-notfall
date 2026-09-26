import { unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Alarm } from './types.js'

// Eigene, isolierte Datenbankdatei. Wichtig: Ein normaler «import { db } from
// './db.js'» oben im Modul würde nicht reichen – ES-Module hieven statische
// Imports vor jede andere Anweisung, auch vor eine process.env-Zuweisung, die
// im Quelltext davor steht. db.ts läse dann noch die echte Entwicklungs-DB
// (SOBE_DB_PATH wäre zu diesem Zeitpunkt noch leer). Erst ein dynamisches
// import(), das an dieser Stelle im Code wirklich ausgeführt wird, garantiert
// die richtige Reihenfolge.
const DB_DATEI = join(tmpdir(), `sobe-aufbewahrung-test-${Date.now()}.sqlite`)
process.env.SOBE_DB_PATH = DB_DATEI
const { db } = await import('./db.js')
const { addAudit, findAlarm, raeumeAufbewahrungAuf, saveAlarm } = await import('./store.js')

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const JETZT = Date.now()
const TAG_MS = 86_400_000

let zaehler = 0
function alarm(patch: Partial<Alarm>): Alarm {
  return {
    id: `a-test-${++zaehler}`, scenarioId: 'sc-brand', message: 'Test', silent: false, requireAck: false,
    triggeredByUserId: 'u-1', triggeredVia: 'app', triggeredAt: JETZT, locationIds: [], groupIds: [],
    channels: ['push'], status: 'ended', escalationStage: 0, escalation: [], log: [],
    deliveries: [],
    ...patch,
  } as unknown as Alarm
}

/** Audit-Eintrag mit frei wählbarem Alter anlegen – addAudit selbst kennt nur «jetzt» */
function auditMitAlter(message: string, alter: number): void {
  addAudit('system', message)
  db.prepare('UPDATE audit SET ts = ? WHERE message = ?').run(JETZT - alter, message)
}

// --- 0 = unbegrenzt: nichts wird gelöscht ---
{
  const alt = alarm({ triggeredAt: JETZT - 3650 * TAG_MS })
  saveAlarm(alt)
  auditMitAlter('sehr alter Eintrag', 3650 * TAG_MS)

  raeumeAufbewahrungAuf({ alarmeTage: 0, uebungenTage: 0, auditTage: 0 })

  pruefe('Frist 0 löscht keinen uralten Alarm', findAlarm(alt.id) !== null)
  pruefe(
    'Frist 0 löscht keinen uralten Audit-Eintrag',
    (db.prepare('SELECT COUNT(*) AS n FROM audit WHERE message = ?').get('sehr alter Eintrag') as { n: number }).n === 1,
  )
}

// --- Echte Alarme und Übungsalarme laufen unter getrennten Fristen ---
{
  const echterAlt = alarm({ triggeredAt: JETZT - 40 * TAG_MS, drill: false })
  const echterNeu = alarm({ triggeredAt: JETZT - 10 * TAG_MS, drill: false })
  const uebungAlt = alarm({ triggeredAt: JETZT - 40 * TAG_MS, drill: true })
  const uebungNeu = alarm({ triggeredAt: JETZT - 10 * TAG_MS, drill: true })
  for (const a of [echterAlt, echterNeu, uebungAlt, uebungNeu]) saveAlarm(a)

  // Übungen nach 20 Tagen löschen, echte Alarme nach 100 – die Vorauswahl
  // (kürzeste aktive Frist) darf den 40 Tage alten echten Alarm trotzdem nicht
  // fälschlich mitlöschen.
  raeumeAufbewahrungAuf({ alarmeTage: 100, uebungenTage: 20, auditTage: 0 })

  pruefe('40 Tage alter echter Alarm bleibt (Frist 100 Tage)', findAlarm(echterAlt.id) !== null)
  pruefe('10 Tage alter echter Alarm bleibt (Frist 100 Tage)', findAlarm(echterNeu.id) !== null)
  pruefe('40 Tage alte Übung wird gelöscht (Frist 20 Tage)', findAlarm(uebungAlt.id) === null)
  pruefe('10 Tage alte Übung bleibt (Frist 20 Tage)', findAlarm(uebungNeu.id) !== null)
}

// --- Laufende Alarme werden nie gelöscht, auch wenn sie die Frist überschreiten ---
{
  const laufend = alarm({ triggeredAt: JETZT - 400 * TAG_MS, status: 'active', drill: false })
  saveAlarm(laufend)

  raeumeAufbewahrungAuf({ alarmeTage: 1, uebungenTage: 1, auditTage: 0 })

  pruefe('ein aktiver Alarm bleibt, egal wie alt', findAlarm(laufend.id) !== null)
}

// --- Audit-Log läuft unabhängig von den Alarm-Fristen ---
{
  auditMitAlter('wird gelöscht', 40 * TAG_MS)
  auditMitAlter('bleibt erhalten', 5 * TAG_MS)

  raeumeAufbewahrungAuf({ alarmeTage: 0, uebungenTage: 0, auditTage: 30 })

  const uebrig = (msg: string) => (db.prepare('SELECT COUNT(*) AS n FROM audit WHERE message = ?').get(msg) as { n: number }).n
  pruefe('Audit-Eintrag älter als die Frist wird gelöscht', uebrig('wird gelöscht') === 0)
  pruefe('Audit-Eintrag innerhalb der Frist bleibt', uebrig('bleibt erhalten') === 1)
}

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
db.close()
for (const endung of ['', '-wal', '-shm']) {
  try { unlinkSync(DB_DATEI + endung) } catch { /* muss nicht existieren */ }
}
if (fehler > 0) process.exit(1)
