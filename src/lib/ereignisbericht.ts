import type { Alarm, Group, Location, Scenario, User } from '../types'
import { CHANNEL_LABELS } from '../types'

/**
 * Der Ereignisbericht zu einem Alarm.
 *
 * Nach einem Todesfall, einem Kindesschutzfall oder einem Unfall im
 * Therapiebad braucht die Schulleitung ein Dokument: wer wann alarmiert
 * wurde, wer geantwortet hat, welche Lagemeldungen kamen, wann Entwarnung
 * war. Für Schulkommission, Kanton, Versicherung und Eltern.
 *
 * Alles dafür lag bereits im Journal – es gab nur keinen Weg, es
 * herauszubekommen. Dieser Bericht erfindet nichts dazu: Er ordnet, was
 * ohnehin aufgezeichnet wurde, und sagt an den Stellen, wo nichts
 * aufgezeichnet wurde, ausdrücklich «nicht erfasst». Ein Bericht, der
 * Lücken glättet, wäre für eine Aufsichtsbehörde wertlos.
 */

export interface Berichtzeile {
  zeit: number
  text: string
  /** Woher der Eintrag stammt – im Bericht als Spalte, damit nachvollziehbar bleibt, was System und was Mensch war */
  quelle: 'System' | 'Lagemeldung' | 'Weitere Meldung' | 'Fehlalarm' | 'Standort'
}

export interface Rueckmeldung {
  person: string
  kanaele: string
  zugestellt: boolean
  antwort: 'zugesagt' | 'abgesagt' | 'keine Antwort'
  zeit: number | null
}

export interface Ereignisbericht {
  kennung: string
  szenario: string
  uebung: boolean
  ausgeloestAm: number
  ausgeloestVon: string
  ausgeloestUeber: string
  standorte: string
  gruppen: string
  kanaele: string
  meldung: string
  still: boolean
  beendetAm: number | null
  beendetHinweis: string
  dauerMinuten: number | null
  fehlalarmGemeldet: boolean
  rueckmeldungen: Rueckmeldung[]
  verlauf: Berichtzeile[]
  /** Angaben, die das System nicht kennt – sie gehören von Hand ergänzt */
  offeneFelder: string[]
}

const AUSLOESEWEG: Record<Alarm['triggeredVia'], string> = {
  app: 'App auf dem Telefon',
  web: 'Webportal',
  hotline: 'Telefon-Hotline',
  button: 'Alarmknopf',
  timer: 'Alleinarbeits-Timer (abgelaufen)',
  webhook: 'Fremdsystem (Webhook)',
}

const MELDUNGSART: Record<string, Berichtzeile['quelle']> = {
  lage: 'Lagemeldung',
  meldung: 'Weitere Meldung',
  fehlalarm: 'Fehlalarm',
  standort: 'Standort',
}

function name(users: User[], id: string | undefined): string {
  const u = users.find((x) => x.id === id)
  return u ? `${u.firstName} ${u.lastName}` : 'nicht erfasst'
}

export function ereignisbericht(
  alarm: Alarm,
  { users, groups, locations, scenarios }: { users: User[]; groups: Group[]; locations: Location[]; scenarios: Scenario[] },
): Ereignisbericht {
  // Rückmeldungen je Person zusammenfassen: Eine Person kann über mehrere
  // Kanäle erreicht worden sein, im Bericht ist sie eine Zeile.
  const proPerson = new Map<string, { kanaele: Set<string>; zugestellt: boolean; antwort: Rueckmeldung['antwort']; zeit: number | null }>()
  for (const d of alarm.deliveries) {
    const eintrag = proPerson.get(d.userId) ?? { kanaele: new Set<string>(), zugestellt: false, antwort: 'keine Antwort' as const, zeit: null }
    eintrag.kanaele.add(CHANNEL_LABELS[d.channel] ?? d.channel)
    if (d.status === 'delivered') eintrag.zugestellt = true
    if (d.ack === 'acknowledged') { eintrag.antwort = 'zugesagt'; eintrag.zeit = d.updatedAt }
    else if (d.ack === 'declined' && eintrag.antwort !== 'zugesagt') { eintrag.antwort = 'abgesagt'; eintrag.zeit = d.updatedAt }
    proPerson.set(d.userId, eintrag)
  }

  const verlauf: Berichtzeile[] = [
    ...alarm.log.map((l) => ({ zeit: l.ts, text: l.message, quelle: 'System' as const })),
    ...(alarm.updates ?? []).map((u) => ({
      zeit: u.ts,
      text: u.byUserId ? `${u.message} (${name(users, u.byUserId)})` : u.message,
      quelle: MELDUNGSART[u.kind] ?? ('System' as const),
    })),
  ].sort((a, b) => a.zeit - b.zeit)

  const offen: string[] = []
  if (!alarm.endNote) offen.push('Hinweis zur Entwarnung')
  if (!(alarm.updates ?? []).some((u) => u.kind === 'lage')) offen.push('Lagebeurteilung des Krisenstabs')
  offen.push('Beteiligte ausserhalb der App (Blaulichtorganisationen, Eltern, Behörden)')
  offen.push('Nachbesprechung und abgeleitete Massnahmen')

  return {
    kennung: alarm.id,
    szenario: scenarios.find((s) => s.id === alarm.scenarioId)?.title ?? 'nicht erfasst',
    uebung: alarm.drill === true,
    ausgeloestAm: alarm.triggeredAt,
    ausgeloestVon: name(users, alarm.triggeredByUserId),
    ausgeloestUeber: AUSLOESEWEG[alarm.triggeredVia] ?? alarm.triggeredVia,
    standorte: alarm.locationIds.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(', ') || 'alle Standorte',
    gruppen: alarm.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(', ') || 'alle',
    kanaele: alarm.channels.map((c) => CHANNEL_LABELS[c] ?? c).join(', '),
    meldung: alarm.message,
    still: alarm.silent,
    beendetAm: alarm.endedAt ?? null,
    beendetHinweis: alarm.endNote ?? '',
    dauerMinuten: alarm.endedAt ? Math.round((alarm.endedAt - alarm.triggeredAt) / 60_000) : null,
    fehlalarmGemeldet: (alarm.updates ?? []).some((u) => u.kind === 'fehlalarm'),
    rueckmeldungen: [...proPerson.entries()]
      .map(([userId, e]) => ({
        person: name(users, userId),
        kanaele: [...e.kanaele].join(', '),
        zugestellt: e.zugestellt,
        antwort: e.antwort,
        zeit: e.zeit,
      }))
      .sort((a, b) => a.person.localeCompare(b.person, 'de')),
    verlauf,
    offeneFelder: offen,
  }
}

/** Kennzahlen für den Kopf des Berichts */
export function bilanz(bericht: Ereignisbericht): { alarmiert: number; zugesagt: number; abgesagt: number; ohneAntwort: number } {
  const r = bericht.rueckmeldungen
  return {
    alarmiert: r.length,
    zugesagt: r.filter((x) => x.antwort === 'zugesagt').length,
    abgesagt: r.filter((x) => x.antwort === 'abgesagt').length,
    ohneAntwort: r.filter((x) => x.antwort === 'keine Antwort').length,
  }
}
