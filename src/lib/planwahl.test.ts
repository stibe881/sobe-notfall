import { planFuer } from './planwahl'
import type { AlarmPlan } from '../types'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const plan = (id: string, scenarioId: string, locationIds: string[], name = id): AlarmPlan =>
  ({ id, name, scenarioId, locationIds, groupIds: [], channels: ['push'], requireAck: false, escalation: [] }) as AlarmPlan

const PLAENE = [
  plan('brand-baar', 'sc-brand', ['loc-baar'], 'Brandalarm Baar'),
  plan('brand-menzingen', 'sc-brand', ['loc-menzingen'], 'Brandalarm Menzingen'),
  plan('vermisst', 'sc-vermisst', [], 'Vermisstensuche'),
  plan('medizin', 'sc-medizin', [], 'Medizinischer Notfall'),
  plan('medizin-kloten', 'sc-medizin', ['loc-kloten'], 'Medizin Kloten'),
]

pruefe('der Plan des passenden Standorts gewinnt',
  planFuer(PLAENE, 'sc-brand', ['loc-menzingen'])?.id === 'brand-menzingen')
pruefe('ein Plan ohne Standortbindung gilt überall',
  planFuer(PLAENE, 'sc-vermisst', ['loc-kloten'])?.id === 'vermisst')
pruefe('Standortplan schlägt den allgemeinen Plan, wenn er passt',
  planFuer(PLAENE, 'sc-medizin', ['loc-kloten'])?.id === 'medizin-kloten')
pruefe('allgemeiner Plan schlägt den fremden Standortplan',
  planFuer(PLAENE, 'sc-medizin', ['loc-baar'])?.id === 'medizin')
pruefe('ohne passenden und ohne allgemeinen Plan: notfalls der eines anderen Standorts, nach Name',
  planFuer(PLAENE, 'sc-brand', ['loc-kloten'])?.id === 'brand-baar')
pruefe('Alarm ohne Standort nimmt den allgemeinen Plan',
  planFuer(PLAENE, 'sc-medizin', [])?.id === 'medizin')
pruefe('Alarm ohne Standort und nur Standortpläne: der erste nach Name',
  planFuer(PLAENE, 'sc-brand', [])?.id === 'brand-baar')
pruefe('kein Plan zum Szenario: null', planFuer(PLAENE, 'sc-amok', ['loc-baar']) === null)
pruefe('leeres Szenario: null', planFuer(PLAENE, '', ['loc-baar']) === null)
pruefe('die Eingabe wird nicht umsortiert', PLAENE[0].id === 'brand-baar' && PLAENE[1].id === 'brand-menzingen')

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
