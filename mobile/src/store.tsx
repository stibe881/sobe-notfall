import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { Vibration } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Alarm, AlarmLogEntry, Channel, Delivery, EmergencyContact, EscalationLevel, Group, IntegrationSettings, Location, LoneWorkSession, Scenario, Session, User } from './types'
import { CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS } from './types'
import { LIVE_INITIAL_PASSWORD, SCENARIO_CONTENT_VERSION, SEED_CONTACTS, SEED_GROUPS, SEED_INTEGRATIONS, SEED_LOCATIONS, SEED_SCENARIOS, SEED_USERS } from './seed'
import { hashPassword, randomSalt } from './auth'
import { criticalAlertsGranted, getPushToken, notifyNow } from './notifications'
import { stopGeofencing, syncGeofencing, type GeofenceRegion } from './geofencing'
import { ApiError, api, authToken, loadApiSettings, merkeServerInfo, setAuthToken, setFallbackUrl, setServerUrl, type ServerData } from './api'
import { authenticate, passwordProblem, verifyPassword } from './auth'

export type AppMode = 'demo' | 'live'

/** Erhöhen, wenn gespeicherte Passwortdaten einmalig korrigiert werden müssen */
const AUTH_MIGRATION_VERSION = 1

const MODE_KEY = 'sonnenberg-mobile-mode'
const DATA_KEYS: Record<AppMode, string> = {
  demo: 'sonnenberg-mobile-v1',
  live: 'sonnenberg-mobile-live-v1',
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface MobileState {
  mode: AppMode
  /** Version der Anmelde-Migration – für einmalige Korrekturen an Passwortdaten */
  authVersion?: number
  /** Version der Standard-Szenarien-Inhalte – für einmalige Content-Updates beim Laden */
  scenarioContentVersion?: number
  /** Angemeldete Sitzung – null bedeutet: Anmeldemaske anzeigen */
  session: Session | null
  /**
   * Datenbestand. Im Demo-Modus die mitgelieferten Beispieldaten, im Live-Modus
   * der Stand des Alarmservers – damit App und Webportal dasselbe sehen.
   */
  users: User[]
  groups: Group[]
  locations: Location[]
  scenarios: Scenario[]
  contacts: EmergencyContact[]
  /** Einstellungen wie die interne Notfallnummer – im Live-Modus vom Server */
  integrations?: IntegrationSettings
  currentUserId: string
  alarms: Alarm[]
  loneWorkSessions: LoneWorkSession[]
}

function initialState(mode: AppMode): MobileState {
  // Im Live-Modus füllt der Server den Bestand; bis dahin bleibt er leer
  const live = mode === 'live'
  const users = live ? [] : SEED_USERS
  return {
    mode,
    authVersion: AUTH_MIGRATION_VERSION,
    session: null,
    users,
    groups: live ? [] : SEED_GROUPS,
    locations: live ? [] : SEED_LOCATIONS,
    scenarios: live ? [] : SEED_SCENARIOS,
    contacts: live ? [] : SEED_CONTACTS,
    integrations: SEED_INTEGRATIONS,
    currentUserId: users[0]?.id ?? '',
    alarms: [],
    loneWorkSessions: [],
  }
}

// ---------- Alarm-Logik (identisch zur Web-App, Alarmserver wird lokal simuliert) ----------

/**
 * Empfänger eines Alleinarbeits-Alarms: gewählte Gruppen am Standort plus
 * gewählte Einzelpersonen; ohne Wahl die Standardgruppen. Nie die Person selbst.
 */
export function alleinarbeitEmpfaenger(users: User[], s: LoneWorkSession): { groupIds: string[]; recipientUserIds?: string[] } {
  const groupIds = s.alertGroupIds?.length ? s.alertGroupIds : LONE_WORK_DEFAULT_GROUPS
  const einzelne = (s.alertUserIds ?? []).filter((id) => id !== s.userId)
  if (einzelne.length === 0) return { groupIds }
  const ausGruppen = resolveRecipients(users, groupIds, [s.locationId]).map((u) => u.id)
  return { groupIds, recipientUserIds: [...new Set([...ausGruppen, ...einzelne])].filter((id) => id !== s.userId) }
}

export function resolveRecipients(users: User[], groupIds: string[], locationIds: string[]): User[] {
  const today = new Date().toISOString().slice(0, 10)
  return users.filter((u) => {
    const inGroup = groupIds.length === 0 || u.groupIds.some((g) => groupIds.includes(g))
    const inLocation = locationIds.length === 0 || locationIds.includes(u.locationId)
    const absent = u.absence && u.absence.from <= today && today <= u.absence.to
    return inGroup && inLocation && !absent
  })
}

function buildDeliveries(recipients: User[], channels: Channel[]): Delivery[] {
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
  escalation?: EscalationLevel[]
  /** Gezielte Empfänger (z. B. einzelnes Krisenteam-Mitglied) statt Gruppen-/Standortauflösung */
  recipientUserIds?: string[]
  /** Übung: gleiche Abläufe, als solche gekennzeichnet */
  drill?: boolean
}

export function createAlarm(users: User[], opts: TriggerOptions): Alarm {
  const recipients = opts.recipientUserIds
    ? users.filter((u) => opts.recipientUserIds!.includes(u.id))
    : resolveRecipients(users, opts.groupIds, opts.locationIds)
  const now = Date.now()
  return {
    id: uid('alarm'),
    scenarioId: opts.scenarioId,
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
    ],
  }
}

