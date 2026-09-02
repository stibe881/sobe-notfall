import { broadcast } from './events.js'
import {
  erstelleKonferenz, ladeIntegrationen, sendeSms, sendeTeamsKarte, speichereIntegrationen, starteAnrufe,
} from './integrationen.js'
import { sendPush } from './push.js'
import { allScenarios, allStoredUsers, findAlarm, saveAlarm } from './store.js'
import type { Alarm, Channel, DeliveryStatus, StoredUser } from './types.js'

/**
 * Versand über die konfigurierten Kanäle jenseits von Push: SMS-Gateway,
 * Microsoft-Teams-Kanal, Sprachanruf und Telefonkonferenz über Teams.
 * Fehler werden protokolliert und als «failed» am Alarm vermerkt, aber nie
 * weitergereicht – kein Gateway darf die Alarmauslösung verhindern.
 */

const UEBUNG_PRAEFIX = (alarm: Alarm) => (alarm.drill ? 'ÜBUNG – ' : '')

function szenarioTitel(alarm: Alarm): string {
  return allScenarios().find((s) => s.id === alarm.scenarioId)?.title ?? 'Alarm'
}

/** Zustellstatus mehrerer Personen für einen Kanal setzen – am frischen Stand aus der Datenbank */
function markiereKanal(alarmId: string, userIds: Set<string>, channel: Channel, status: DeliveryStatus): void {
  const alarm = findAlarm(alarmId)
  if (!alarm || userIds.size === 0) return
  let veraendert = false
  const deliveries = alarm.deliveries.map((d) => {
    if (d.channel !== channel || !userIds.has(d.userId) || d.status === status || d.status === 'delivered') return d
    veraendert = true
    return { ...d, status, updatedAt: Date.now() }
  })
  if (veraendert) saveAlarm({ ...alarm, deliveries })
}

/** Protokollzeile am Alarm ergänzen – ebenfalls am frischen Stand */
function protokolliere(alarmId: string, message: string): void {
  const alarm = findAlarm(alarmId)
  if (!alarm) return
  saveAlarm({ ...alarm, log: [...alarm.log, { ts: Date.now(), message }] })
}

function empfaengerVon(alarm: Alarm, kanal: Channel, nurUserIds?: string[]): StoredUser[] {
  const ids = new Set(
    alarm.deliveries
      .filter((d) => d.channel === kanal && (!nurUserIds || nurUserIds.includes(d.userId)))
      .map((d) => d.userId),
  )
  return allStoredUsers().filter((u) => ids.has(u.id))
}

// ---------- Alarmversand ----------

/**
 * Alle Nicht-Push-Kanäle eines Alarms bedienen. `nurUserIds` beschränkt den
 * Versand auf neue Empfänger (Eskalationsstufe, zusammengeführte Meldung).
 */
