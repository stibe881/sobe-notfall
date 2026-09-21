import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { CheckCircle2, Siren } from 'lucide-react'
import type { AppState, Alarm, AlarmButton, AlarmPlan, Channel, Delivery, EscalationLevel, Group, Location, LoneWorkSession, Scenario, Session, User, Webhook, AuditEntry } from './types'

/** Datenbestand, wie ihn der Alarmserver liefert – ohne lokale Anteile */
export type ServerData = Omit<AppState, 'mode' | 'session' | 'currentUserId' | 'scenarioContentVersion' | 'authVersion'>
import { CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS } from './types'
import { LIVE_INITIAL_PASSWORD, createLiveInitialState, integrationenMitVorgaben } from './data/seed'
import { authenticate, hashPassword, passwordProblem, randomSalt, verifyPassword } from './lib/auth'
import { ApiError, api, authToken, setAuthToken, subscribeToServer } from './lib/api'

/** Erhöhen, wenn gespeicherte Passwortdaten einmalig korrigiert werden müssen */


export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ---------- Actions ----------

export type Action =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_PASSWORD'; userId: string; password: string; mustChange?: boolean }
  | { type: 'SET_CURRENT_USER'; userId: string }
  | { type: 'SET_PREVIEW_USER'; userId: string | null }
  | { type: 'UPSERT_USER'; user: User; password?: string }
  | { type: 'DELETE_USER'; userId: string }
  | { type: 'IMPORT_USERS'; users: User[] }
  | { type: 'UPSERT_GROUP'; group: Group }
  | { type: 'DELETE_GROUP'; groupId: string }
  | { type: 'UPSERT_LOCATION'; location: Location }
  | { type: 'DELETE_LOCATION'; locationId: string }
  | { type: 'UPSERT_SCENARIO'; scenario: Scenario }
  | { type: 'DELETE_SCENARIO'; scenarioId: string }
  | { type: 'UPSERT_PLAN'; plan: AlarmPlan }
  | { type: 'DELETE_PLAN'; planId: string }
  | { type: 'TRIGGER_ALARM'; alarm: Alarm; audit: string }
  | { type: 'END_ALARM'; alarmId: string; byUserId: string; note?: string }
  | { type: 'ALARM_UPDATE'; alarmId: string; message: string; kind: 'lage' | 'fehlalarm' }
  | { type: 'ACK_ALARM'; alarmId: string; userId: string; ack: 'acknowledged' | 'declined' }
  | { type: 'TICK'; now: number }
  | { type: 'UPSERT_BUTTON'; button: AlarmButton }
  | { type: 'DELETE_BUTTON'; buttonId: string }
  | { type: 'START_LONE_WORK'; session: LoneWorkSession }
  | { type: 'EXTEND_LONE_WORK'; sessionId: string; minutes: number }
  | { type: 'COMPLETE_LONE_WORK'; sessionId: string }
  | { type: 'UPDATE_INTEGRATIONS'; integrations: AppState['integrations'] }
  | { type: 'UPSERT_WEBHOOK'; webhook: Webhook }
  | { type: 'DELETE_WEBHOOK'; webhookId: string }
  | { type: 'ADD_ACCESS_CODE'; locationId: string }
  | { type: 'ADD_CONTACT'; contact: AppState['contacts'][number] }
  | { type: 'DELETE_CONTACT'; contactId: string }
  | { type: 'AUDIT'; entryType: string; message: string; userId?: string }
  | { type: 'ADOPT_SERVER'; data: ServerData; session: Session | null }

/** Ist dieses Konto der einzige verbleibende Administrator? */
export function isLastAdmin(state: AppState, userId: string): boolean {
  const admins = state.users.filter((u) => u.role === 'admin')
  return admins.length === 1 && admins[0].id === userId
}

function audit(state: AppState, type: string, message: string, userId?: string): AuditEntry[] {
  const entry: AuditEntry = { id: uid('audit'), ts: Date.now(), type, message, userId }
  return [entry, ...state.audit].slice(0, 300)
}

// ---------- Alarm-Logik ----------

/** Empfänger eines Alarms bestimmen: Gruppen ∩ Standorte, Abwesenheiten ausfiltern */
/**
 * Empfänger eines Alleinarbeits-Alarms: gewählte Gruppen am Standort plus
 * gewählte Einzelpersonen; ohne Wahl die Standardgruppen. Nie die Person selbst.
 */
export function alleinarbeitEmpfaenger(state: AppState, s: LoneWorkSession): { groupIds: string[]; recipientUserIds?: string[] } {
  const groupIds = s.alertGroupIds?.length ? s.alertGroupIds : LONE_WORK_DEFAULT_GROUPS
  const einzelne = (s.alertUserIds ?? []).filter((id) => id !== s.userId)
  if (einzelne.length === 0) return { groupIds }
  const ausGruppen = resolveRecipients(state, groupIds, [s.locationId]).map((u) => u.id)
  return { groupIds, recipientUserIds: [...new Set([...ausGruppen, ...einzelne])].filter((id) => id !== s.userId) }
}

export function resolveRecipients(state: AppState, groupIds: string[], locationIds: string[]): User[] {
  const today = new Date().toISOString().slice(0, 10)
  return state.users.filter((u) => {
    const inGroup = groupIds.length === 0 || u.groupIds.some((g) => groupIds.includes(g))
    const inLocation = locationIds.length === 0 || locationIds.includes(u.locationId)
    const absent = u.absence && u.absence.from <= today && today <= u.absence.to
    return inGroup && inLocation && !absent
  })
}