export type Action =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_PASSWORD'; userId: string; password: string; mustChange?: boolean }
  | { type: 'SET_USER'; userId: string }
  | { type: 'TRIGGER_ALARM'; alarm: Alarm }
  | { type: 'END_ALARM'; alarmId: string; note?: string }
  | { type: 'ALARM_UPDATE'; alarmId: string; message: string; kind: 'lage' | 'fehlalarm' }
  | { type: 'ACK_ALARM'; alarmId: string; userId: string; ack: 'acknowledged' | 'declined' }
  | { type: 'TICK'; now: number }
  | { type: 'START_LONE_WORK'; session: LoneWorkSession }
  | { type: 'EXTEND_LONE_WORK'; sessionId: string; minutes: number }
  | { type: 'COMPLETE_LONE_WORK'; sessionId: string }
  | { type: 'HYDRATE'; state: MobileState }
  | { type: 'ADOPT_SERVER'; data: ServerData; session: Session | null }
  | { type: 'RESET' }

/** Zustellsimulation (nur Demo), Eskalation, Alleinarbeits-Timer */
function tick(state: MobileState, now: number): MobileState {
  let changed = false
  const simulate = state.mode === 'demo'

  const alarms = state.alarms.map((alarm) => {
    if (alarm.status !== 'active') return alarm
    let aChanged = false
    let deliveries = !simulate
      ? alarm.deliveries
      : alarm.deliveries.map((d) => {
          const age = now - d.updatedAt
          if (d.status === 'pending' && age > 1200 + Math.random() * 1500) {
            aChanged = true
            return { ...d, status: 'sent' as const, updatedAt: now }
          }
          if (d.status === 'sent' && age > 1500 + Math.random() * 2500) {
            aChanged = true
            return { ...d, status: Math.random() < 0.04 ? ('failed' as const) : ('delivered' as const), updatedAt: now }
          }
          return d
        })

    const log: AlarmLogEntry[] = [...alarm.log]

    // Simulierte Rückmeldungen (nur Demo): alarmierte Personen quittieren nach Zustellung
    if (simulate && alarm.requireAck) {
      const pendingUsers = [...new Set(deliveries.map((d) => d.userId))].filter(
        (userId) =>
          userId !== state.currentUserId &&
          deliveries.some((d) => d.userId === userId && d.status === 'delivered') &&
          deliveries.every((d) => d.userId !== userId || d.ack === 'none'),
      )
      for (const userId of pendingUsers) {
        if (Math.random() < 0.06) {
          const ack = Math.random() < 0.85 ? ('acknowledged' as const) : ('declined' as const)
          deliveries = deliveries.map((d) => (d.userId === userId ? { ...d, ack } : d))
          const user = state.users.find((u) => u.id === userId)
          log.push({
            ts: now,
            message: `${user ? `${user.firstName} ${user.lastName}` : userId} hat ${ack === 'acknowledged' ? 'quittiert (kommt)' : 'abgelehnt (nicht verfügbar)'}`,
          })
          aChanged = true
        }
      }
    }

    // Eskalation
    let escalationStage = alarm.escalationStage
    const nextLevel = alarm.escalation[escalationStage]
    const anyAck = deliveries.some((d) => d.ack === 'acknowledged')
    if (nextLevel && !anyAck && now - alarm.triggeredAt > nextLevel.afterMinutes * 60_000) {
      escalationStage += 1
      const recipients = resolveRecipients(state.users, nextLevel.groupIds, alarm.locationIds)
      deliveries = [...deliveries, ...buildDeliveries(recipients, nextLevel.channels)]
      log.push({
        ts: now,
        message: `Eskalationsstufe ${escalationStage}: ${recipients.length} weitere Empfänger${nextLevel.notifyEmergencyServices ? ' – Blaulichtorganisationen benachrichtigt' : ''}`,
      })
      aChanged = true
    }

    if (!aChanged) return alarm
    changed = true
    return { ...alarm, deliveries, log, escalationStage }
  })

  // Alleinarbeits-Timer abgelaufen -> automatischer Alarm
  let loneWorkSessions = state.loneWorkSessions
  let newAlarms: Alarm[] = []
  const expired = state.loneWorkSessions.filter((s) => s.status === 'running' && now > s.expiresAt)
  if (expired.length > 0) {
    changed = true
    loneWorkSessions = state.loneWorkSessions.map((s) =>
      expired.some((e) => e.id === s.id) ? { ...s, status: 'alarm' as const } : s,
    )
    for (const session of expired) {
      const user = state.users.find((u) => u.id === session.userId)
      const ziel = alleinarbeitEmpfaenger(state.users, session)
      newAlarms = [
        createAlarm(state.users, {
          scenarioId: 'sc-medizin',
          message: `ALLEINARBEIT: Timer von ${user ? `${user.firstName} ${user.lastName}` : '?'} abgelaufen (${session.activity}). Keine Rückmeldung – bitte sofort prüfen!`,
          silent: session.silent,
          requireAck: true,
          channels: ['push', 'sms', 'voice'],
          groupIds: ziel.groupIds,
          recipientUserIds: ziel.recipientUserIds,
          locationIds: [session.locationId],
          triggeredByUserId: session.userId,
          triggeredVia: 'timer',
          escalation: [{ afterMinutes: 5, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
        }),
        ...newAlarms,
      ]
    }
    Vibration.vibrate([0, 300, 150, 300])
  }

  if (!changed) return state
  return { ...state, alarms: [...newAlarms, ...alarms], loneWorkSessions }
}

function reducer(state: MobileState, action: Action): MobileState {
  switch (action.type) {
    case 'LOGIN': {
      const user = state.users.find((u) => u.id === action.userId)
      if (!user) return state
      return {
        ...state,
        session: { userId: user.id, loginAt: Date.now() },
        currentUserId: user.id,
        users: state.users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: Date.now() } : u)),
      }
    }
    case 'LOGOUT':
      return { ...state, session: null }
    case 'SET_PASSWORD': {
      const salt = randomSalt()
      const hash = hashPassword(action.password, salt)
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.userId
            ? { ...u, passwordSalt: salt, passwordHash: hash, mustChangePassword: action.mustChange ?? false }
            : u,
        ),
      }
    }
    case 'SET_USER':
      return { ...state, currentUserId: action.userId }
    case 'TRIGGER_ALARM': {
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
              updates: [...(a.updates ?? []), update],
              deliveries: [...a.deliveries, ...action.alarm.deliveries.filter((d) => !bekannt.has(d.userId))],
              log: [...a.log, { ts: update.ts, message: `Zweite Auslösung zusammengeführt: ${action.alarm.message}` }],
            },
          ),
        }
      }
      return { ...state, alarms: [action.alarm, ...state.alarms].slice(0, 20) }
    }
    case 'END_ALARM':
      return {
        ...state,
        alarms: state.alarms.map((a) =>
          a.id === action.alarmId
            ? {
                ...a, status: 'ended' as const, endedAt: Date.now(), endNote: action.note?.trim() || undefined,
                log: [...a.log, { ts: Date.now(), message: `Alarm beendet – Entwarnung versendet.${action.note?.trim() ? ` «${action.note.trim()}»` : ''}` }],
              }
            : a,
        ),
      }
    case 'ALARM_UPDATE': {
      const person = state.users.find((u) => u.id === state.currentUserId)
      const name = person ? `${person.firstName} ${person.lastName}` : '?'
      const text = action.kind === 'fehlalarm'
        ? `FEHLALARM gemeldet von ${name}${action.message ? `: ${action.message}` : ''} – bitte auf die Entwarnung durch den Krisenstab warten.`
        : action.message
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
      }
    }
    case 'ACK_ALARM':
      return {
        ...state,
        alarms: state.alarms.map((a) =>
          a.id === action.alarmId
            ? { ...a, deliveries: a.deliveries.map((d) => (d.userId === action.userId ? { ...d, ack: action.ack } : d)) }
            : a,
        ),
      }
    case 'TICK':
      return tick(state, action.now)
    case 'START_LONE_WORK':
      return { ...state, loneWorkSessions: [action.session, ...state.loneWorkSessions].slice(0, 20) }
    case 'EXTEND_LONE_WORK':
      return {
        ...state,
        loneWorkSessions: state.loneWorkSessions.map((s) =>
          s.id === action.sessionId ? { ...s, expiresAt: s.expiresAt + action.minutes * 60_000 } : s,
        ),
      }
    case 'COMPLETE_LONE_WORK':
      return {
        ...state,
        loneWorkSessions: state.loneWorkSessions.map((s) => (s.id === action.sessionId ? { ...s, status: 'completed' as const } : s)),
      }
    case 'ADOPT_SERVER': {
      // Im Live-Modus ist der Server die Wahrheit; Modus und Anmeldung bleiben lokal.
      // Die Anmeldeart überlebt den regelmässigen Abgleich – sie ist beim
      // Anmelden bekannt, nicht bei jedem Neuladen des Datenbestands
      const session = action.session
        ? { ...action.session, via: action.session.via ?? state.session?.via }
        : action.session
      return {
        ...state,
        users: action.data.users ?? state.users,
        groups: action.data.groups ?? state.groups,
        locations: action.data.locations ?? state.locations,
        scenarios: action.data.scenarios ?? state.scenarios,
        contacts: action.data.contacts ?? state.contacts,
        integrations: action.data.integrations ?? state.integrations,
        alarms: action.data.alarms ?? [],
        loneWorkSessions: action.data.loneWorkSessions ?? [],
        mode: 'live',
        session,
        currentUserId: session?.userId ?? state.currentUserId,
      }
    }
    case 'HYDRATE':
      // Fehlende Felder auffüllen, damit ein alter Stand nie zu undefined führt
      return fuelleFehlendeFelder(action.state, action.state.mode ?? state.mode)
    case 'RESET': {
      const fresh = initialState(state.mode)
      // Angemeldet bleiben, sofern das eigene Konto im frischen Bestand existiert
      const keep = fresh.users.some((u) => u.id === state.session?.userId)
      return keep ? { ...fresh, session: state.session, currentUserId: state.session!.userId } : fresh
    }
    default:
      return state
  }
}

