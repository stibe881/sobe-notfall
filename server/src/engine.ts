import { broadcast } from './events.js'
import { sendeAlarmKanaele } from './kanaele.js'
import {
  letzterTestpush, markiereOhneGeraet, merkeTestpush, pruefeEmpfangsbestaetigungen, pruefePushDienst, sendPush,
} from './push.js'
import { standbyPassiv } from './replikation.js'
import {
  addAudit, allAlarms, allButtons, allGroups, allLoneWork, allScenarios, allStoredUsers, buildDeliveries, createAlarm,
  integrations, purgePresence, resolveRecipients, saveAlarm, upsertDoc,
} from './store.js'
import { CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS, type Alarm, type AlarmLogEntry, type AlarmUpdate, type LoneWorkSession } from './types.js'

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
  const art = update.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : update.kind === 'meldung' ? 'Weitere Meldung' : update.kind === 'standort' ? 'Position im Gebäude' : 'Lagemeldung'
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
  // Ein passiver Standby-Server verarbeitet nichts – Eskalationen, Timer und
  // Meldungen übernimmt der Hauptserver; sonst ginge alles doppelt raus.
  if (standbyPassiv()) return
  const jetzt = Date.now()
  let veraendert = false

  // --- Eskalationsstufen ---
  for (const alarm of allAlarms().filter((a) => a.status === 'active')) {
    const stufe = alarm.escalation[alarm.escalationStage]
    if (!stufe) continue
    const quittiert = alarm.deliveries.some((d) => d.ack === 'acknowledged')
    if (quittiert || jetzt - alarm.triggeredAt <= stufe.afterMinutes * 60_000) continue

    const empfaenger = resolveRecipients(allStoredUsers(), stufe.groupIds, alarm.locationIds)
    const gruppen = allGroups().filter((g) => stufe.groupIds.includes(g.id)).map((g) => g.name)
    const kanaele = stufe.channels.map((c) => CHANNEL_LABELS[c]).join(', ')
    // Der Eintrag nennt die aufgebotene Gruppe. Das Kennzeichen
    // notifyEmergencyServices steuert keine Alarmierung – es gibt keine
    // Schnittstelle zu einer Einsatzleitzentrale. Damit im Journal niemand
    // einen ausgelösten Blaulichteinsatz vermutet, steht das ausdrücklich da.
    const log: AlarmLogEntry[] = [
      ...alarm.log,
      {
        ts: jetzt,
        message: `Eskalationsstufe ${alarm.escalationStage + 1}: ${empfaenger.length} weitere Empfänger:innen${
          gruppen.length ? ` (${gruppen.join(', ')})` : ''
        }${kanaele ? ` über ${kanaele}` : ''}${
          stufe.notifyEmergencyServices ? ' – Blaulichtorganisationen werden nicht automatisch alarmiert, bei Bedarf selbst anrufen' : ''
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
    addAudit('alarm', `Eskalation Stufe ${aktualisiert.escalationStage} für Alarm ${alarm.id}: ${empfaenger.length} weitere Empfänger:innen${gruppen.length ? ` (${gruppen.join(', ')})` : ''}`)
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
    addAudit('alarm', `Automatischer Alleinarbeits-Alarm: Timer abgelaufen (${person?.firstName} ${person?.lastName})`, sitzung.userId)
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
    await pruefeAlarmknoepfe(jetzt)
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
 * Wachhund über die Alarmknöpfe.
 *
 * Ein Knopf, der stumm an der Wand hängt, wiegt in falscher Sicherheit: Die
 * Person drückt im Ernstfall und nichts passiert. Darum prüft der Server
 * regelmässig, ob jedes Gerät noch ein Lebenszeichen sendet und wie es um die
 * Batterie steht, und meldet Abweichungen der Administration.
 *
 * Gemeldet wird pro Zustand einmal; erholt sich ein Knopf, wird die Sperre
 * gelöst und eine erneute Störung wieder gemeldet.
 */
export async function pruefeAlarmknoepfe(jetzt = Date.now()): Promise<void> {
  const lorawan = integrations().lorawan
  if (!lorawan.enabled) return
  const stilleMs = Math.max(1, lorawan.stilleWarnungStunden) * 3600_000
  const schwelleBatterie = lorawan.batterieWarnungProzent

  const stumm: string[] = []
  const schwach: string[] = []
  let veraendert = false

  for (const knopf of allButtons()) {
    const gewarnt = knopf.gewarnt ?? {}
    const neuGewarnt: { stillAt?: number; batterieAt?: number } = { ...gewarnt }

    // Ein Knopf ohne je empfangenes Signal zählt nicht als stumm – er ist
    // erfasst, aber noch nicht in Betrieb genommen
    const istStumm = knopf.lastSeen > 0 && jetzt - knopf.lastSeen > stilleMs
    if (istStumm && !gewarnt.stillAt) {
      stumm.push(`${knopf.name} (${knopf.serial}, zuletzt ${stundenText(jetzt - knopf.lastSeen)})`)
      neuGewarnt.stillAt = jetzt
    } else if (!istStumm && gewarnt.stillAt) {
      delete neuGewarnt.stillAt
    }

    // Ohne je empfangenes Signal ist der Batteriestand unbekannt, nicht voll
    const istSchwach = knopf.lastSeen > 0 && knopf.batteryPct < schwelleBatterie
    if (istSchwach && !gewarnt.batterieAt) {
      schwach.push(`${knopf.name} (${knopf.serial}, ${knopf.batteryPct} %)`)
      neuGewarnt.batterieAt = jetzt
    } else if (!istSchwach && gewarnt.batterieAt) {
      delete neuGewarnt.batterieAt
    }

    if (JSON.stringify(neuGewarnt) !== JSON.stringify(gewarnt)) {
      upsertDoc('buttons', knopf.id, { ...knopf, gewarnt: neuGewarnt })
      veraendert = true
    }
  }

  if (veraendert) broadcast('state')
  if (stumm.length === 0 && schwach.length === 0) return

  const admins = allStoredUsers().filter((u) => u.role === 'admin').map((u) => u.id)
  const zeilen = [
    stumm.length ? `Ohne Signal: ${stumm.join(', ')}` : '',
    schwach.length ? `Batterie schwach: ${schwach.join(', ')}` : '',
  ].filter(Boolean)
  const text = zeilen.join(' · ')
  addAudit('system', `Alarmknöpfe brauchen Aufmerksamkeit. ${text}`)
  if (admins.length > 0) {
    await sendPush(admins, {
      title: 'Alarmknopf prüfen',
      body: text,
      data: { kind: 'buttons' },
      wichtig: true,
    })
  }
}

/** «vor 2 Tagen» / «vor 14 Stunden» – für die Störungsmeldung */
function stundenText(ms: number): string {
  const stunden = Math.floor(ms / 3600_000)
  if (stunden < 48) return `vor ${stunden} Stunden`
  return `vor ${Math.floor(stunden / 24)} Tagen`
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