export async function sendeAlarmKanaele(alarm: Alarm, nurUserIds?: string[]): Promise<void> {
  const integ = ladeIntegrationen()
  const titel = `${UEBUNG_PRAEFIX(alarm)}${alarm.silent ? 'Stiller Alarm' : 'ALARM'}: ${szenarioTitel(alarm)}`
  let veraendert = false

  // --- SMS ---
  const smsEmpfaenger = empfaengerVon(alarm, 'sms', nurUserIds)
  if (smsEmpfaenger.length > 0 && integ.smsGateway.enabled) {
    const text = `${titel} – ${alarm.message} Quittieren in der SOBE-App.`
    const mitNummer = smsEmpfaenger.filter((u) => u.phone.trim())
    const ohneNummer = smsEmpfaenger.filter((u) => !u.phone.trim())
    const ergebnis = await sendeSms(integ.smsGateway, mitNummer.map((u) => u.phone), text)
    const ok = new Set<string>()
    const fehl = new Set<string>(ohneNummer.map((u) => u.id))
    let fehlerText = ''
    for (const u of mitNummer) {
      const r = ergebnis.get(u.phone.replace(/[^\d+]/g, ''))
      if (r?.ok) ok.add(u.id)
      else {
        fehl.add(u.id)
        if (r?.fehler) fehlerText = r.fehler
      }
    }
    markiereKanal(alarm.id, ok, 'sms', 'sent')
    markiereKanal(alarm.id, fehl, 'sms', 'failed')
    if (ok.size > 0) {
      const aktuell = ladeIntegrationen()
      aktuell.smsGateway.sentCount = (aktuell.smsGateway.sentCount ?? 0) + ok.size
      speichereIntegrationen(aktuell)
    }
    protokolliere(
      alarm.id,
      ok.size > 0
        ? `SMS an ${ok.size} Empfänger übergeben${fehl.size ? `, ${fehl.size} fehlgeschlagen` : ''}${ohneNummer.length ? ` (${ohneNummer.length} ohne Telefonnummer)` : ''}`
        : `SMS-Versand fehlgeschlagen${fehlerText ? `: ${fehlerText}` : ''}`,
    )
    veraendert = true
  } else if (smsEmpfaenger.length > 0) {
    markiereKanal(alarm.id, new Set(smsEmpfaenger.map((u) => u.id)), 'sms', 'failed')
    protokolliere(alarm.id, 'SMS nicht versendet: Das SMS-Gateway ist unter Integrationen nicht eingerichtet.')
    veraendert = true
  }

  // --- Microsoft Teams: Karte in den Kanal ---
  const teamsEmpfaenger = empfaengerVon(alarm, 'teams', nurUserIds)
  if (alarm.channels.includes('teams') && (!nurUserIds || teamsEmpfaenger.length > 0)) {
    if (integ.teams.enabled && integ.teams.webhookUrl) {
      const r = await sendeTeamsKarte(integ.teams, {
        titel,
        text: alarm.message,
        farbe: 'attention',
        fakten: [
          { name: 'Ausgelöst', wert: new Date(alarm.triggeredAt).toLocaleString('de-CH') },
          { name: 'Empfänger', wert: String(new Set(alarm.deliveries.map((d) => d.userId)).size) },
          ...(alarm.silent ? [{ name: 'Hinweis', wert: 'Stiller Alarm – kein Ton, keine Rückrufe' }] : []),
        ],
      })
      markiereKanal(alarm.id, new Set(teamsEmpfaenger.map((u) => u.id)), 'teams', r.ok ? 'sent' : 'failed')
      protokolliere(alarm.id, r.ok ? 'Meldung im Teams-Kanal veröffentlicht' : `Teams-Meldung fehlgeschlagen: ${r.fehler}`)
    } else {
      markiereKanal(alarm.id, new Set(teamsEmpfaenger.map((u) => u.id)), 'teams', 'failed')
      protokolliere(alarm.id, 'Teams-Meldung nicht versendet: Die Teams-Integration ist unter Integrationen nicht eingerichtet.')
    }
    veraendert = true
  }

  // --- Telefonkonferenz über Teams ---
  const konferenzEmpfaenger = empfaengerVon(alarm, 'conference', nurUserIds)
  const konferenzSchonAngelegt = (findAlarm(alarm.id)?.log ?? alarm.log).some((l) => l.message.startsWith('Telefonkonferenz eingerichtet'))
  if (alarm.channels.includes('conference') && !konferenzSchonAngelegt && (!nurUserIds || konferenzEmpfaenger.length > 0)) {
    if (integ.telephony.enabled) {
      try {
        const konferenz = await erstelleKonferenz(integ.telephony, `${titel} – Krisenkonferenz`)
        protokolliere(alarm.id, `Telefonkonferenz eingerichtet: ${konferenz.joinUrl}${konferenz.einwahl ? ` (Einwahl ${konferenz.einwahl})` : ''}`)
        markiereKanal(alarm.id, new Set(konferenzEmpfaenger.map((u) => u.id)), 'conference', 'sent')
        // Der Beitrittslink geht als Push an alle Konferenz-Empfänger …
        await sendPush(konferenzEmpfaenger.map((u) => u.id), {
          title: `${UEBUNG_PRAEFIX(alarm)}Telefonkonferenz: ${szenarioTitel(alarm)}`,
          body: `Jetzt beitreten: ${konferenz.joinUrl}${konferenz.einwahl ? ` – Einwahl ${konferenz.einwahl}` : ''}`,
          data: { kind: 'alarm', alarmId: alarm.id, scenarioId: alarm.scenarioId, url: konferenz.joinUrl },
          wichtig: true,
        })
        // … und zusätzlich in den Teams-Kanal, sofern eingerichtet
        if (integ.teams.enabled && integ.teams.webhookUrl) {
          await sendeTeamsKarte(integ.teams, {
            titel: `${UEBUNG_PRAEFIX(alarm)}Krisenkonferenz: ${szenarioTitel(alarm)}`,
            text: `Telefonkonferenz zum laufenden Alarm.${konferenz.einwahl ? ` Einwahl: ${konferenz.einwahl}.` : ''}`,
            linkTitel: 'Konferenz beitreten',
            linkUrl: konferenz.joinUrl,
          })
        }
      } catch (fehler) {
        markiereKanal(alarm.id, new Set(konferenzEmpfaenger.map((u) => u.id)), 'conference', 'failed')
        protokolliere(alarm.id, `Telefonkonferenz fehlgeschlagen: ${(fehler as Error).message}`)
      }
    } else {
      markiereKanal(alarm.id, new Set(konferenzEmpfaenger.map((u) => u.id)), 'conference', 'failed')
      protokolliere(alarm.id, 'Telefonkonferenz nicht eingerichtet: Sprachanrufe/Telefonkonferenz sind unter Integrationen nicht konfiguriert.')
    }
    veraendert = true
  }

  // --- Sprachanruf über Teams ---
  const anrufEmpfaenger = empfaengerVon(alarm, 'voice', nurUserIds)
  if (anrufEmpfaenger.length > 0) {
    if (integ.telephony.enabled) {
      const ergebnis = await starteAnrufe(integ.telephony, anrufEmpfaenger.map((u) => u.email), titel)
      const ok = new Set<string>()
      const fehl = new Set<string>()
      let fehlerText = ''
      for (const u of anrufEmpfaenger) {
        const r = ergebnis.get(u.email)
        if (r?.ok) ok.add(u.id)
        else {
          fehl.add(u.id)
          if (r?.fehler) fehlerText = r.fehler
        }
      }
      markiereKanal(alarm.id, ok, 'voice', 'sent')
      markiereKanal(alarm.id, fehl, 'voice', 'failed')
      protokolliere(
        alarm.id,
        ok.size > 0
          ? `Sprachanruf über Teams an ${ok.size} Person(en) gestartet${fehl.size ? `, ${fehl.size} fehlgeschlagen` : ''}`
          : `Sprachanrufe fehlgeschlagen${fehlerText ? `: ${fehlerText}` : ''}`,
      )
    } else {
      markiereKanal(alarm.id, new Set(anrufEmpfaenger.map((u) => u.id)), 'voice', 'failed')
      protokolliere(alarm.id, 'Sprachanrufe nicht gestartet: Sprachanrufe/Telefonkonferenz sind unter Integrationen nicht konfiguriert.')
    }
    veraendert = true
  }

  if (veraendert) broadcast('state')
}