export function buildDeliveries(recipients: User[], channels: Channel[]): Delivery[] {
  const deliveries: Delivery[] = []
  for (const user of recipients) {
    for (const channel of channels) {
      deliveries.push({ id: uid('dlv'), userId: user.id, channel, status: 'pending', ack: 'none', updatedAt: Date.now() })
    }
  }
  return deliveries
}

export interface TriggerOptions {
  scenarioId: string
  message: string
  silent: boolean
  requireAck: boolean
  channels: Channel[]
  groupIds: string[]
  locationIds: string[]
  triggeredByUserId: string
  triggeredVia: Alarm['triggeredVia']
  planId?: string
  escalation?: EscalationLevel[]
  /** Gezielte Empfänger (z. B. einzelnes Krisenteam-Mitglied) statt Gruppen-/Standortauflösung */
  recipientUserIds?: string[]
  /** Übung: gleiche Abläufe, als solche gekennzeichnet und im Protokoll getrennt */
  drill?: boolean
}

/** Meldungen, die kein eigenes Ereignis sind (Einzelinfo, Krisenteam-Aufgebot) */
function istNebenmeldung(message: string): boolean {
  return message.startsWith('Info an') || message.startsWith('Krisenteam-Aufgebot')
}

/** Läuft für dieses Szenario am selben Standort bereits ein Alarm? Dann wird zusammengeführt. */
export function laufenderAlarmZu(alarms: Alarm[], neu: Alarm): Alarm | null {
  if (istNebenmeldung(neu.message)) return null
  return (
    alarms.find(
      (a) =>
        a.status === 'active' && a.scenarioId === neu.scenarioId && Boolean(a.drill) === Boolean(neu.drill) &&
        !istNebenmeldung(a.message) && Date.now() - a.triggeredAt < 2 * 3600_000 &&
        (a.locationIds.length === 0 || neu.locationIds.length === 0 || a.locationIds.some((id) => neu.locationIds.includes(id))),
    ) ?? null
  )
}

export function createAlarm(state: AppState, opts: TriggerOptions): Alarm {
  const recipients = opts.recipientUserIds
    ? state.users.filter((u) => opts.recipientUserIds!.includes(u.id))
    : resolveRecipients(state, opts.groupIds, opts.locationIds)
  const now = Date.now()
  return {
    id: uid('alarm'),
    scenarioId: opts.scenarioId,
    planId: opts.planId,
    message: opts.message,
    silent: opts.silent,
    requireAck: opts.requireAck,
    triggeredByUserId: opts.triggeredByUserId,
    triggeredVia: opts.triggeredVia,
    triggeredAt: now,
    drill: opts.drill || undefined,
    locationIds: opts.locationIds,
    groupIds: opts.groupIds,
    channels: opts.channels,
    status: 'active',
    escalationStage: 0,
    escalation: opts.escalation ?? [],
    deliveries: buildDeliveries(recipients, opts.channels),
    log: [
      { ts: now, message: `Alarm ausgelöst (${opts.triggeredVia}) – ${recipients.length} Empfänger über ${opts.channels.map((c) => CHANNEL_LABELS[c]).join(', ')}` },
      ...(opts.silent ? [{ ts: now, message: 'Stiller Alarm – keine Signaltöne auf Empfängergeräten.' }] : []),
    ],
  }
}

