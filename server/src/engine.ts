import { broadcast } from './events.js'
import { sendeAlarmKanaele } from './kanaele.js'
import {
  letzterTestpush, markiereOhneGeraet, merkeTestpush, pruefeEmpfangsbestaetigungen, pruefePushDienst, sendPush,
} from './push.js'
import {
  addAudit, allAlarms, allLoneWork, allScenarios, allStoredUsers, buildDeliveries, createAlarm,
  integrations, purgePresence, resolveRecipients, saveAlarm, upsertDoc,
} from './store.js'
import { LONE_WORK_DEFAULT_GROUPS, type Alarm, type AlarmLogEntry, type AlarmUpdate, type LoneWorkSession } from './types.js'

/** Kennzeichnung einer Übung in Titel und Protokoll */
export const UEBUNG = 'ÜBUNG'

/**
 * Serverseitige Alarmverarbeitung. Läuft unabhängig von geöffneten Geräten:
 * Eskalationsstufen greifen und abgelaufene Alleinarbeits-Timer lösen aus,
 * auch wenn niemand die App offen hat.
 */

/** Empfänger eines Alarms, die noch nicht quittiert haben */
function offeneEmpfaenger(alarm: Alarm): string[] {
  const alle = [...new Set(alarm.deliveries.map((d) => d.userId))]
  return alle.filter((id) => alarm.deliveries.every((d) => d.userId !== id || d.ack === 'none'))
}

/**
 * Push an alle Empfänger eines Alarms. Ein stiller Alarm kommt ebenfalls an –
 * ohne Ton und Vibration, damit niemand auf sich aufmerksam macht. Antippen
 * öffnet in der App direkt die Handlungsanweisung (data.kind = 'alarm').
 */
export async function alarmPush(alarm: Alarm, empfaenger?: string[]): Promise<void> {
  const szenario = allScenarios().find((s) => s.id === alarm.scenarioId)
  const ids = empfaenger ?? [...new Set(alarm.deliveries.map((d) => d.userId))]
  const titel = szenario ? `${alarm.silent ? 'Stiller Alarm' : 'Alarm'}: ${szenario.title}` : 'Alarm ausgelöst'
  // Ohne Gerät keine Push-Zustellung – das soll die Alarmzentrale ehrlich zeigen
  markiereOhneGeraet(alarm.id, ids)
  await sendPush(ids, {
    title: alarm.drill ? `${UEBUNG} – ${titel}` : titel,
    body: alarm.silent ? `${alarm.message} – Antippen: Was jetzt zu tun ist. Gerät stumm halten.` : alarm.message,
    data: { kind: 'alarm', alarmId: alarm.id, scenarioId: alarm.scenarioId, drill: Boolean(alarm.drill) },
    critical: !alarm.silent,
    silent: alarm.silent,
  })
}

/**
 * Lagemeldung, weitere Meldung oder Fehlalarm-Hinweis zu einem laufenden Alarm.
 * Geht an alle bisherigen Empfänger; Antippen öffnet wie beim Alarm die
 * Handlungsanweisung, wo die Meldung zuoberst steht.
 */
export async function lagemeldungPush(alarm: Alarm, update: AlarmUpdate, empfaenger?: string[]): Promise<void> {
  const szenario = allScenarios().find((s) => s.id === alarm.scenarioId)
  const ids = empfaenger ?? [...new Set(alarm.deliveries.map((d) => d.userId))]
  const art = update.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : update.kind === 'meldung' ? 'Weitere Meldung' : 'Lagemeldung'
  const titel = `${art}: ${szenario?.title ?? 'Alarm'}`
  await sendPush(ids, {
    title: alarm.drill ? `${UEBUNG} – ${titel}` : titel,
    body: update.message,
    data: { kind: 'alarm', alarmId: alarm.id, scenarioId: alarm.scenarioId, drill: Boolean(alarm.drill) },
    silent: alarm.silent,
    wichtig: true,
  })
}

/** Testmeldung an die genannten Personen – prüft die Kette bis aufs Gerät */
export async function testPush(userIds: string[]): Promise<number> {
  const anzahl = await sendPush(userIds, {
    title: 'Testmeldung SOBE Notfall',
    body: 'Der Push-Dienst funktioniert. Diese Meldung ist kein Alarm.',
    data: { kind: 'test' },
    wichtig: true,
  })
  merkeTestpush()
  return anzahl
}