// ---------- Toasts ----------

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'alarm'
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

function toastForAction(action: Action): Toast['message'] | { message: string; kind: 'alarm' } | null {
  switch (action.type) {
    case 'TRIGGER_ALARM':
      return { message: 'Alarm ausgelöst – Empfänger werden benachrichtigt', kind: 'alarm' }
    case 'ALARM_UPDATE':
      return action.kind === 'fehlalarm' ? 'Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung' : 'Lagemeldung gesendet'
    case 'END_ALARM':
      return 'Alarm beendet – Entwarnung versendet'
    case 'ACK_ALARM':
      return action.ack === 'acknowledged' ? 'Quittiert – Sie nehmen teil' : 'Als nicht verfügbar gemeldet'
    case 'LOGOUT':
      return 'Abgemeldet'
    case 'SET_PASSWORD':
      return 'Passwort gespeichert'
    case 'START_LONE_WORK':
      return 'Alleinarbeits-Timer gestartet'
    case 'EXTEND_LONE_WORK':
      return 'Lebenszeichen erhalten – Timer verlängert'
    case 'COMPLETE_LONE_WORK':
      return 'Alleinarbeit sicher beendet'
    case 'RESET':
      return 'Demo zurückgesetzt'
    default:
      return null
  }
}

// ---------- Provider ----------