// ---------- Lagemeldung und Entwarnung ----------

/**
 * Folge-Meldungen zu einem Alarm (Lagemeldung, weitere Meldung, Entwarnung)
 * über SMS und Teams – an dieselben Empfänger wie der Alarm selbst.
 */
export async function sendeInfoKanaele(
  alarm: Alarm,
  art: 'lage' | 'meldung' | 'fehlalarm' | 'entwarnung',
  text: string,
): Promise<void> {
  const integ = ladeIntegrationen()
  const titelArt =
    art === 'entwarnung' ? 'Entwarnung' : art === 'fehlalarm' ? 'Fehlalarm gemeldet' : art === 'meldung' ? 'Weitere Meldung' : 'Lagemeldung'
  const titel = `${UEBUNG_PRAEFIX(alarm)}${titelArt}: ${szenarioTitel(alarm)}`

  if (alarm.channels.includes('sms') && integ.smsGateway.enabled) {
    const empfaenger = empfaengerVon(alarm, 'sms').filter((u) => u.phone.trim())
    if (empfaenger.length > 0) {
      const ergebnis = await sendeSms(integ.smsGateway, empfaenger.map((u) => u.phone), `${titel} – ${text}`)
      const erfolgreich = [...ergebnis.values()].filter((r) => r.ok).length
      if (erfolgreich > 0) {
        const aktuell = ladeIntegrationen()
        aktuell.smsGateway.sentCount = (aktuell.smsGateway.sentCount ?? 0) + erfolgreich
        speichereIntegrationen(aktuell)
      }
      protokolliere(alarm.id, `${titelArt} per SMS an ${erfolgreich} von ${empfaenger.length} Empfängern übergeben`)
      broadcast('state')
    }
  }

  if (alarm.channels.includes('teams') && integ.teams.enabled && integ.teams.webhookUrl) {
    await sendeTeamsKarte(integ.teams, {
      titel,
      text,
      farbe: art === 'entwarnung' ? 'good' : 'attention',
    })
  }
}