/**
 * Entwarnung an alle, die den Alarm erhalten haben, und an die auslösende
 * Person. Antippen öffnet die Schritte «Nach der Entwarnung» (data.kind = 'ended').
 */
export async function entwarnungPush(alarm: Alarm): Promise<void> {
  const szenario = allScenarios().find((s) => s.id === alarm.scenarioId)
  const ids = [...new Set([...alarm.deliveries.map((d) => d.userId), alarm.triggeredByUserId])]
  const titel = szenario ? `Entwarnung: ${szenario.title}` : 'Entwarnung'
  await sendPush(ids, {
    title: alarm.drill ? `${UEBUNG} – ${titel}` : titel,
    body: alarm.endNote?.trim()
      ? `${alarm.endNote.trim()} – Antippen für die nächsten Schritte.`
      : 'Der Alarm ist beendet. Antippen für die nächsten Schritte.',
    data: { kind: 'ended', alarmId: alarm.id, scenarioId: alarm.scenarioId, drill: Boolean(alarm.drill) },
    // Auch nach einem stillen Alarm darf die Entwarnung leise bleiben
    silent: alarm.silent,
    wichtig: true,
  })
}

/** Ausgehende Webhooks benachrichtigen */
export async function ausgehendeWebhooks(alarm: Alarm): Promise<void> {
  const szenario = allScenarios().find((s) => s.id === alarm.scenarioId)
  const nutzlast = JSON.stringify({
    event: 'alarm.triggered',
    alarmId: alarm.id,
    scenario: szenario?.title ?? alarm.scenarioId,
    message: alarm.message,
    silent: alarm.silent,
    triggeredAt: new Date(alarm.triggeredAt).toISOString(),
    locations: alarm.locationIds,
    groups: alarm.groupIds,
    channels: alarm.channels,
  })
  for (const wh of integrations().webhooks?.filter((w) => w.active && w.direction === 'outbound') ?? []) {
    try {
      await fetch(wh.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: nutzlast })
    } catch {
      // Zielsystem nicht erreichbar – der Alarm bleibt trotzdem erfasst
    }
  }
}

