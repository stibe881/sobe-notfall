import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppState, User } from './types'

/**
 * Verbindung zum Alarmserver (Live-Modus).
 *
 * Der Demo-Modus arbeitet weiterhin ohne Netz auf dem Gerät. Im Live-Modus
 * kommen alle Daten vom Server, damit App und Webportal denselben Bestand sehen.
 */

const URL_KEY = 'sobe-server-url'
const TOKEN_KEY = 'sobe-server-token'

/**
 * Betriebsadresse des Alarmservers. Wer die App neu installiert, ist damit
 * sofort verbunden; unter «Alarmserver» im Anmeldebildschirm lässt sie sich
 * ändern, etwa für einen Testserver im Schulnetz.
 */
export const DEFAULT_SERVER_URL = 'https://temp-gross-ict.ch'

let serverUrlCache = DEFAULT_SERVER_URL
let tokenCache: string | null = null

/** Beim Start einmalig aus dem Gerätespeicher laden */
export async function loadApiSettings(): Promise<void> {
  try {
    const [url, token] = await Promise.all([AsyncStorage.getItem(URL_KEY), AsyncStorage.getItem(TOKEN_KEY)])
    if (url) serverUrlCache = url
    tokenCache = token
  } catch {
    // kein Speicher verfügbar – Standardwerte bleiben
  }
}

export const serverUrl = () => serverUrlCache

export async function setServerUrl(url: string): Promise<void> {
  serverUrlCache = url.trim().replace(/\/+$/, '')
  try {
    await AsyncStorage.setItem(URL_KEY, serverUrlCache)
  } catch {
    // Adresse gilt dann nur für diese Sitzung
  }
}

export const authToken = () => tokenCache

export async function setAuthToken(token: string | null): Promise<void> {
  tokenCache = token
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token)
    else await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    // Token gilt dann nur für diese Sitzung
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function anfrage<T>(pfad: string, optionen: RequestInit = {}): Promise<T> {
  let antwort: Response
  try {
    antwort = await fetch(serverUrl() + '/api' + pfad, {
      ...optionen,
      headers: {
        'Content-Type': 'application/json',
        ...(tokenCache ? { Authorization: `Bearer ${tokenCache}` } : {}),
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

export type ServerData = Omit<AppState, 'mode' | 'session' | 'currentUserId' | 'scenarioContentVersion' | 'authVersion'>

export interface SetupInfo {
  freshInstall: boolean
  adminEmail: string | null
  userCount: number
  /** Single Sign-On eingerichtet – die Anmeldemaske zeigt dann den Microsoft-Knopf */
  sso?: boolean
}

export const api = {
  health: () => anfrage<{ ok: boolean }>('/health'),
  /** Öffentliche Auskunft für die Anmeldemaske – ohne Anmeldung abrufbar */
  setup: () => anfrage<SetupInfo>('/setup'),
  login: (email: string, password: string) =>
    anfrage<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => anfrage<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => anfrage<{ user: User }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    anfrage<{ ok: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  state: () => anfrage<ServerData>('/state'),
  triggerAlarm: (daten: Record<string, unknown>) =>
    anfrage<{ alarm: AppState['alarms'][number]; merged?: boolean }>('/alarms', { method: 'POST', body: JSON.stringify(daten) }),
  /** Lagemeldung (Führung) oder Fehlalarm-Meldung (auslösende Person) zu einem laufenden Alarm */
  updateAlarm: (id: string, message: string, kind: 'lage' | 'fehlalarm') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/update`, { method: 'POST', body: JSON.stringify({ message, kind }) }),
  ackAlarm: (id: string, ack: 'acknowledged' | 'declined') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/ack`, { method: 'POST', body: JSON.stringify({ ack }) }),
  endAlarm: (id: string, note = '') =>
    anfrage<{ alarm: AppState['alarms'][number] }>(`/alarms/${id}/end`, { method: 'POST', body: JSON.stringify({ note }) }),
  startLoneWork: (daten: Record<string, unknown>) =>
    anfrage<{ session: AppState['loneWorkSessions'][number] }>('/lone-work', { method: 'POST', body: JSON.stringify(daten) }),
  extendLoneWork: (id: string, minutes: number) =>
    anfrage<{ session: AppState['loneWorkSessions'][number] }>(`/lone-work/${id}/extend`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  completeLoneWork: (id: string) => anfrage<{ ok: boolean }>(`/lone-work/${id}/complete`, { method: 'POST' }),
  /**
   * Geofencing: aktuellen Aufenthaltsort melden – nur der Standort-Name
   * (locationId) oder null («an keinem erfassten Standort»), nie GPS.
   */
  geoReport: (locationId: string | null) =>
    anfrage<{ ok: boolean; disabled?: boolean }>('/geo/report', { method: 'POST', body: JSON.stringify({ locationId }) }),
  /** criticalAlerts: Darf dieses Gerät Alarme auch bei stummem Telefon hörbar machen? */
  registerPush: (token: string, criticalAlerts: boolean) =>
    anfrage<{ ok: boolean }>('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'ios', criticalAlerts }),
    }),
  unregisterPush: (token: string) =>
    anfrage<{ ok: boolean }>('/push/unregister', { method: 'POST', body: JSON.stringify({ token }) }),
}