/** Eskalationsstufen und Alleinarbeits-Timer; den echten Versand rechnet der Server */
function tick(state: AppState, now: number): AppState {
  let changed = false

  const alarms = state.alarms.map((alarm) => {
    if (alarm.status !== 'active') return alarm
    let aChanged = false
    const deliveries = alarm.deliveries

    // 2. Eskalation
    const log = [...alarm.log]
    let escalationStage = alarm.escalationStage
    let nextDeliveries = deliveries
    const nextLevel = alarm.escalation[escalationStage]
    const ackDone = alarm.requireAck && alarm.deliveries.length > 0 &&
      uniqueUserIds(alarm.deliveries).every((uidX) => alarm.deliveries.some((d) => d.userId === uidX && d.ack === 'acknowledged'))
    if (nextLevel && !ackDone && now - alarm.triggeredAt > nextLevel.afterMinutes * 60_000) {
      escalationStage += 1
      aChanged = true
      const recipients = resolveRecipients(state, nextLevel.groupIds, alarm.locationIds)
      nextDeliveries = [...deliveries, ...buildDeliveries(recipients, nextLevel.channels)]
      log.push({
        ts: now,
        message: `Eskalationsstufe ${escalationStage} gezündet: ${recipients.length} weitere Empfänger (${nextLevel.channels.map((c) => CHANNEL_LABELS[c]).join(', ')})${nextLevel.notifyEmergencyServices ? ' – Blaulichtorganisationen benachrichtigt' : ''}`,
      })
    }

    if (!aChanged) return alarm
    changed = true
    return { ...alarm, deliveries: nextDeliveries, log, escalationStage }
  })

  // 3. Alleinarbeits-Timer: abgelaufen -> Alarm auslösen
  let loneWorkSessions = state.loneWorkSessions
  let newAlarms: Alarm[] = []
  let newAudit = state.audit
  const expired = state.loneWorkSessions.filter((s) => s.status === 'running' && now > s.expiresAt)
  if (expired.length > 0) {
    changed = true
    loneWorkSessions = state.loneWorkSessions.map((s) =>
      expired.some((e) => e.id === s.id) ? { ...s, status: 'alarm' as const } : s,
    )
    for (const session of expired) {
      const user = state.users.find((u) => u.id === session.userId)
      const ziel = alleinarbeitEmpfaenger(state, session)
      const alarm = createAlarm(state, {
        scenarioId: 'sc-medizin',
        message: `ALLEINARBEIT: Timer von ${user ? user.firstName + ' ' + user.lastName : session.userId} abgelaufen (Tätigkeit: ${session.activity}). Keine Rückmeldung – bitte sofort prüfen!`,
        silent: session.silent,
        requireAck: true,
        channels: ['push', 'sms', 'voice'],
        groupIds: ziel.groupIds,
        recipientUserIds: ziel.recipientUserIds,
        locationIds: [session.locationId],
        triggeredByUserId: session.userId,
        triggeredVia: 'timer',
        escalation: [{ afterMinutes: 5, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
      })
      newAlarms = [alarm, ...newAlarms]
      newAudit = [{ id: uid('audit'), ts: now, type: 'alarm', message: `Automatischer Alleinarbeiter-Alarm: Timer abgelaufen (${user?.firstName} ${user?.lastName})`, userId: session.userId }, ...newAudit].slice(0, 300)
    }
  }

  if (!changed) return state
  return { ...state, alarms: [...newAlarms, ...alarms], loneWorkSessions, audit: newAudit }
}

function uniqueUserIds(deliveries: Delivery[]): string[] {
  return [...new Set(deliveries.map((d) => d.userId))]
}

// ---------- Reducer ----------

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN': {
      const user = state.users.find((u) => u.id === action.userId)
      if (!user) return state
      return {
        ...state,
        session: { userId: user.id, loginAt: Date.now() },
        currentUserId: user.id,
        users: state.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: Date.now() } : u)),
        audit: audit(state, 'anmeldung', `Anmeldung im Webportal: ${user.firstName} ${user.lastName} (${user.email})`, user.id),
      }
    }
    case 'LOGOUT': {
      const user = state.users.find((u) => u.id === state.session?.userId)
      return {
        ...state,
        session: null,
        audit: user ? audit(state, 'anmeldung', `Abmeldung: ${user.firstName} ${user.lastName}`, user.id) : state.audit,
      }
    }
    case 'SET_PASSWORD': {
      const user = state.users.find((u) => u.id === action.userId)
      if (!user) return state
      const salt = randomSalt()
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.userId
            ? { ...u, passwordSalt: salt, passwordHash: hashPassword(action.password, salt), mustChangePassword: action.mustChange ?? false }
            : u,
        ),
        audit: audit(state, 'anmeldung', `Passwort gesetzt für ${user.firstName} ${user.lastName}`, action.userId),
      }
    }
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: action.userId }
    case 'SET_PREVIEW_USER': {
      // Nur die Ansicht wechselt; angemeldet bleibt das eigene Konto
      const eigene = state.session?.userId ?? state.currentUserId
      return { ...state, previewUserId: action.userId && action.userId !== eigene ? action.userId : undefined }
    }
    case 'UPSERT_USER': {
      const exists = state.users.some((u) => u.id === action.user.id)
      // Der letzte Administrator darf sich nicht selbst die Rechte entziehen
      if (exists && isLastAdmin(state, action.user.id) && action.user.role !== 'admin') return state
      const salt = action.password ? randomSalt() : undefined
      const user: User = action.password
        ? { ...action.user, passwordSalt: salt, passwordHash: hashPassword(action.password, salt!) }
        : action.user
      return {
        ...state,
        users: exists ? state.users.map((u) => (u.id === user.id ? user : u)) : [...state.users, user],
        audit: audit(state, 'admin', `${exists ? 'Benutzer aktualisiert' : 'Benutzer erstellt'}: ${user.firstName} ${user.lastName}`),
      }
    }
    case 'DELETE_USER':
      // Ohne Administrator liesse sich der Datenbestand nicht mehr verwalten
      if (isLastAdmin(state, action.userId)) return state
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.userId),
        // Wer sich selbst löscht, wird abgemeldet
        session: state.session?.userId === action.userId ? null : state.session,
        audit: audit(state, 'admin', 'Benutzer gelöscht'),
      }
    case 'IMPORT_USERS':
      return { ...state, users: [...state.users, ...action.users], audit: audit(state, 'admin', `CSV-Import: ${action.users.length} Benutzer importiert`) }
    case 'UPSERT_GROUP': {
      const exists = state.groups.some((g) => g.id === action.group.id)
      return {
        ...state,
        groups: exists ? state.groups.map((g) => (g.id === action.group.id ? action.group : g)) : [...state.groups, action.group],
        audit: audit(state, 'admin', `Gruppe ${exists ? 'aktualisiert' : 'erstellt'}: ${action.group.name}`),
      }
    }
    case 'DELETE_GROUP':
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.groupId),
        users: state.users.map((u) => ({ ...u, groupIds: u.groupIds.filter((g) => g !== action.groupId) })),
        audit: audit(state, 'admin', 'Gruppe gelöscht'),
      }
    case 'UPSERT_LOCATION': {
      const exists = state.locations.some((l) => l.id === action.location.id)
      return {
        ...state,
        locations: exists ? state.locations.map((l) => (l.id === action.location.id ? action.location : l)) : [...state.locations, action.location],
        audit: audit(state, 'admin', `Standort ${exists ? 'aktualisiert' : 'erstellt'}: ${action.location.name}`),
      }
    }
    case 'DELETE_LOCATION':
      return { ...state, locations: state.locations.filter((l) => l.id !== action.locationId), audit: audit(state, 'admin', 'Standort gelöscht') }
    case 'UPSERT_SCENARIO': {
      const exists = state.scenarios.some((s) => s.id === action.scenario.id)
      return {
        ...state,
        scenarios: exists ? state.scenarios.map((s) => (s.id === action.scenario.id ? action.scenario : s)) : [...state.scenarios, action.scenario],
        audit: audit(state, 'cms', `Szenario ${exists ? 'aktualisiert' : 'erstellt'}: ${action.scenario.title} – Änderung sofort an alle Apps verteilt`),
      }
    }
    case 'DELETE_SCENARIO':
      return { ...state, scenarios: state.scenarios.filter((s) => s.id !== action.scenarioId), audit: audit(state, 'cms', 'Szenario gelöscht') }
    case 'UPSERT_PLAN': {
      const exists = state.plans.some((p) => p.id === action.plan.id)
      return {
        ...state,
        plans: exists ? state.plans.map((p) => (p.id === action.plan.id ? action.plan : p)) : [...state.plans, action.plan],
        audit: audit(state, 'admin', `Alarmplan ${exists ? 'aktualisiert' : 'erstellt'}: ${action.plan.name}`),
      }
    }
    case 'DELETE_PLAN':
      return { ...state, plans: state.plans.filter((p) => p.id !== action.planId), audit: audit(state, 'admin', 'Alarmplan gelöscht') }
    case 'TRIGGER_ALARM': {
      const praefix = action.alarm.drill ? 'ÜBUNG: ' : ''
      // Zweite Auslösung zum selben Ereignis: dem laufenden Alarm hinzufügen (wie der Server)
      const laufend = laufenderAlarmZu(state.alarms, action.alarm)
      if (laufend) {
        const ausloeser = state.users.find((u) => u.id === action.alarm.triggeredByUserId)
        const bekannt = new Set(laufend.deliveries.map((d) => d.userId))
        const update = {
          ts: Date.now(), kind: 'meldung' as const, byUserId: action.alarm.triggeredByUserId,
          message: `Weitere Meldung von ${ausloeser ? `${ausloeser.firstName} ${ausloeser.lastName}` : '?'}: ${action.alarm.message}`,
        }
        return {
          ...state,
          alarms: state.alarms.map((a) =>
            a.id !== laufend.id ? a : {
              ...a,
              locationIds: a.locationIds.length === 0 ? [] : [...new Set([...a.locationIds, ...action.alarm.locationIds])],
              updates: [...(a.updates ?? []), update],
              deliveries: [...a.deliveries, ...action.alarm.deliveries.filter((d) => !bekannt.has(d.userId))],
              log: [...a.log, { ts: update.ts, message: `Zweite Auslösung zusammengeführt: ${action.alarm.message}` }],
            },
          ),
          audit: audit(state, 'alarm', `${praefix}Weitere Meldung zum laufenden Alarm: ${action.alarm.message}`, action.alarm.triggeredByUserId),
        }
      }
      return { ...state, alarms: [action.alarm, ...state.alarms], audit: audit(state, 'alarm', praefix + action.audit, action.alarm.triggeredByUserId) }
    }
    case 'END_ALARM': {
      const note = action.note?.trim() || undefined
      const betroffen = state.alarms.find((a) => a.id === action.alarmId)
      return {
        ...state,
        alarms: state.alarms.map((a) =>
          a.id === action.alarmId
            ? {
                ...a, status: 'ended' as const, endedAt: Date.now(), endNote: note,
                log: [...a.log, { ts: Date.now(), message: `Alarm beendet – Entwarnung an alle Empfänger versendet.${note ? ` «${note}»` : ''}` }],
              }
            : a,
        ),
        audit: audit(state, 'alarm', `${betroffen?.drill ? 'ÜBUNG: ' : ''}Alarm beendet (Entwarnung)${note ? `: ${note}` : ''}`, action.byUserId),
      }
    }
    case 'ALARM_UPDATE': {
      const person = state.users.find((u) => u.id === state.currentUserId)
      const name = person ? `${person.firstName} ${person.lastName}` : '?'
      const text = action.kind === 'fehlalarm'
        ? `FEHLALARM gemeldet von ${name}${action.message ? `: ${action.message}` : ''} – bitte auf die Entwarnung durch den Krisenstab warten.`
        : action.message
      const betroffen = state.alarms.find((a) => a.id === action.alarmId)
      return {
        ...state,
        alarms: state.alarms.map((a) =>
          a.id === action.alarmId
            ? {
                ...a,
                updates: [...(a.updates ?? []), { ts: Date.now(), kind: action.kind, byUserId: state.currentUserId, message: text }],
                log: [...a.log, { ts: Date.now(), message: action.kind === 'fehlalarm' ? text : `Lagemeldung von ${name}: ${action.message}` }],
              }
            : a,
        ),
        audit: audit(state, 'alarm', `${betroffen?.drill ? 'ÜBUNG: ' : ''}${action.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : 'Lagemeldung'}: ${action.message || '(ohne Text)'}`, state.currentUserId),
      }
    }
    case 'ACK_ALARM':
      return {
        ...state,
        alarms: state.alarms.map((a) => {
          if (a.id !== action.alarmId) return a
          const user = state.users.find((u) => u.id === action.userId)
          return {
            ...a,
            deliveries: a.deliveries.map((d) => (d.userId === action.userId ? { ...d, ack: action.ack } : d)),
            log: [...a.log, { ts: Date.now(), message: `${user ? user.firstName + ' ' + user.lastName : action.userId} hat ${action.ack === 'acknowledged' ? 'quittiert (nimmt teil)' : 'abgelehnt (nicht verfügbar)'}` }],
          }
        }),
      }
    case 'TICK':
      return tick(state, action.now)
    case 'UPSERT_BUTTON': {
      const exists = state.buttons.some((b) => b.id === action.button.id)
      return {
        ...state,
        buttons: exists ? state.buttons.map((b) => (b.id === action.button.id ? action.button : b)) : [...state.buttons, action.button],
        audit: audit(state, 'hardware', `Alarmknopf ${exists ? 'aktualisiert' : 'registriert'}: ${action.button.name} (${action.button.serial})`),
      }
    }
    case 'DELETE_BUTTON':
      return { ...state, buttons: state.buttons.filter((b) => b.id !== action.buttonId), audit: audit(state, 'hardware', 'Alarmknopf entfernt') }
    case 'START_LONE_WORK': {
      const user = state.users.find((u) => u.id === action.session.userId)
      return {
        ...state,
        loneWorkSessions: [action.session, ...state.loneWorkSessions],
        audit: audit(state, 'alleinarbeit', `Alleinarbeit gestartet: ${user?.firstName} ${user?.lastName}, Timer ${action.session.durationMin} Min.`, action.session.userId),
      }
    }
    case 'EXTEND_LONE_WORK':
      return {
        ...state,
        loneWorkSessions: state.loneWorkSessions.map((s) =>
          s.id === action.sessionId ? { ...s, expiresAt: s.expiresAt + action.minutes * 60_000 } : s,
        ),
        audit: audit(state, 'alleinarbeit', `Alleinarbeits-Timer verlängert (+${action.minutes} Min. – Lebenszeichen erhalten)`),
      }
    case 'COMPLETE_LONE_WORK':
      return {
        ...state,
        loneWorkSessions: state.loneWorkSessions.map((s) => (s.id === action.sessionId ? { ...s, status: 'completed' as const } : s)),
        audit: audit(state, 'alleinarbeit', 'Alleinarbeit sicher beendet'),
      }
    case 'UPDATE_INTEGRATIONS':
      return { ...state, integrations: action.integrations, audit: audit(state, 'integration', 'Integrations-Einstellungen aktualisiert') }
    case 'UPSERT_WEBHOOK': {
      const exists = state.integrations.webhooks.some((w) => w.id === action.webhook.id)
      return {
        ...state,
        integrations: {
          ...state.integrations,
          webhooks: exists
            ? state.integrations.webhooks.map((w) => (w.id === action.webhook.id ? action.webhook : w))
            : [...state.integrations.webhooks, action.webhook],
        },
        audit: audit(state, 'integration', `Webhook ${exists ? 'aktualisiert' : 'erstellt'}: ${action.webhook.name}`),
      }
    }
    case 'DELETE_WEBHOOK':
      return {
        ...state,
        integrations: { ...state.integrations, webhooks: state.integrations.webhooks.filter((w) => w.id !== action.webhookId) },
        audit: audit(state, 'integration', 'Webhook gelöscht'),
      }
    case 'ADD_ACCESS_CODE': {
      const loc = state.locations.find((l) => l.id === action.locationId)
      const prefix = (loc?.name.slice(0, 2) ?? 'XX').toUpperCase()
      const code = `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      return {
        ...state,
        integrations: {
          ...state.integrations,
          accessCodes: [{ code, locationId: action.locationId, role: 'mitarbeiter', createdAt: Date.now(), used: 0 }, ...state.integrations.accessCodes],
        },
        audit: audit(state, 'integration', `Zugangscode für Rollout erstellt: ${code}`),
      }
    }
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.contact], audit: audit(state, 'admin', `Notfallkontakt hinzugefügt: ${action.contact.name}`) }
    case 'DELETE_CONTACT':
      return { ...state, contacts: state.contacts.filter((c) => c.id !== action.contactId), audit: audit(state, 'admin', 'Notfallkontakt gelöscht') }
    case 'AUDIT':
      return { ...state, audit: audit(state, action.entryType, action.message, action.userId) }
    case 'ADOPT_SERVER': {
      // Der Server ist die Wahrheit; die Anmeldung bleibt lokal.
      // Fehlt eine Sammlung in der Antwort, bleibt die bisherige stehen – so führt
      // eine unvollständige Antwort nie zu undefined im Zustand.
      const d = action.data
      // Die Anmeldeart überlebt den regelmässigen Abgleich – sie ist beim
      // Anmelden bekannt, nicht bei jedem Neuladen des Datenbestands
      const session = action.session
        ? { ...action.session, via: action.session.via ?? state.session?.via }
        : action.session
      return {
        ...state,
        users: d.users ?? state.users,
        groups: d.groups ?? state.groups,
        locations: d.locations ?? state.locations,
        scenarios: d.scenarios ?? state.scenarios,
        plans: d.plans ?? state.plans,
        alarms: d.alarms ?? [],
        buttons: d.buttons ?? state.buttons,
        loneWorkSessions: d.loneWorkSessions ?? [],
        // Ein älterer Server kennt neue Abschnitte (Telefonie, LoRaWAN) noch nicht
        integrations: d.integrations ? integrationenMitVorgaben(d.integrations) : state.integrations,
        contacts: d.contacts ?? state.contacts,
        audit: d.audit ?? [],
        session,
        currentUserId: session?.userId ?? state.currentUserId,
      }
    }
    default:
      return state
  }
}

// ---------- Toasts: automatische Rückmeldung für Aktionen ----------

interface Toast {
  id: number
  message: string
  kind: 'success' | 'alarm'
}

function toastForAction(action: Action): Toast['message'] | { message: string; kind: 'alarm' } | null {
  switch (action.type) {
    case 'TRIGGER_ALARM':
      return { message: action.alarm.drill ? 'Übung gestartet – Empfänger werden als Übung benachrichtigt' : 'Alarm ausgelöst – Empfänger werden benachrichtigt', kind: 'alarm' }
    case 'ALARM_UPDATE':
      return action.kind === 'fehlalarm' ? 'Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung' : 'Lagemeldung an alle Empfänger gesendet'
    case 'END_ALARM':
      return 'Alarm beendet – Entwarnung versendet'
    case 'ACK_ALARM':
      return action.ack === 'acknowledged' ? 'Quittiert – Sie nehmen teil' : 'Als nicht verfügbar gemeldet'
    case 'LOGOUT':
      return 'Abgemeldet'
    case 'SET_PASSWORD':
      return 'Passwort gespeichert'
    case 'UPSERT_USER':
      return action.password ? 'Benutzer und Passwort gespeichert' : 'Benutzer gespeichert'
    case 'DELETE_USER':
      return 'Benutzer gelöscht'
    case 'IMPORT_USERS':
      return `${action.users.length} Benutzer importiert`
    case 'UPSERT_GROUP':
      return 'Gruppe gespeichert'
    case 'DELETE_GROUP':
      return 'Gruppe gelöscht'
    case 'UPSERT_LOCATION':
      return 'Standort gespeichert'
    case 'DELETE_LOCATION':
      return 'Standort gelöscht'
    case 'UPSERT_SCENARIO':
      return 'Szenario gespeichert und an alle Apps verteilt'
    case 'DELETE_SCENARIO':
      return 'Szenario gelöscht'
    case 'UPSERT_PLAN':
      return 'Alarmplan gespeichert'
    case 'DELETE_PLAN':
      return 'Alarmplan gelöscht'
    case 'UPSERT_BUTTON':
      return 'Alarmknopf gespeichert'
    case 'DELETE_BUTTON':
      return 'Alarmknopf entfernt'
    case 'START_LONE_WORK':
      return 'Alleinarbeits-Timer gestartet'
    case 'EXTEND_LONE_WORK':
      return 'Lebenszeichen erhalten – Timer verlängert'
    case 'COMPLETE_LONE_WORK':
      return 'Alleinarbeit sicher beendet'
    case 'UPSERT_WEBHOOK':
      return 'Webhook gespeichert'
    case 'DELETE_WEBHOOK':
      return 'Webhook gelöscht'
    case 'ADD_ACCESS_CODE':
      return 'Zugangscode erstellt'
    case 'ADD_CONTACT':
      return 'Notfallkontakt gespeichert'
    case 'DELETE_CONTACT':
      return 'Notfallkontakt gelöscht'
    case 'UPDATE_INTEGRATIONS':
      return 'Einstellungen gespeichert'
    default:
      return null
  }
}

function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed z-[60] bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            t.kind === 'alarm' ? 'bg-brand-600' : 'bg-slate-800'
          }`}
          role="status"
        >
          {t.kind === 'alarm' ? <Siren size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />}
          {t.message}
        </div>
      ))}
    </div>
  )
}