/** Konto auf das Erstpasswort setzen, Änderung bei der nächsten Anmeldung erzwingen */
function withInitialPassword(user: User): User {
  const salt = randomSalt()
  return { ...user, passwordSalt: salt, passwordHash: hashPassword(LIVE_INITIAL_PASSWORD, salt), mustChangePassword: true }
}

/**
 * Sicherstellen, dass mindestens ein Konto anmeldefähig bleibt. Gibt es keines,
 * erhalten alle Administratoren das Erstpasswort mit erzwungener Änderung; fehlt
 * auch ein Administrator, wird das Konto aus der Grundkonfiguration wiederhergestellt.
 */
function ensureLoginPossible(users: User[]): User[] {
  if (users.some((u) => u.passwordHash && u.passwordSalt)) return users
  if (users.some((u) => u.role === 'admin')) {
    return users.map((u) => (u.role === 'admin' ? withInitialPassword(u) : u))
  }
  const rescue = SEED_USERS.find((u) => u.role === 'admin')
  if (!rescue) return users
  return [withInitialPassword({ ...rescue, passwordHash: undefined, passwordSalt: undefined }), ...users.filter((u) => u.id !== rescue.id)]
}

/**
 * Gespeicherte Stände auf die Anmeldung umstellen. Ältere Stände kennen weder
 * Benutzerverzeichnis noch Sitzung; sie erhalten das Verzeichnis des Modus.
 * Demo-Passwörter gelten nur im Demo-Modus; Live-Bestände, denen eine frühere
 * Fassung ein Demo-Passwort zugewiesen hat, werden auf das Erstpasswort gesetzt.
 */
