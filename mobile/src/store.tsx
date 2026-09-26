import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Alarm, AlarmPlan, Channel, Delivery, EmergencyContact, EscalationLevel, Group, IntegrationSettings, Location, LoneWorkSession, Scenario, Session, User } from './types'
import { CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS } from './types'
import { LIVE_INITIAL_PASSWORD, SCENARIO_CONTENT_VERSION, SEED_SCENARIOS, SEED_USERS } from './seed'
import { hashPassword, randomSalt } from './auth'
import { criticalAlertsGranted, getPushToken, notifyNow } from './notifications'
import { ladeAufenthalt, stopGeofencing, syncGeofencing, type GeofenceRegion } from './geofencing'
import { aktuellePosition, stopIndoor, syncIndoor, verfolgeEigeneAlarme, type IndoorKonfig } from './indoor'
import { ApiError, api, authToken, loadApiSettings, merkeServerInfo, setAuthToken, setFallbackUrl, setServerUrl, type ServerData } from './api'
import { naechsteWartezeit, type Versandlage } from './alarmversand'

/** Erhöhen, wenn gespeicherte Passwortdaten einmalig korrigiert werden müssen */
const AUTH_MIGRATION_VERSION = 1

/** Zwischenspeicher auf dem Gerät – damit Szenarien und Checklisten offline bereitstehen */
const DATA_KEY = 'sonnenberg-mobile-live-v1'

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface MobileState {
  /** Version der Standard-Szenarien-Inhalte – für einmalige Content-Updates beim Laden */
  scenarioContentVersion?: number
  /** Version der Anmelde-Migration – für einmalige Korrekturen an Passwortdaten */
  authVersion?: number
  /** Angemeldete Sitzung – null bedeutet: Anmeldemaske anzeigen */
  session: Session | null
  /** Datenbestand des Alarmservers – damit App und Webportal dasselbe sehen */
  users: User[]
  groups: Group[]
  locations: Location[]
  scenarios: Scenario[]
  contacts: EmergencyContact[]
  plans: AlarmPlan[]
  /** Einstellungen wie die interne Notfallnummer – vom Server */
  integrations?: IntegrationSettings
  currentUserId: string
  alarms: Alarm[]
  loneWorkSessions: LoneWorkSession[]
}

/** Leerer Bestand; gefüllt wird er vom Alarmserver */
function initialState(): MobileState {
  return {
    session: null,
    users: [],
    groups: [],
    locations: [],
    scenarios: [],
    contacts: [],
    plans: [],
    integrations: undefined,
    currentUserId: '',
    alarms: [],
    loneWorkSessions: [],
  }
}

// ---------- Alarm-Logik (identisch zur Web-App) ----------

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