/** Eine Runde Eskalationsprüfung und Timer-Überwachung */
export async function tick(): Promise<void> {
  const jetzt = Date.now()
  let veraendert = false

  // --- Eskalationsstufen ---
  for (const alarm of allAlarms().filter((a) => a.status === 'active')) {
    const stufe = alarm.escalation[alarm.escalationStage]
    if (!stufe) continue
    const quittiert = alarm.deliveries.some((d) => d.ack === 'acknowledged')
    if (quittiert || jetzt - alarm.triggeredAt <= stufe.afterMinutes * 60_000) continue

    const empfaenger = resolveRecipients(allStoredUsers(), stufe.groupIds, alarm.locationIds)
    const log: AlarmLogEntry[] = [
      ...alarm.log,
      {
        ts: jetzt,
        message: `Eskalationsstufe ${alarm.escalationStage + 1}: ${empfaenger.length} weitere Empfänger${
          stufe.notifyEmergencyServices ? (alarm.drill ? ' – Übung: keine Blaulichtorganisationen' : ' – Blaulichtorganisationen benachrichtigt') : ''
        }`,
      },
    ]
    const aktualisiert: Alarm = {
      ...alarm,
      escalationStage: alarm.escalationStage + 1,
      deliveries: [...alarm.deliveries, ...buildDeliveries(empfaenger.map((e) => e.id), stufe.channels)],
      log,
    }
    saveAlarm(aktualisiert)
    addAudit('alarm', `Eskalation Stufe ${aktualisiert.escalationStage} für Alarm ${alarm.id}`)
    await alarmPush(aktualisiert, empfaenger.map((e) => e.id))
    await sendeAlarmKanaele(aktualisiert, empfaenger.map((e) => e.id))
    veraendert = true
  }

  // --- Alleinarbeits-Timer abgelaufen ---
  const abgelaufen = allLoneWork().filter((s) => s.status === 'running' && jetzt > s.expiresAt)
  for (const sitzung of abgelaufen) {
    upsertDoc('lone_work', sitzung.id, { ...sitzung, status: 'alarm' })
    const person = allStoredUsers().find((u) => u.id === sitzung.userId)
    const { groupIds, recipientUserIds } = alleinarbeitEmpfaenger(sitzung)
    const alarm = createAlarm({
      scenarioId: 'sc-medizin',
      message: `ALLEINARBEIT: Timer von ${person ? `${person.firstName} ${person.lastName}` : '?'} abgelaufen (${sitzung.activity}). Keine Rückmeldung – bitte sofort prüfen!`,
      silent: sitzung.silent,
      requireAck: true,
      channels: ['push', 'sms', 'voice'],
      groupIds,
      locationIds: [sitzung.locationId],
      triggeredByUserId: sitzung.userId,
      triggeredVia: 'timer',
      recipientUserIds,
      escalation: [{ afterMinutes: 5, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
    })
    saveAlarm(alarm)
    addAudit('alarm', `Automatischer Alleinarbeiter-Alarm: Timer abgelaufen (${person?.firstName} ${person?.lastName})`, sitzung.userId)
    await alarmPush(alarm)
    await sendeAlarmKanaele(alarm)
    await ausgehendeWebhooks(alarm)
    veraendert = true
  }

  // --- Erinnerung an offene Quittierungen ---
  for (const alarm of allAlarms().filter((a) => a.status === 'active' && a.requireAck)) {
    const alter = jetzt - alarm.triggeredAt
    const faellig = alter > 120_000 && alter < 135_000
    if (!faellig) continue
    const offen = offeneEmpfaenger(alarm)
    if (offen.length > 0) await alarmPush(alarm, offen)
  }

  if (veraendert) broadcast('state')

  // --- Empfangsbestätigungen, Erreichbarkeit, wöchentliche Testmeldung ---
  await pruefeEmpfangsbestaetigungen()
  if (jetzt - letzteDienstpruefung > 10 * 60_000) {
    letzteDienstpruefung = jetzt
    await pruefePushDienst()
    await woechentlicherTestpush(jetzt)
    // Alte Aufenthaltsmeldungen entfernen – es entsteht nie eine Bewegungshistorie
    purgePresence()
  }
}

let letzteDienstpruefung = 0

/**
 * Einmal pro Woche eine Testmeldung an die Administration – werktags am
 * Vormittag, damit sie auffällt und niemanden nachts weckt.
 */
async function woechentlicherTestpush(jetzt: number): Promise<void> {
  const letzter = letzterTestpush() ?? 0
  if (jetzt - letzter < 7 * 24 * 3600_000) return
  const lokal = new Date(jetzt)
  const stunde = lokal.getHours()
  const wochentag = lokal.getDay()
  if (wochentag === 0 || wochentag === 6 || stunde < 8 || stunde > 11) return
  const admins = allStoredUsers().filter((u) => u.role === 'admin').map((u) => u.id)
  if (admins.length === 0) return
  const anzahl = await testPush(admins)
  addAudit('system', `Wöchentliche Testmeldung an ${anzahl} Gerät(e) der Administration gesendet.`)
}

/**
 * Empfänger eines Alleinarbeits-Alarms: die beim Start gewählten Gruppen am
 * Standort plus die gewählten Einzelpersonen. Ohne Wahl gelten die
 * Standardgruppen. Die Person selbst wird nie alarmiert.
 */
export function alleinarbeitEmpfaenger(sitzung: LoneWorkSession): { groupIds: string[]; recipientUserIds?: string[] } {
  const groupIds = sitzung.alertGroupIds?.length ? sitzung.alertGroupIds : LONE_WORK_DEFAULT_GROUPS
  const einzelne = (sitzung.alertUserIds ?? []).filter((id) => id !== sitzung.userId)
  if (einzelne.length === 0) return { groupIds }
  const users = allStoredUsers()
  const ausGruppen = resolveRecipients(users, groupIds, [sitzung.locationId]).map((u) => u.id)
  return { groupIds, recipientUserIds: [...new Set([...ausGruppen, ...einzelne])].filter((id) => id !== sitzung.userId) }
}

export function startEngine(): NodeJS.Timeout {
  return setInterval(() => {
    tick().catch((fehler) => console.error('[engine] Fehler im Durchlauf:', fehler))
  }, 5_000)
}
