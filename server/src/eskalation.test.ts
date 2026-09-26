import { eskalationsentscheid } from './eskalation.js'
import type { Alarm, EscalationLevel } from './types.js'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const JETZT = 1_700_000_000_000
const VOR_FUENF_MINUTEN = JETZT - 5 * 60_000

function alarm(zusagen: string[] = [], abgelehnt: string[] = []): Alarm {
  const dlv = (userId: string, ack: 'none' | 'acknowledged' | 'declined') =>
    ({ id: 'd-' + userId + ack, userId, channel: 'push' as const, status: 'delivered' as const, ack, updatedAt: JETZT })
  return {
    id: 'a-1', title: 'Brand', message: '', priority: 'hoch', status: 'active',
    triggeredAt: VOR_FUENF_MINUTEN, triggeredBy: 'u-1', triggeredVia: 'app',
    silent: false, requireAck: true, channels: ['push'], groupIds: ['gr-alle'], locationIds: [],
    escalationStage: 0, escalation: [], log: [],
    deliveries: [
      ...['u-1', 'u-2', 'u-3'].map((u) => dlv(u, 'none')),
      ...zusagen.map((u) => dlv(u, 'acknowledged')),
      ...abgelehnt.map((u) => dlv(u, 'declined')),
    ],
  } as unknown as Alarm
}

const stufe = (patch: Partial<EscalationLevel> = {}): EscalationLevel =>
  ({ afterMinutes: 3, channels: ['voice'], groupIds: ['gr-evak'], notifyEmergencyServices: false, ...patch })

const EVAK = [{ id: 'u-evak1' }, { id: 'u-evak2' }]

// --- Frist ---
pruefe('vor Ablauf der Frist wird gewartet',
  eskalationsentscheid(alarm(), stufe({ afterMinutes: 10 }), EVAK, JETZT).art === 'warten')
pruefe('genau auf der Frist wird noch gewartet',
  eskalationsentscheid(alarm(), stufe({ afterMinutes: 5 }), EVAK, JETZT).art === 'warten')
pruefe('nach der Frist wird aufgeboten',
  eskalationsentscheid(alarm(), stufe({ afterMinutes: 3 }), EVAK, JETZT).art === 'aufbieten')

// --- Der behobene Fehler: eine Zusage darf den geplanten Ablauf nicht abschalten ---
pruefe('geplanter Ablauf zündet trotz einer Zusage',
  eskalationsentscheid(alarm(['u-2']), stufe(), EVAK, JETZT).art === 'aufbieten')
pruefe('geplanter Ablauf zündet auch, wenn alle Erstalarmierten zugesagt haben',
  eskalationsentscheid(alarm(['u-1', 'u-2', 'u-3']), stufe(), EVAK, JETZT).art === 'aufbieten')
pruefe('fehlendes Kennzeichen gilt als geplanter Ablauf',
  eskalationsentscheid(alarm(['u-2']), stufe({ nurWennUnbeantwortet: undefined }), EVAK, JETZT).art === 'aufbieten')

// --- Rückfallebene ---
pruefe('Rückfallebene entfällt bei einer Zusage',
  eskalationsentscheid(alarm(['u-2']), stufe({ nurWennUnbeantwortet: true }), EVAK, JETZT).art === 'entfaellt')
pruefe('Rückfallebene zündet ohne Zusage',
  eskalationsentscheid(alarm(), stufe({ nurWennUnbeantwortet: true }), EVAK, JETZT).art === 'aufbieten')
pruefe('eine Absage ist keine Zusage – die Rückfallebene zündet',
  eskalationsentscheid(alarm([], ['u-2']), stufe({ nurWennUnbeantwortet: true }), EVAK, JETZT).art === 'aufbieten')
pruefe('Grund der Rückfallebene ist nachvollziehbar', (() => {
  const e = eskalationsentscheid(alarm(['u-2']), stufe({ nurWennUnbeantwortet: true }), EVAK, JETZT)
  return e.art === 'entfaellt' && e.grund.includes('Rückfallebene')
})())

// --- Wer aufgeboten wird ---
pruefe('wer schon zugesagt hat, wird nicht erneut angeklingelt', (() => {
  const e = eskalationsentscheid(alarm(['u-evak1']), stufe(), EVAK, JETZT)
  return e.art === 'aufbieten' && e.empfaenger.length === 1 && e.empfaenger[0].id === 'u-evak2'
})())
pruefe('haben alle der Stufe zugesagt, entfällt sie', (() => {
  const e = eskalationsentscheid(alarm(['u-evak1', 'u-evak2']), stufe(), EVAK, JETZT)
  return e.art === 'entfaellt' && e.grund.includes('bereits zugesagt')
})())
pruefe('unbesetzte Gruppe wird als solche benannt', (() => {
  const e = eskalationsentscheid(alarm(), stufe(), [], JETZT)
  return e.art === 'entfaellt' && e.grund.includes('nicht besetzt')
})())

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
