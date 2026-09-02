import type { AppState, User } from '../types'

/**
 * Verbindung zum Alarmserver (Live-Modus).
 *
 * Der Demo-Modus arbeitet weiterhin rein lokal. Im Live-Modus liegen alle Daten
 * auf dem Server, damit Portal und App denselben Bestand sehen.
 */

const URL_KEY = 'sobe-server-url'
const TOKEN_KEY = 'sobe-server-token'

/** Ports, unter denen die Entwicklungsumgebung läuft – dort steht der Server separat */
const ENTWICKLUNGS_PORTS = ['5173', '4173']

/**
 * Vorgabe für die Serveradresse.
 *
 * Im Betrieb liefert der Alarmserver das Portal selbst aus – dann ist die
 * Schnittstelle unter derselben Adresse erreichbar, und es braucht weder
 * CORS noch eine gesonderte Einstellung. Nur in der Entwicklung, wo Vite auf
 * einem eigenen Port läuft, wird auf localhost:3001 gezeigt.
 */
export const DEFAULT_SERVER_URL = (() => {
  try {
    if (typeof window === 'undefined') return 'http://localhost:3001'
    return ENTWICKLUNGS_PORTS.includes(window.location.port) ? 'http://localhost:3001' : window.location.origin
  } catch {
    return 'http://localhost:3001'
  }
})()

export function serverUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) || DEFAULT_SERVER_URL
  } catch {
    return DEFAULT_SERVER_URL
  }
}

export function setServerUrl(url: string): void {
  try {
    localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ''))
  } catch {
    // kein Speicher verfügbar – Adresse gilt nur für diese Sitzung
  }
}

export function authToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // kein Speicher verfügbar
  }
}

// ---------- Aktualisierung ----------

export type UpdateScope = 'server' | 'server+ios'

export interface UpdateSchritt {
  id: string
  titel: string
  status: 'offen' | 'laufend' | 'erfolgreich' | 'fehlgeschlagen' | 'übersprungen'
  ausgabe: string
  startedAt?: number
  finishedAt?: number
}

export interface UpdateJob {
  id: string
  scope: UpdateScope
  status: 'laufend' | 'erfolgreich' | 'fehlgeschlagen' | 'neustart'
  startedAt: number
  finishedAt?: number
  gestartetVon: string
  schritte: UpdateSchritt[]
  buildUrl?: string
  /** Auftrag durchgelaufen, aber mit einer Einschränkung */
  hinweis?: string
  fehler?: string
}

