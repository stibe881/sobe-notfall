import { bilanz, ereignisbericht } from './ereignisbericht'
import { berichtDateiname, berichtHtml } from './berichtseite'
import type { Alarm } from '../types'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const T0 = new Date('2026-03-12T09:15:00+01:00').getTime()
const KONTEXT = {
  users: [
    { id: 'u-1', firstName: 'Anna', lastName: 'Bucher' },
    { id: 'u-2', firstName: 'Beat', lastName: 'Christen' },
    { id: 'u-3', firstName: 'Carla', lastName: 'Dubs' },
  ],
  groups: [{ id: 'gr-alle', name: 'Alle Mitarbeitenden' }],
  locations: [{ id: 'loc-baar', name: 'Weststrasse 1-3' }],
  scenarios: [{ id: 'sc-brand', title: 'Brand / Feuer' }],
} as never as Parameters<typeof ereignisbericht>[1]

const alarm = {
  id: 'alarm-42', scenarioId: 'sc-brand', message: 'Rauch im Treppenhaus B',
  silent: false, requireAck: true, triggeredByUserId: 'u-1', triggeredVia: 'app',
  triggeredAt: T0, locationIds: ['loc-baar'], groupIds: ['gr-alle'], channels: ['push', 'sms'],
  status: 'ended', endedAt: T0 + 47 * 60_000, endNote: 'Rückkehr ab 10:30 über den Haupteingang',
  escalationStage: 1, escalation: [],
  deliveries: [
    { id: 'd1', userId: 'u-1', channel: 'push', status: 'delivered', ack: 'acknowledged', updatedAt: T0 + 60_000 },
    { id: 'd2', userId: 'u-1', channel: 'sms', status: 'delivered', ack: 'none', updatedAt: T0 },
    { id: 'd3', userId: 'u-2', channel: 'push', status: 'delivered', ack: 'declined', updatedAt: T0 + 120_000 },
    { id: 'd4', userId: 'u-3', channel: 'push', status: 'pending', ack: 'none', updatedAt: T0 },
  ],
  log: [{ ts: T0, message: 'Alarm ausgelöst' }, { ts: T0 + 180_000, message: 'Eskalationsstufe 1: 4 weitere Empfänger:innen' }],
  updates: [
    { ts: T0 + 300_000, message: 'Gebäude geräumt, Feuerwehr vor Ort', byUserId: 'u-2', kind: 'lage' },
  ],
} as unknown as Alarm

const b = ereignisbericht(alarm, KONTEXT)

// --- Inhalt ---
pruefe('Szenario, Auslösende und Weg stehen im Bericht',
  b.szenario === 'Brand / Feuer' && b.ausgeloestVon === 'Anna Bucher' && b.ausgeloestUeber === 'App auf dem Telefon')
pruefe('Standort und Gruppe werden in Namen aufgelöst',
  b.standorte === 'Weststrasse 1-3' && b.gruppen === 'Alle Mitarbeitenden')
pruefe('die Dauer wird berechnet', b.dauerMinuten === 47)
pruefe('der Hinweis zur Entwarnung wird übernommen', b.beendetHinweis.includes('Haupteingang'))

// --- Rückmeldungen ---
pruefe('eine Person mit zwei Kanälen ergibt eine Zeile', b.rueckmeldungen.length === 3)
pruefe('beide Kanäle stehen in derselben Zeile',
  b.rueckmeldungen.find((r) => r.person === 'Anna Bucher')!.kanaele.split(', ').length === 2)
pruefe('eine Zusage überwiegt die Kanäle ohne Antwort',
  b.rueckmeldungen.find((r) => r.person === 'Anna Bucher')!.antwort === 'zugesagt')
pruefe('eine Absage wird als solche geführt',
  b.rueckmeldungen.find((r) => r.person === 'Beat Christen')!.antwort === 'abgesagt')
pruefe('unzustellbar bleibt unzustellbar',
  b.rueckmeldungen.find((r) => r.person === 'Carla Dubs')!.zugestellt === false)
pruefe('die Bilanz zählt richtig', (() => {
  const z = bilanz(b)
  return z.alarmiert === 3 && z.zugesagt === 1 && z.abgesagt === 1 && z.ohneAntwort === 1
})())

// --- Verlauf ---
pruefe('System- und Lagemeldungen stehen zusammen und chronologisch',
  b.verlauf.length === 3 && b.verlauf.every((v, i) => i === 0 || v.zeit >= b.verlauf[i - 1].zeit))
pruefe('die Lagemeldung nennt ihre Urheberin',
  b.verlauf.some((v) => v.quelle === 'Lagemeldung' && v.text.includes('Beat Christen')))

// --- Lücken werden benannt, nicht geglättet ---
pruefe('fehlende Lagebeurteilung wird als offen ausgewiesen', (() => {
  const ohne = ereignisbericht({ ...alarm, updates: [] } as Alarm, KONTEXT)
  return ohne.offeneFelder.some((f) => f.includes('Lagebeurteilung'))
})())
pruefe('Beteiligte ausserhalb der App werden immer angemahnt',
  b.offeneFelder.some((f) => f.includes('ausserhalb der App')))
pruefe('ein noch laufender Alarm wird nicht als beendet dargestellt', (() => {
  const offen = ereignisbericht({ ...alarm, status: 'active', endedAt: undefined } as Alarm, KONTEXT)
  return offen.beendetAm === null && offen.dauerMinuten === null
})())
pruefe('unbekannte Personen werden benannt, nicht erfunden',
  ereignisbericht({ ...alarm, triggeredByUserId: 'u-weg' } as Alarm, KONTEXT).ausgeloestVon === 'nicht erfasst')

// --- Kennzeichen ---
pruefe('eine Übung ist als solche gekennzeichnet',
  ereignisbericht({ ...alarm, drill: true } as Alarm, KONTEXT).uebung)
pruefe('ein gemeldeter Fehlalarm ist gekennzeichnet',
  ereignisbericht({ ...alarm, updates: [{ ts: T0, message: 'Irrtum', kind: 'fehlalarm' }] } as Alarm, KONTEXT).fehlalarmGemeldet)

// --- Das Dokument ---
const html = berichtHtml(b, 'SONNENBERG Kompetenzzentrum')
pruefe('das Dokument steht für sich – kein Nachladen von aussen',
  !/<script|src=|href="http/i.test(html))
pruefe('Organisation, Szenario und Meldung stehen darin',
  html.includes('SONNENBERG') && html.includes('Brand / Feuer') && html.includes('Rauch im Treppenhaus B'))
pruefe('es ist auf A4 eingerichtet', html.includes('@page') && html.includes('A4'))
pruefe('Fremdtext kann die Seite nicht zerlegen', (() => {
  const boes = ereignisbericht({ ...alarm, message: '<script>alert(1)</script>' } as Alarm, KONTEXT)
  const seite = berichtHtml(boes, 'Test')
  return !seite.includes('<script>') && seite.includes('&lt;script&gt;')
})())
pruefe('der Dateiname ist sortierbar und ohne Sonderzeichen',
  berichtDateiname(b) === 'ereignisbericht-2026-03-12-brand-feuer.html')
pruefe('Umlaute im Dateinamen werden umschrieben',
  berichtDateiname({ ...b, szenario: 'Übung Grossräumig' }).includes('uebung-grossraeumig'))

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