export function resolveRecipients(users: User[], groupIds: string[], locationIds: string[], groups: Group[] = []): User[] {
  const today = new Date().toISOString().slice(0, 10)
  // Der Krisenstab ist eine Funktion des Hauses, nicht eines Gebäudes – der
  // Standortfilter gilt für ihn nicht (gleiche Regel wie auf dem Server).
  const krisenGruppen = new Set(groups.filter((g) => g.isCrisisTeam).map((g) => g.id))
  return users.filter((u) => {
    const inGroup = groupIds.length === 0 || u.groupIds.some((g) => groupIds.includes(g))
    const alsKrisenstab = u.groupIds.some((g) => krisenGruppen.has(g) && groupIds.includes(g))
    const inLocation = alsKrisenstab || locationIds.length === 0 || locationIds.includes(u.locationId)
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
  /**
   * Fehlt: der Server wendet den Alarmplan des Szenarios an.
   * Gesetzt: genau diese Stufen. Für «bewusst keine» siehe ohneEskalation.
   */
  escalation?: EscalationLevel[]
  /** Bewusst ohne Plan und Stufen – Information an einzelne Personen */
  ohneEskalation?: boolean
  /** Gezielte Empfänger (z. B. einzelnes Krisenteam-Mitglied) statt Gruppen-/Standortauflösung */
  recipientUserIds?: string[]
  /** Übung: gleiche Abläufe, als solche gekennzeichnet */
  drill?: boolean
}

export function createAlarm(state: { users: User[]; groups: Group[] }, opts: TriggerOptions): Alarm {
  const { users, groups } = state
  const recipients = opts.recipientUserIds
    ? users.filter((u) => opts.recipientUserIds!.includes(u.id))
    : resolveRecipients(users, opts.groupIds, opts.locationIds, groups)
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
    ohneEskalation: opts.ohneEskalation || undefined,
    deliveries: buildDeliveries(recipients, opts.channels),
    log: [
      { ts: now, message: `Alarm ausgelöst (${opts.triggeredVia}) – ${recipients.length} Empfänger:innen über ${opts.channels.map((c) => CHANNEL_LABELS[c]).join(', ')}` },
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
  | { type: 'ALARM_UPDATE'; alarmId: string; message: string; kind: 'lage' | 'fehlalarm' | 'uebergabe' }
  | { type: 'ACK_ALARM'; alarmId: string; userId: string; ack: 'acknowledged' | 'declined' }
  | { type: 'TOGGLE_CHECKLIST'; alarmId: string; stepIndex: number; checked: boolean }
  | { type: 'START_LONE_WORK'; session: LoneWorkSession }
  | { type: 'EXTEND_LONE_WORK'; sessionId: string; minutes: number }
  | { type: 'COMPLETE_LONE_WORK'; sessionId: string }
  | { type: 'HYDRATE'; state: MobileState }
  | { type: 'ADOPT_SERVER'; data: ServerData; session: Session | null }

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
        : action.kind === 'uebergabe'
          ? `${name} übergibt die Führung: ${action.message}`
          : action.message
      return {
        ...state,
        alarms: state.alarms.map((a) =>
          a.id === action.alarmId
            ? {
                ...a,
                updates: [...(a.updates ?? []), { ts: Date.now(), kind: action.kind, byUserId: state.currentUserId, message: text }],
                log: [...a.log, { ts: Date.now(), message: action.kind === 'lage' ? `Lagemeldung von ${name}: ${action.message}` : text }],
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
    case 'TOGGLE_CHECKLIST':
      return {
        ...state,
        alarms: state.alarms.map((a) => {
          if (a.id !== action.alarmId) return a
          const bisher = new Set(a.sharedChecklist ?? [])
          action.checked ? bisher.add(action.stepIndex) : bisher.delete(action.stepIndex)
          return { ...a, sharedChecklist: [...bisher].sort((x, y) => x - y) }
        }),
      }
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
      // Der Server ist die Wahrheit; die Anmeldung bleibt lokal.
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
        plans: action.data.plans ?? state.plans,
        integrations: action.data.integrations ?? state.integrations,
        alarms: action.data.alarms ?? [],
        loneWorkSessions: action.data.loneWorkSessions ?? [],
        session,
        currentUserId: session?.userId ?? state.currentUserId,
      }
    }
    case 'HYDRATE':
      // Fehlende Felder auffüllen, damit ein alter Stand nie zu undefined führt
      return fuelleFehlendeFelder(action.state)
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
      return { message: 'Alarm ausgelöst – Empfänger:innen werden benachrichtigt', kind: 'alarm' }
    case 'ALARM_UPDATE':
      return action.kind === 'fehlalarm' ? 'Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung'
        : action.kind === 'uebergabe' ? 'Führungsübergabe gemeldet'
          : 'Lagemeldung gesendet'
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
 * Gespeicherten Stand auf die aktuelle Form bringen.
 *
 * Ältere Versionen der App kannten weder Gruppen, Standorte, Szenarien noch
 * Notrufnummern im Zustand – diese Felder fehlen dort schlicht. Ohne Auffüllen
 * stünde beim Start `undefined` statt einer Liste, und die App stürzt beim
 * ersten Zugriff ab.
 */
export function fuelleFehlendeFelder(parsed: Partial<MobileState>): MobileState {
  const fallback = initialState()
  return {
    ...fallback,
    ...parsed,
    users: parsed.users ?? fallback.users,
    groups: parsed.groups ?? fallback.groups,
    locations: parsed.locations ?? fallback.locations,
    scenarios: parsed.scenarios ?? fallback.scenarios,
    contacts: parsed.contacts ?? fallback.contacts,
    plans: parsed.plans ?? fallback.plans,
    alarms: parsed.alarms ?? [],
    loneWorkSessions: parsed.loneWorkSessions ?? [],
  }
}

/**
 * Gespeicherten Stand auf die aktuelle Form heben. Die Konten liefert der
 * Alarmserver; lokal wird nichts erzeugt. Frühere Fassungen haben Konten
 * versehentlich ein Passwort aus der Grundkonfiguration mitgegeben – diese
 * werden einmalig auf das Erstpasswort mit erzwungener Änderung gesetzt.
 */
function migrateAuth(roh: Partial<MobileState>): MobileState {
  const parsed = fuelleFehlendeFelder(roh)
  const fallback = initialState()
  let users = parsed.users ?? fallback.users

  if ((parsed.authVersion ?? 0) < AUTH_MIGRATION_VERSION) {
    const seedHashes = new Set(SEED_USERS.map((u) => u.passwordHash))
    users = users.map((u) => (u.passwordHash && seedHashes.has(u.passwordHash) ? withInitialPassword(u) : u))
  }

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
    authVersion: AUTH_MIGRATION_VERSION,
    scenarioContentVersion: SCENARIO_CONTENT_VERSION,
    scenarios,
    users,
    session: session && users.some((u) => u.id === session.userId) ? session : null,
    // Vor der Anmeldung ist die Liste leer – dann bleibt sie leer
    currentUserId: users.some((u) => u.id === parsed.currentUserId) ? parsed.currentUserId : (users[0]?.id ?? ''),
  }
}

/** Zwischenspeicher vom Gerät lesen; ohne brauchbaren Stand ein leerer Bestand */
async function ladeZustand(): Promise<MobileState> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MobileState>
      if (parsed.currentUserId) return migrateAuth(parsed)
    }
  } catch {
    // korrupte Daten -> Ausgangszustand
  }
  return initialState()
}

export type ServerStatus = 'lokal' | 'verbindet' | 'verbunden' | 'getrennt'

interface StoreCtx {
  state: MobileState
  dispatch: React.Dispatch<Action>
  /** Anmelden über den Alarmserver */
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
  /**
   * Ein Alarm, der den Server nicht erreicht hat. Bleibt stehen, bis er
   * durchkommt oder bewusst verworfen wird – ein verschwindender Toast wäre
   * für eine nicht abgesetzte Alarmierung die falsche Rückmeldung.
   */
  versandFehler: { action: Action; lage: Versandlage } | null
  /** Von Hand erneut senden */
  erneutSenden: () => void
  /** Aufgeben – der Alarm gilt als nicht abgesetzt */
  versandVerwerfen: () => void
}

const StoreContext = createContext<StoreCtx | null>(null)

/**
 * Eine Aktion auf dem Server ausführen. Der Server ist die einzige Wahrheit;
 * der neue Stand kommt anschliessend über /state zurück.
 *
 * true: vom Server erledigt · 'merged': dem laufenden Alarm hinzugefügt · false: rein lokal
 */
async function serverEffekt(action: Action): Promise<boolean | 'merged'> {
  switch (action.type) {
    case 'TRIGGER_ALARM': {
      const a = action.alarm
      const antwort = await api.triggerAlarm({
        scenarioId: a.scenarioId, message: a.message, silent: a.silent, requireAck: a.requireAck,
        channels: a.channels, groupIds: a.groupIds, locationIds: a.locationIds,
        triggeredVia: 'app', drill: a.drill,
        // fehlt → der Server wendet den Alarmplan an · [] → bewusst ohne Stufen
        escalation: a.ohneEskalation ? [] : (a.escalation.length ? a.escalation : undefined),
        recipientUserIds: [...new Set(a.deliveries.map((d) => d.userId))],
        // Wo im Gebäude die Person gerade ist (Indoor-Ortung) – fehlt, wenn unbekannt
        indoor: aktuellePosition() ?? undefined,
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
    case 'TOGGLE_CHECKLIST':
      await api.toggleChecklist(action.alarmId, action.stepIndex, action.checked)
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
  const [state, rawDispatch] = useReducer(reducer, undefined, initialState)
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
    void getPushToken().then((t) => (t ? api.unregisterPush(t) : undefined)).catch(() => undefined)
    void stopGeofencing()
    void stopIndoor()
    api.logout().catch(() => {
      // Server nicht erreichbar – lokal trotzdem abmelden
    })
    void setAuthToken(null)
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

  /**
   * Ein Alarm, der nicht durchkam. Nur Alarme landen hier – eine
   * fehlgeschlagene Lagemeldung ist ärgerlich, eine nicht abgesetzte
   * Alarmierung ist gefährlich.
   */
  const [versandFehler, setVersandFehler] = useState<{ action: Action; lage: Versandlage } | null>(null)
  const wiederholUhr = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendeAus = useCallback((action: Action, bisher: number) => {
    if (wiederholUhr.current) { clearTimeout(wiederholUhr.current); wiederholUhr.current = null }
    setVersandFehler({ action, lage: { versuche: bisher, laeuft: true, fehler: '' } })
    serverEffekt(action)
      .then((behandelt) => {
        setVersandFehler(null)
        if (behandelt === 'merged') {
          pushToast('Für dieses Ereignis lief bereits ein Alarm – Ihre Meldung wurde ihm hinzugefügt', 'alarm')
        } else if (action.type === 'TRIGGER_ALARM' && !action.alarm.silent) {
          const scenario = stateRef.current.scenarios.find((s) => s.id === action.alarm.scenarioId)
          notifyNow(scenario ? `Alarm: ${scenario.title}` : 'Alarm ausgelöst', action.alarm.message, true)
        }
        void refresh()
      })
      .catch((fehler) => {
        const versuche = bisher + 1
        const text = fehler instanceof ApiError ? fehler.message : 'Der Alarmserver ist nicht erreichbar.'
        setVersandFehler({ action, lage: { versuche, laeuft: false, fehler: text } })
        const warten = naechsteWartezeit(versuche)
        if (warten !== null) wiederholUhr.current = setTimeout(() => sendeAus(action, versuche), warten)
      })
  }, [pushToast, refresh])

  const erneutSenden = useCallback(() => {
    if (versandFehler) sendeAus(versandFehler.action, versandFehler.lage.versuche)
  }, [versandFehler, sendeAus])

  const versandVerwerfen = useCallback(() => {
    if (wiederholUhr.current) { clearTimeout(wiederholUhr.current); wiederholUhr.current = null }
    setVersandFehler(null)
  }, [])

  // Offene Uhren beim Verlassen abräumen
  useEffect(() => () => { if (wiederholUhr.current) clearTimeout(wiederholUhr.current) }, [])

  const dispatch = useCallback(
    (action: Action) => {
      if (action.type === 'LOGIN' || action.type === 'LOGOUT') {
        rawDispatch(action)
        return
      }
      // Ein Alarm, der nicht rausgeht, bekommt den Vollbildhinweis und wird
      // automatisch wiederholt. Alles andere bleibt beim Toast.
      if (action.type === 'TRIGGER_ALARM') {
        sendeAus(action, 0)
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
    [pushToast, refresh, sendeAus],
  )

  useEffect(() => {
    void ladeAufenthalt()
    loadApiSettings()
      .then(() => ladeZustand())
      .then((loaded) => rawDispatch({ type: 'HYDRATE', state: loaded }))
      .catch(() => {
        // kein Storage verfügbar -> leerer Ausgangszustand
      })
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Der Stand bleibt auf dem Gerät: Ohne Empfang zeigt die App den letzten
    // bekannten Stand – Szenarien, Kontakte, Alarme – statt einer leeren Seite.
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(state)).catch(() => {})
  }, [state, hydrated])

  /**
   * Verbindungs-Link aus dem Portal (QR-Code oder verteilter Link): Die App
   * übernimmt Serveradresse und Ausweichserver – niemand muss eine Adresse
   * eintippen.
   */
  const uebernehmeServerLink = useCallback<StoreCtx['uebernehmeServerLink']>(
    (server, fallback, name) => {
      void (async () => {
        await setServerUrl(server)
        await setFallbackUrl(fallback)
        pushToast(`Mit Alarmserver verbunden: ${name || server}`)
        void refresh()
      })()
    },
    [pushToast, refresh],
  )

  // Regelmässig mit dem Alarmserver abgleichen. React Native kennt kein
  // EventSource, deshalb wird abgefragt statt abonniert – im Vordergrund alle
  // fünf Sekunden.
  useEffect(() => {
    if (!hydrated) {
      setServerStatus('lokal')
      return
    }
    setServerStatus('verbindet')
    void refresh()
    if (!state.session) return
    // Token-Registrierung bei jedem Start auffrischen: Die Critical-Alert-
    // Zustimmung kommt oft erst nach dem Login (Dialog beim nächsten Start) –
    // erst diese Meldung sagt dem Server, dass das Gerät die Stufe darf.
    void registerPush()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [hydrated, state.session?.userId, refresh, registerPush])

  // Geofencing mit der Serverkonfiguration abgleichen. Der Schlüssel fasst die
  // relevanten Teile zusammen, damit der Abgleich nur bei echten Änderungen
  // läuft – nicht bei jedem Fünf-Sekunden-Datenabruf. syncGeofencing selbst
  // ist zusätzlich idempotent.
  const geoKonfig = JSON.stringify({
    aktiv: Boolean(state.session) && Boolean(state.integrations?.geofencing),
    regionen: state.locations.filter((l) => l.geofence).map((l) => ({ id: l.id, ...l.geofence! })),
  })
  useEffect(() => {
    if (!hydrated) return
    const { aktiv, regionen } = JSON.parse(geoKonfig) as { aktiv: boolean; regionen: GeofenceRegion[] }
    void syncGeofencing(aktiv, regionen)
  }, [hydrated, geoKonfig])

  // Indoor-Ortung (Aruba Meridian) ebenso nur bei echten Änderungen abgleichen
  const meridian = state.integrations?.meridian
  const indoorKonfig = JSON.stringify({
    aktiv: Boolean(state.session) && Boolean(meridian?.enabled),
    region: meridian?.region === 'us' ? 'us' : 'eu',
    appId: meridian?.appId ?? '',
    sdkToken: meridian?.sdkToken ?? '',
  } satisfies IndoorKonfig)
  useEffect(() => {
    if (!hydrated) return
    void syncIndoor(JSON.parse(indoorKonfig) as IndoorKonfig)
  }, [hydrated, indoorKonfig])

  // Laufende eigene Alarme: Die Position im Gebäude wird nachgeführt, solange
  // sie laufen – auch wenn die erste Ortung erst nach dem Auslösen gelingt
  const eigeneAlarme = JSON.stringify(
    state.session
      ? state.alarms
          .filter((a) => a.status === 'active' && a.triggeredByUserId === state.currentUserId)
          .map((a) => ({ id: a.id, indoorAt: a.indoor?.ermitteltAt, indoorMapId: a.indoor?.mapId }))
      : [],
  )
  useEffect(() => {
    if (!hydrated) return
    verfolgeEigeneAlarme(JSON.parse(eigeneAlarme))
  }, [hydrated, eigeneAlarme])

  return (
    <StoreContext.Provider
      value={{ state, dispatch, login, loginWithToken, logout, changePassword, serverStatus, knownPassword, refresh: () => void refresh(), uebernehmeServerLink, toasts, hydrated, versandFehler, erneutSenden, versandVerwerfen }}
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