/**
 * Gespeicherten Stand auf die aktuelle Form bringen.
 *
 * Ältere Versionen der App kannten weder Gruppen, Standorte, Szenarien noch
 * Notrufnummern im Zustand – diese Felder fehlen dort schlicht. Ohne Auffüllen
 * stünde beim Start `undefined` statt einer Liste, und die App stürzt beim
 * ersten Zugriff ab.
 */
export function fuelleFehlendeFelder(parsed: Partial<MobileState>, mode: AppMode): MobileState {
  const fallback = initialState(mode)
  return {
    ...fallback,
    ...parsed,
    mode,
    users: parsed.users ?? fallback.users,
    groups: parsed.groups ?? fallback.groups,
    locations: parsed.locations ?? fallback.locations,
    scenarios: parsed.scenarios ?? fallback.scenarios,
    contacts: parsed.contacts ?? fallback.contacts,
    alarms: parsed.alarms ?? [],
    loneWorkSessions: parsed.loneWorkSessions ?? [],
  }
}

function migrateAuth(roh: Partial<MobileState>, mode: AppMode): MobileState {
  const parsed = fuelleFehlendeFelder(roh, mode)
  const fallback = initialState(mode)
  const seedById = new Map(SEED_USERS.map((u) => [u.id, u]))
  let users = parsed.users?.length ? parsed.users : fallback.users

  if (mode === 'demo') {
    users = users.map((u) => {
      if (u.passwordHash && u.passwordSalt) return u
      const seed = seedById.get(u.id)
      return seed?.passwordHash && seed.passwordSalt
        ? { ...u, passwordSalt: seed.passwordSalt, passwordHash: seed.passwordHash }
        : u
    })
  }

  if (mode === 'live' && (parsed.authVersion ?? 0) < AUTH_MIGRATION_VERSION) {
    const seedHashes = new Set(SEED_USERS.map((u) => u.passwordHash))
    users = users.map((u) => (u.passwordHash && seedHashes.has(u.passwordHash) ? withInitialPassword(u) : u))
  }

  // Im Live-Modus liefert der Server die Konten – lokal wird nichts erzeugt
  users = mode === 'demo' ? ensureLoginPossible(users) : users

  // Einmalige Inhalts-Aktualisierung: Standard-Szenarien auf die neue Version
  // heben, selbst erstellte Szenarien (custom) bleiben unverändert erhalten.
  // Ohne diesen Schritt behielte ein Gerät die alten Abläufe bis zur Neuinstallation.
  let scenarios = parsed.scenarios ?? fallback.scenarios
  if ((parsed.scenarioContentVersion ?? 1) < SCENARIO_CONTENT_VERSION) {
    scenarios = [...SEED_SCENARIOS, ...scenarios.filter((sc) => sc.custom)]
  }

  const session = parsed.session ?? null
  // Platzhalternummer aus früheren Versionen durch die echte Notfallnummer ersetzen
  const integrations =
    parsed.integrations?.hotline && ['', '+41 41 000 11 22'].includes(parsed.integrations.hotline.number.trim())
      ? { ...parsed.integrations, hotline: { enabled: true, number: '+41 41 767 49 48' } }
      : parsed.integrations ?? fallback.integrations
  return {
    ...parsed,
    integrations,
    mode,
    authVersion: AUTH_MIGRATION_VERSION,
    scenarioContentVersion: SCENARIO_CONTENT_VERSION,
    scenarios,
    users,
    session: session && users.some((u) => u.id === session.userId) ? session : null,
    // Im Live-Modus ist die Liste vor der Anmeldung leer – dann bleibt sie leer
    currentUserId: users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId : (users[0]?.id ?? ''),
  }
}