/** Aktive ausgehende Webhooks bei Alarmauslösung tatsächlich aufrufen */
function sendOutboundWebhooks(state: AppState, alarm: Alarm) {
  const scenario = state.scenarios.find((s) => s.id === alarm.scenarioId)
  const payload = JSON.stringify({
    event: 'alarm.triggered',
    alarmId: alarm.id,
    scenario: scenario?.title ?? alarm.scenarioId,
    message: alarm.message,
    silent: alarm.silent,
    triggeredAt: new Date(alarm.triggeredAt).toISOString(),
    locations: alarm.locationIds,
    groups: alarm.groupIds,
    channels: alarm.channels,
  })
  for (const wh of state.integrations.webhooks.filter((w) => w.active && w.direction === 'outbound')) {
    fetch(wh.url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => {
      // Zielsystem nicht erreichbar – Alarm bleibt trotzdem erfasst
    })
  }
}

/**
 * Eine Aktion auf dem Server ausführen.
 *
 * Der Server ist dort die einzige Wahrheit: Die Aktion wird nicht lokal auf den
 * Zustand angewendet, sondern verschickt; der neue Stand kommt anschliessend
 * über /state zurück. Gibt true zurück, wenn die Aktion behandelt wurde.
 */
/** Aktionen, die in der App-Vorschau als andere Person nicht ausgeführt werden */
const VORSCHAU_GESPERRT = new Set<Action['type']>([
  'TRIGGER_ALARM', 'ACK_ALARM', 'END_ALARM', 'ALARM_UPDATE',
  'START_LONE_WORK', 'EXTEND_LONE_WORK', 'COMPLETE_LONE_WORK', 'SET_PASSWORD',
])