export interface VersionsInfo {
  branch: string
  commit: string
  commitKurz: string
  commitDatum: string
  commitTitel: string
  hinterher: number
  iosMoeglich: boolean
  iosHinweis?: string
  neustartMoeglich: boolean
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function anfrage<T>(pfad: string, optionen: RequestInit = {}): Promise<T> {
  const token = authToken()
  let antwort: Response
  try {
    antwort = await fetch(serverUrl() + '/api' + pfad, {
      ...optionen,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(optionen.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError(`Der Alarmserver unter ${serverUrl()} ist nicht erreichbar.`, 0)
  }
  const text = await antwort.text()
  const daten = text ? JSON.parse(text) : null
  if (!antwort.ok) throw new ApiError(daten?.error ?? `Serverfehler (${antwort.status})`, antwort.status)
  return daten as T
}

export interface Bereitschaft {
  standorte: { id: string; name: string; personen: number; mitGeraet: number; critical: number }[]
  ohneGeraet: { id: string; name: string; locationId: string }[]
  tokensGesamt: number
  letzteSicherung: { ts: number; datei: string } | null
  pushDienst: { ok: boolean; geprueft: number } | null
  letzterTestpush: number | null
}

export interface SetupInfo {
  /** Genau ein Administratorkonto mit unverändertem Erstpasswort */
  freshInstall: boolean
  adminEmail: string | null
  userCount: number
}

export const api = {
  health: () => anfrage<{ ok: boolean }>('/health'),

  /** Öffentliche Auskunft für die Anmeldemaske – ohne Anmeldung abrufbar */
  setup: () => anfrage<SetupInfo>('/setup'),

  login: (email: string, password: string) =>
    anfrage<{ token: string; expiresAt: number; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => anfrage<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => anfrage<{ user: User }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    anfrage<{ ok: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  state: () => anfrage<Omit<AppState, 'mode' | 'session' | 'currentUserId'>>('/state'),

  saveUser: (user: Partial<User> & { password?: string }) =>
    anfrage<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(user) }),
  deleteUser: (id: string) => anfrage<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  /** Passwort eines fremden Kontos setzen – nur für die Administration */
  setUserPassword: (id: string, password: string, mustChange: boolean) =>
    anfrage<{ ok: boolean }>(`/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password, mustChange }) }),

  saveDoc: (sammlung: 'scenarios' | 'plans' | 'contacts' | 'buttons' | 'groups' | 'locations', doc: unknown) =>
    anfrage<{ id: string }>(`/${sammlung}`, { method: 'POST', body: JSON.stringify(doc) }),
  deleteDoc: (sammlung: 'scenarios' | 'plans' | 'contacts' | 'buttons' | 'groups' | 'locations', id: string) =>
    anfrage<{ ok: boolean }>(`/${sammlung}/${id}`, { method: 'DELETE' }),

  saveIntegrations: (integrations: AppState['integrations']) =>
    anfrage<{ ok: boolean }>('/integrations', { method: 'POST', body: JSON.stringify(integrations) }),

  /** Verbindungstests der Integrationen – nur Administration */
  smsTest: (to?: string) =>
    anfrage<{ ok: boolean }>('/integrations/sms/test', { method: 'POST', body: JSON.stringify({ to }) }),
  teamsTest: () => anfrage<{ ok: boolean }>('/integrations/teams/test', { method: 'POST' }),
  telephonyTest: () =>
    anfrage<{ ok: boolean; joinUrl?: string; hinweis?: string }>('/integrations/telephony/test', { method: 'POST' }),

  /** LoRaWAN-Endpunkt: Adresse und Zugangstoken für die Konfiguration im Netzserver */
  lorawanInfo: () =>
    anfrage<{ url: string; token: string | null; enabled: boolean; provider: string }>('/integrations/lorawan'),
  lorawanNewToken: () => anfrage<{ token: string }>('/integrations/lorawan/token', { method: 'POST' }),

  triggerAlarm: (daten: Record<string, unknown>) =>
    anfrage<{ alarm: AppState['alarms'][number]; merged?: boolean }>('/alarms', { method: 'POST', body: JSON.stringify(daten) }),
  ackAlarm: (id: string, ack: 'acknowledged' | 'declined') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/ack`, { method: 'POST', body: JSON.stringify({ ack }) }),
  endAlarm: (id: string, note = '') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/end`, { method: 'POST', body: JSON.stringify({ note }) }),
  /** Lagemeldung (Führung) oder Fehlalarm-Meldung (auslösende Person) zu einem laufenden Alarm */
  updateAlarm: (id: string, message: string, kind: 'lage' | 'fehlalarm') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/update`, { method: 'POST', body: JSON.stringify({ message, kind }) }),

  /** Bereitschaft: Geräte pro Standort, Sicherung, Push-Dienst, Testmeldung */
  bereitschaft: () => anfrage<Bereitschaft>('/bereitschaft'),
  testpush: () => anfrage<{ ok: boolean; geraete: number }>('/bereitschaft/testpush', { method: 'POST' }),

  updateStatus: () => anfrage<{ version: VersionsInfo; job: UpdateJob | null }>('/update/status'),
  updateJob: () => anfrage<{ job: UpdateJob | null }>('/update/job'),
  startUpdate: (scope: UpdateScope) =>
    anfrage<{ job: UpdateJob }>('/update', { method: 'POST', body: JSON.stringify({ scope }) }),

  startLoneWork: (daten: Record<string, unknown>) =>
    anfrage<{ session: AppState['loneWorkSessions'][number] }>('/lone-work', { method: 'POST', body: JSON.stringify(daten) }),
  extendLoneWork: (id: string, minutes: number) =>
    anfrage<{ session: AppState['loneWorkSessions'][number] }>(`/lone-work/${id}/extend`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  completeLoneWork: (id: string) => anfrage<{ ok: boolean }>(`/lone-work/${id}/complete`, { method: 'POST' }),
}

/**
 * Live-Aktualisierung abonnieren. Der Server meldet jede Änderung, der Client
 * lädt daraufhin den Datenbestand neu.
 */
export function subscribeToServer(beiAenderung: () => void): () => void {
  const token = authToken()
  if (!token) return () => {}
  let quelle: EventSource | null = null
  let geschlossen = false
  let neuverbindung: ReturnType<typeof setTimeout> | undefined

  const verbinden = () => {
    if (geschlossen) return
    quelle = new EventSource(`${serverUrl()}/api/events?token=${encodeURIComponent(token)}`)
    quelle.addEventListener('state', beiAenderung)
    quelle.onerror = () => {
      quelle?.close()
      // Verbindungsabbruch (Serverneustart, Netzwechsel) – nach kurzer Pause erneut versuchen
      if (!geschlossen) neuverbindung = setTimeout(verbinden, 3000)
    }
  }
  verbinden()

  return () => {
    geschlossen = true
    if (neuverbindung) clearTimeout(neuverbindung)
    quelle?.close()
  }
}