async function loadStateForMode(mode: AppMode): Promise<MobileState> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEYS[mode])
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MobileState>
      if (parsed.currentUserId) return migrateAuth(parsed, mode)
    }
  } catch {
    // korrupte Daten -> Ausgangszustand
  }
  return initialState(mode)
}

export type ServerStatus = 'lokal' | 'verbindet' | 'verbunden' | 'getrennt'

interface StoreCtx {
  state: MobileState
  dispatch: React.Dispatch<Action>
  switchMode: (mode: AppMode) => void
  /** Anmelden – im Demo-Modus lokal, im Live-Modus über den Alarmserver */
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  /** Anmeldung über Single Sign-On: Der Server hat das Sitzungs-Token bereits ausgestellt */
  loginWithToken: (token: string) => Promise<{ ok: true } | { ok: false; error: string }>
  logout: () => void
  changePassword: (aktuell: string, neu: string) => Promise<{ ok: true } | { ok: false; error: string }>
  serverStatus: ServerStatus
  /** Bei der Anmeldung eingegebenes Passwort – nur im Arbeitsspeicher */
  knownPassword: string | null
  refresh: () => void
  /** Verbindungs-Link (QR-Code aus dem Portal): Serveradresse samt Ausweichserver übernehmen */
  uebernehmeServerLink: (server: string, fallback: string | null, name: string | null) => void
  toasts: Toast[]
  hydrated: boolean
}

const StoreContext = createContext<StoreCtx | null>(null)

/**
 * Eine Aktion im Live-Modus auf dem Server ausführen. Der Server ist dort die
 * einzige Wahrheit; der neue Stand kommt anschliessend über /state zurück.
 */