async function serverEffekt(action: Action, state: AppState): Promise<boolean | 'merged'> {
  switch (action.type) {
    case 'UPSERT_USER': {
      const u = action.user
      await api.saveUser({
        id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone,
        role: u.role, groupIds: u.groupIds, locationId: u.locationId, language: u.language,
        absence: u.absence, partTimeNote: u.partTimeNote, mustChangePassword: u.mustChangePassword,
        ...(action.password ? { password: action.password } : {}),
      })
      return true
    }
    case 'DELETE_USER':
      await api.deleteUser(action.userId)
      return true
    case 'SET_PASSWORD':
      await api.setUserPassword(action.userId, action.password, action.mustChange ?? false)
      return true
    case 'IMPORT_USERS':
      for (const u of action.users) await api.saveUser(u)
      return true
    case 'UPSERT_GROUP':
      await api.saveDoc('groups', action.group)
      return true
    case 'DELETE_GROUP':
      await api.deleteDoc('groups', action.groupId)
      return true
    case 'UPSERT_LOCATION':
      await api.saveDoc('locations', action.location)
      return true
    case 'DELETE_LOCATION':
      await api.deleteDoc('locations', action.locationId)
      return true
    case 'UPSERT_SCENARIO':
      await api.saveDoc('scenarios', action.scenario)
      return true
    case 'DELETE_SCENARIO':
      await api.deleteDoc('scenarios', action.scenarioId)
      return true
    case 'UPSERT_PLAN':
      await api.saveDoc('plans', action.plan)
      return true
    case 'DELETE_PLAN':
      await api.deleteDoc('plans', action.planId)
      return true
    case 'UPSERT_BUTTON':
      await api.saveDoc('buttons', action.button)
      return true
    case 'DELETE_BUTTON':
      await api.deleteDoc('buttons', action.buttonId)
      return true
    case 'ADD_CONTACT':
      await api.saveDoc('contacts', action.contact)
      return true
    case 'DELETE_CONTACT':
      await api.deleteDoc('contacts', action.contactId)
      return true
    case 'UPDATE_INTEGRATIONS':
      await api.saveIntegrations(action.integrations)
      return true
    case 'UPSERT_WEBHOOK': {
      const webhooks = state.integrations.webhooks.some((w) => w.id === action.webhook.id)
        ? state.integrations.webhooks.map((w) => (w.id === action.webhook.id ? action.webhook : w))
        : [...state.integrations.webhooks, action.webhook]
      await api.saveIntegrations({ ...state.integrations, webhooks })
      return true
    }
    case 'DELETE_WEBHOOK':
      await api.saveIntegrations({ ...state.integrations, webhooks: state.integrations.webhooks.filter((w) => w.id !== action.webhookId) })
      return true
    case 'ADD_ACCESS_CODE': {
      const code = `${action.locationId.slice(-2).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      await api.saveIntegrations({
        ...state.integrations,
        accessCodes: [{ code, locationId: action.locationId, role: 'mitarbeiter', createdAt: Date.now(), used: 0 }, ...state.integrations.accessCodes],
      })
      return true
    }
    case 'TRIGGER_ALARM': {
      const a = action.alarm
      const antwort = await api.triggerAlarm({
        scenarioId: a.scenarioId, message: a.message, silent: a.silent, requireAck: a.requireAck,
        channels: a.channels, groupIds: a.groupIds, locationIds: a.locationIds,
        triggeredVia: a.triggeredVia, planId: a.planId, escalation: a.escalation, drill: a.drill,
        recipientUserIds: [...new Set(a.deliveries.map((d) => d.userId))],
      })
      return antwort.merged ? 'merged' : true
    }
    case 'END_ALARM':
      await api.endAlarm(action.alarmId, action.note ?? '')
      return true
    case 'ALARM_UPDATE':
      await api.updateAlarm(action.alarmId, action.message, action.kind)
      return true
    case 'ACK_ALARM':
      await api.ackAlarm(action.alarmId, action.ack)
      return true
    case 'START_LONE_WORK': {
      const s = action.session
      await api.startLoneWork({ activity: s.activity, durationMin: s.durationMin, locationId: s.locationId, silent: s.silent, alertGroupIds: s.alertGroupIds, alertUserIds: s.alertUserIds })
      return true
    }
    case 'EXTEND_LONE_WORK':
      await api.extendLoneWork(action.sessionId, action.minutes)
      return true
    case 'COMPLETE_LONE_WORK':
      await api.completeLoneWork(action.sessionId)
      return true
    default:
      // Rein lokale Aktionen (Modus, Ansicht, Tick) laufen weiter über den Reducer
      return false
  }
}

// ---------- Context / Provider ----------

export type ServerStatus = 'lokal' | 'verbindet' | 'verbunden' | 'getrennt'

interface StoreCtx {
  state: AppState
  dispatch: React.Dispatch<Action>
  /** Anmelden über den Alarmserver */
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => void
  /** Eigenes Passwort ändern */
  changePassword: (aktuell: string, neu: string) => Promise<{ ok: true } | { ok: false; error: string }>
  serverStatus: ServerStatus
  /**
   * Das bei der Anmeldung eingegebene Passwort – nur im Arbeitsspeicher, nie
   * gespeichert. Wird für den erzwungenen Erstwechsel gebraucht, damit die
   * Person es nicht ein zweites Mal eintippen muss.
   */
  knownPassword: string | null
  /** Datenbestand neu vom Server laden */
  refresh: () => void
}

const StoreContext = createContext<StoreCtx | null>(null)

/** Gerüst, bevor der Server geantwortet hat */
function leererLiveZustand(): AppState {
  const basis = createLiveInitialState()
  return { ...basis, users: [], alarms: [], loneWorkSessions: [], audit: [], session: null }
}

/** Der Datenbestand kommt immer vom Alarmserver, nie aus dem Browserspeicher */
function loadState(): AppState {
  return leererLiveZustand()
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadState)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const lastToast = useRef({ message: '', ts: 0 })

  const pushToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const now = Date.now()
    if (lastToast.current.message === message && now - lastToast.current.ts < 1500) return
    lastToast.current = { message, ts: now }
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const stateRef = useRef(state)
  // Wie die laufende Anmeldung zustande kam – für den erzwungenen Passwortwechsel
  const anmeldeArt = useRef<Session['via']>(undefined)
  stateRef.current = state
  /** markiert einen Zustand, der aus einem anderen Tab stammt */
  const adopted = useRef(false)

  const [serverStatus, setServerStatus] = useState<ServerStatus>('lokal')
  const [knownPassword, setKnownPassword] = useState<string | null>(null)

  /** Datenbestand vom Alarmserver holen */
  const refresh = useCallback(async () => {
    if (!authToken()) {
      setServerStatus('getrennt')
      return
    }
    try {
      const [{ user }, daten] = await Promise.all([api.me(), api.state()])
      rawDispatch({ type: 'ADOPT_SERVER', data: daten, session: { userId: user.id, loginAt: Date.now(), via: anmeldeArt.current } })
      setServerStatus('verbunden')
    } catch (fehler) {
      if (fehler instanceof ApiError && fehler.status === 401) {
        // Sitzung abgelaufen oder auf dem Server beendet
        setAuthToken(null)
        rawDispatch({ type: 'LOGOUT' })
        setServerStatus('verbunden')
      } else {
        setServerStatus('getrennt')
      }
    }
  }, [])

  // Rücksprung der Microsoft-Anmeldung: Der Server hängt das Sitzungs-Token an
  // die Adresse an (#sso=…). Token übernehmen, Adresse bereinigen, Stand laden.
  useEffect(() => {
    const treffer = window.location.hash.match(/[#&]sso=([^&]+)/)
    if (!treffer) return
    setAuthToken(decodeURIComponent(treffer[1]))
    window.history.replaceState(null, '', window.location.pathname + '#/')
    anmeldeArt.current = 'sso'
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback<StoreCtx['login']>(async (email, password) => {
    try {
      const { token } = await api.login(email, password)
      setAuthToken(token)
      setKnownPassword(password)
      anmeldeArt.current = 'password'
      await refresh()
      return { ok: true }
    } catch (fehler) {
      return { ok: false, error: fehler instanceof ApiError ? fehler.message : 'Anmeldung fehlgeschlagen.' }
    }
  }, [refresh])

  const logout = useCallback(() => {
    api.logout().catch(() => {
      // Server nicht erreichbar – lokal trotzdem abmelden
    })
    setAuthToken(null)
    setKnownPassword(null)
    rawDispatch({ type: 'LOGOUT' })
    pushToast('Abgemeldet')
  }, [pushToast])

  const changePassword = useCallback<StoreCtx['changePassword']>(async (aktuell, neu) => {
    const eigen = stateRef.current.users.find((u) => u.id === stateRef.current.session?.userId)
    if (!eigen) return { ok: false, error: 'Nicht angemeldet.' }

    try {
      await api.changePassword(aktuell, neu)
      setKnownPassword(neu)
      await refresh()
      pushToast('Passwort gespeichert')
      return { ok: true }
    } catch (fehler) {
      return { ok: false, error: fehler instanceof ApiError ? fehler.message : 'Passwort konnte nicht geändert werden.' }
    }
  }, [pushToast, refresh])

  const dispatch = useCallback(
    (action: Action) => {
      // Die Anmeldung läuft über einen eigenen Weg, nicht über den Server
      if (action.type === 'LOGIN' || action.type === 'LOGOUT') {
        rawDispatch(action)
        return
      }
      const vorher = stateRef.current
      // In der Vorschau als andere Person sind Alarm- und Timer-Aktionen gesperrt:
      // Sie liefen sonst unter dem angemeldeten Konto, nicht unter der angezeigten Person.
      if (vorher.previewUserId && VORSCHAU_GESPERRT.has(action.type)) {
        pushToast('Vorschau: Aktionen sind gesperrt – dafür die Vorschau beenden.', 'alarm')
        return
      }
      serverEffekt(action, vorher)
        .then((behandelt) => {
          if (!behandelt) {
            rawDispatch(action)
            return
          }
          if (behandelt === 'merged') {
            pushToast('Für dieses Ereignis lief bereits ein Alarm – die Meldung wurde ihm hinzugefügt', 'alarm')
            return refresh()
          }
          const t = toastForAction(action)
          if (t) {
            if (typeof t === 'string') pushToast(t)
            else pushToast(t.message, t.kind)
          }
          return refresh()
        })
        .catch((fehler) => {
          pushToast(fehler instanceof ApiError ? fehler.message : 'Der Alarmserver hat die Aktion abgelehnt.', 'alarm')
        })
    },
    [pushToast, refresh],
  )

  // Serverstand laden und Änderungen anderer Geräte abonnieren
  useEffect(() => {
    setServerStatus('verbindet')
    void refresh()
    if (!state.session) return
    return subscribeToServer(() => void refresh())
  }, [state.session?.userId, refresh])

  return (
    <StoreContext.Provider value={{ state, dispatch, login, logout, changePassword, serverStatus, knownPassword, refresh: () => void refresh() }}>
      {children}
      <ToastHost toasts={toasts} />
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore muss innerhalb von StoreProvider verwendet werden')
  return ctx
}