/** true: vom Server erledigt · 'merged': dem laufenden Alarm hinzugefügt · false: rein lokal */
async function serverEffekt(action: Action): Promise<boolean | 'merged'> {
  switch (action.type) {
    case 'TRIGGER_ALARM': {
      const a = action.alarm
      const antwort = await api.triggerAlarm({
        scenarioId: a.scenarioId, message: a.message, silent: a.silent, requireAck: a.requireAck,
        channels: a.channels, groupIds: a.groupIds, locationIds: a.locationIds,
        triggeredVia: 'app', escalation: a.escalation, drill: a.drill,
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
      return false
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, () => initialState('demo'))
  const stateRef = useRef(state)
  stateRef.current = state
  const [hydrated, setHydrated] = useState(false)
  // Wie die laufende Anmeldung zustande kam – für den erzwungenen Passwortwechsel
  const anmeldeArt = useRef<Session['via']>(undefined)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const [serverStatus, setServerStatus] = useState<ServerStatus>('lokal')
  const [knownPassword, setKnownPassword] = useState<string | null>(null)

  const pushToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-1), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  /** Datenbestand vom Alarmserver holen */
  const refresh = useCallback(async () => {
    if (stateRef.current.mode !== 'live') return
    if (!authToken()) {
      setServerStatus('getrennt')
      return
    }
    try {
      const [{ user }, daten] = await Promise.all([api.me(), api.state()])
      rawDispatch({ type: 'ADOPT_SERVER', data: daten, session: { userId: user.id, loginAt: Date.now(), via: anmeldeArt.current } })
      setServerStatus('verbunden')
      // Redundanz: Ausweichadresse merken; hängt die App am Standby, regelmässig
      // prüfen, ob der Hauptserver zurück ist
      void merkeServerInfo(daten.serverInfo)
    } catch (fehler) {
      if (fehler instanceof ApiError && fehler.status === 401) {
        await setAuthToken(null)
        rawDispatch({ type: 'LOGOUT' })
        setServerStatus('verbunden')
      } else {
        setServerStatus('getrennt')
      }
    }
  }, [])

  /** Push-Token dieses Geräts beim Alarmserver hinterlegen */
  const registerPush = useCallback(async () => {
    try {
      const pushToken = await getPushToken()
      if (!pushToken) return
      // Der Server braucht die Stufe pro Gerät: Critical Alert nur dort, wo erlaubt
      await api.registerPush(pushToken, await criticalAlertsGranted())
    } catch {
      // Push ist eine Zusatzfunktion, keine Voraussetzung
    }
  }, [])

  const login = useCallback<StoreCtx['login']>(async (email, password) => {
    if (stateRef.current.mode === 'demo') {
      const ergebnis = authenticate(stateRef.current.users, email, password)
      if (!ergebnis.ok) return { ok: false, error: ergebnis.error }
      setKnownPassword(password)
      rawDispatch({ type: 'LOGIN', userId: ergebnis.user.id })
      return { ok: true }
    }
    try {
      const { token } = await api.login(email, password)
      await setAuthToken(token)
      setKnownPassword(password)
      anmeldeArt.current = 'password'
      await refresh()
      // Gerät für echte Push-Nachrichten anmelden; scheitert es, bleibt die
      // Anmeldung trotzdem gültig – Alarme erscheinen dann nur in der App
      void registerPush()
      return { ok: true }
    } catch (fehler) {
      return { ok: false, error: fehler instanceof ApiError ? fehler.message : 'Anmeldung fehlgeschlagen.' }
    }
  }, [refresh, registerPush])

  /** SSO-Rücksprung: Sitzungs-Token übernehmen und den Serverstand laden */
  const loginWithToken = useCallback<StoreCtx['loginWithToken']>(async (token) => {
    try {
      await setAuthToken(token)
      // wirft bei ungültigem oder abgelaufenem Token
      await api.me()
      anmeldeArt.current = 'sso'
      await refresh()
      void registerPush()
      return { ok: true }
    } catch (fehler) {
      await setAuthToken(null)
      return { ok: false, error: fehler instanceof ApiError ? fehler.message : 'Anmeldung fehlgeschlagen.' }
    }
  }, [refresh, registerPush])

  const logout = useCallback(() => {
    if (stateRef.current.mode === 'live') {
      void getPushToken().then((t) => (t ? api.unregisterPush(t) : undefined)).catch(() => undefined)
      void stopGeofencing()
      api.logout().catch(() => {
        // Server nicht erreichbar – lokal trotzdem abmelden
      })
      void setAuthToken(null)
    }
    setKnownPassword(null)
    rawDispatch({ type: 'LOGOUT' })
    pushToast('Abgemeldet')
  }, [pushToast])

  const changePassword = useCallback<StoreCtx['changePassword']>(async (aktuell, neu) => {
    const eigen = stateRef.current.users.find((u) => u.id === stateRef.current.session?.userId)
    if (!eigen) return { ok: false, error: 'Nicht angemeldet.' }

    if (stateRef.current.mode === 'demo') {
      if (!verifyPassword(eigen, aktuell)) return { ok: false, error: 'Das aktuelle Passwort ist falsch.' }
      const problem = passwordProblem(neu)
      if (problem) return { ok: false, error: problem }
      rawDispatch({ type: 'SET_PASSWORD', userId: eigen.id, password: neu })
      setKnownPassword(neu)
      pushToast('Passwort gespeichert')
      return { ok: true }
    }
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
      if (stateRef.current.mode === 'live') {
        if (action.type === 'LOGIN' || action.type === 'LOGOUT') {
          rawDispatch(action)
          return
        }
        serverEffekt(action)
          .then((behandelt) => {
            if (!behandelt) {
              rawDispatch(action)
              return
            }
            if (behandelt === 'merged') {
              pushToast('Für dieses Ereignis lief bereits ein Alarm – Ihre Meldung wurde ihm hinzugefügt', 'alarm')
              return refresh()
            }
            if (action.type === 'TRIGGER_ALARM' && !action.alarm.silent) {
              const scenario = stateRef.current.scenarios.find((s) => s.id === action.alarm.scenarioId)
              notifyNow(scenario ? `Alarm: ${scenario.title}` : 'Alarm ausgelöst', action.alarm.message, true)
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
        return
      }

      // Demo: Zusammenführen ist am Toast erkennbar
      if (action.type === 'TRIGGER_ALARM' && laufenderAlarmZu(stateRef.current.alarms, action.alarm)) {
        rawDispatch(action)
        pushToast('Für dieses Ereignis lief bereits ein Alarm – Ihre Meldung wurde ihm hinzugefügt', 'alarm')
        return
      }
      rawDispatch(action)
      if (action.type === 'TRIGGER_ALARM' && !action.alarm.silent) {
        const scenario = stateRef.current.scenarios.find((s) => s.id === action.alarm.scenarioId)
        notifyNow(scenario ? `Alarm: ${scenario.title}` : 'Alarm ausgelöst', action.alarm.message, true)
      }
      const t = toastForAction(action)
      if (t) {
        if (typeof t === 'string') pushToast(t)
        else pushToast(t.message, t.kind)
      }
    },
    [pushToast, refresh],
  )

  useEffect(() => {
    loadApiSettings()
      .then(() => AsyncStorage.getItem(MODE_KEY))
      .then((stored) => loadStateForMode(stored === 'live' ? 'live' : 'demo'))
      .then((loaded) => rawDispatch({ type: 'HYDRATE', state: loaded }))
      .catch(() => {
        // kein Storage verfügbar -> Demo-Ausgangszustand
      })
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Auch der Live-Stand bleibt auf dem Gerät: Ohne Empfang zeigt die App den
    // letzten bekannten Stand – Szenarien, Kontakte, Alarme – statt einer leeren Seite.
    AsyncStorage.setItem(DATA_KEYS[state.mode], JSON.stringify(state)).catch(() => {})
    AsyncStorage.setItem(MODE_KEY, state.mode).catch(() => {})
  }, [state, hydrated])

  const switchMode = useCallback(
    (mode: AppMode) => {
      if (stateRef.current.mode === mode) return
      loadStateForMode(mode).then((loaded) => {
        rawDispatch({ type: 'HYDRATE', state: loaded })
        pushToast(
          mode === 'live'
            ? 'Live-Modus aktiv – Daten vom Alarmserver'
            : 'Demo-Modus aktiv – Zustellung wird simuliert',
        )
      })
    },
    [pushToast],
  )

  /**
   * Verbindungs-Link aus dem Portal (QR-Code oder verteilter Link): Die App
   * übernimmt Serveradresse und Ausweichserver und wechselt in den Live-Modus –
   * niemand muss eine Adresse eintippen.
   */
  const uebernehmeServerLink = useCallback<StoreCtx['uebernehmeServerLink']>(
    (server, fallback, name) => {
      void (async () => {
        await setServerUrl(server)
        await setFallbackUrl(fallback)
        pushToast(`Mit Alarmserver verbunden: ${name || server}`)
        if (stateRef.current.mode !== 'live') switchMode('live')
        else void refresh()
      })()
    },
    [pushToast, switchMode, refresh],
  )

  // Im Live-Modus regelmässig abgleichen. React Native kennt kein EventSource,
  // deshalb wird abgefragt statt abonniert – im Vordergrund alle fünf Sekunden.
  useEffect(() => {
    if (!hydrated || state.mode !== 'live') {
      setServerStatus('lokal')
      return
    }
    setServerStatus('verbindet')
    void refresh()
    if (!state.session) return
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [hydrated, state.mode, state.session?.userId, refresh])

  // Simulation nur im Demo-Modus; im Live-Betrieb rechnet der Server
  useEffect(() => {
    if (state.mode !== 'demo') return
    const interval = setInterval(() => rawDispatch({ type: 'TICK', now: Date.now() }), 1000)
    return () => clearInterval(interval)
  }, [state.mode])

  // Geofencing mit der Serverkonfiguration abgleichen. Der Schlüssel fasst die
  // relevanten Teile zusammen, damit der Abgleich nur bei echten Änderungen
  // läuft – nicht bei jedem Fünf-Sekunden-Datenabruf. syncGeofencing selbst
  // ist zusätzlich idempotent.
  const geoKonfig = JSON.stringify({
    aktiv: state.mode === 'live' && Boolean(state.session) && Boolean(state.integrations?.geofencing),
    regionen: state.locations.filter((l) => l.geofence).map((l) => ({ id: l.id, ...l.geofence! })),
  })
  useEffect(() => {
    if (!hydrated) return
    const { aktiv, regionen } = JSON.parse(geoKonfig) as { aktiv: boolean; regionen: GeofenceRegion[] }
    void syncGeofencing(aktiv, regionen)
  }, [hydrated, geoKonfig])

  return (
    <StoreContext.Provider
      value={{ state, dispatch, switchMode, login, loginWithToken, logout, changePassword, serverStatus, knownPassword, refresh: () => void refresh(), uebernehmeServerLink, toasts, hydrated }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore muss innerhalb von StoreProvider verwendet werden')
  return ctx
}

export { SEED_GROUPS }
