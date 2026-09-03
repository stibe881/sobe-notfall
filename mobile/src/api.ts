import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { AppState, ServerInfo, User } from './types'

/**
 * Verbindung zum Alarmserver (Live-Modus).
 *
 * Der Demo-Modus arbeitet weiterhin ohne Netz auf dem Gerät. Im Live-Modus
 * kommen alle Daten vom Server, damit App und Webportal denselben Bestand sehen.
 */

const URL_KEY = 'sobe-server-url'
const FALLBACK_KEY = 'sobe-server-fallback'
const TOKEN_KEY = 'sobe-server-token'

/**
 * Betriebsadresse des Alarmservers. Wer die App neu installiert, ist damit
 * sofort verbunden; unter «Alarmserver» im Anmeldebildschirm lässt sie sich
 * ändern, etwa für einen Testserver im Schulnetz.
 */
export const DEFAULT_SERVER_URL = 'https://temp-gross-ict.ch'

let serverUrlCache = DEFAULT_SERVER_URL
let fallbackUrlCache: string | null = null
let tokenCache: string | null = null

/** Beim Start einmalig aus dem Gerätespeicher laden */
export async function loadApiSettings(): Promise<void> {
  try {
    const [url, fallback, token] = await Promise.all([
      AsyncStorage.getItem(URL_KEY),
      AsyncStorage.getItem(FALLBACK_KEY),
      AsyncStorage.getItem(TOKEN_KEY),
    ])
    if (url) serverUrlCache = url
    fallbackUrlCache = fallback
    tokenCache = token
  } catch {
    // kein Speicher verfügbar – Standardwerte bleiben
  }
}

export const serverUrl = () => serverUrlCache
export const fallbackUrl = () => fallbackUrlCache

export async function setServerUrl(url: string): Promise<void> {
  serverUrlCache = url.trim().replace(/\/+$/, '')
  try {
    await AsyncStorage.setItem(URL_KEY, serverUrlCache)
  } catch {
    // Adresse gilt dann nur für diese Sitzung
  }
}

/**
 * Ausweichserver (Redundanz): Fällt der eingestellte Alarmserver aus, versucht
 * die App jede Anfrage automatisch dort – und bleibt bei Erfolg darauf, bis der
 * Hauptserver zurück ist.
 */
export async function setFallbackUrl(url: string | null): Promise<void> {
  const bereinigt = url?.trim().replace(/\/+$/, '') || null
  if (bereinigt === fallbackUrlCache) return
  fallbackUrlCache = bereinigt
  try {
    if (bereinigt) await AsyncStorage.setItem(FALLBACK_KEY, bereinigt)
    else await AsyncStorage.removeItem(FALLBACK_KEY)
  } catch {
    // Adresse gilt dann nur für diese Sitzung
  }
}

/** Aktiven Server und Ausweichserver tauschen – nach einem gelungenen Ausweichen */
async function wechsleAufFallback(): Promise<void> {
  if (!fallbackUrlCache) return
  const bisher = serverUrlCache
  await setServerUrl(fallbackUrlCache)
  await setFallbackUrl(bisher)
}

/** Wie oft höchstens geprüft wird, ob der Hauptserver zurück ist */
const RUECKKEHR_PRUEFUNG_MS = 5 * 60_000
let letzteRueckkehrPruefung = 0

/**
 * Serverauskunft aus dem Datenbestand übernehmen: Ausweichadresse merken und –
 * hängt die App gerade am Standby – regelmässig prüfen, ob der Hauptserver
 * wieder erreichbar ist. Zurück auf den Hauptserver, sobald er antwortet,
 * sonst gingen dort ausgelöste Änderungen beim nächsten Abgleich verloren.
 */
export async function merkeServerInfo(info: ServerInfo | undefined): Promise<void> {
  if (!info) return
  await setFallbackUrl(info.fallbackUrl)
  if (info.rolle !== 'standby' || !info.fallbackUrl) return
  const jetzt = Date.now()
  if (jetzt - letzteRueckkehrPruefung < RUECKKEHR_PRUEFUNG_MS) return
  letzteRueckkehrPruefung = jetzt
  try {
    const antwort = await fetch(`${info.fallbackUrl}/api/health`)
    if (antwort.ok) await wechsleAufFallback()
  } catch {
    // Hauptserver weiterhin weg – beim Standby bleiben
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

async function rohAnfrage(basis: string, pfad: string, optionen: RequestInit): Promise<Response> {
  return fetch(basis + '/api' + pfad, {
    ...optionen,
    headers: {
      'Content-Type': 'application/json',
      ...(tokenCache ? { Authorization: `Bearer ${tokenCache}` } : {}),
      ...(optionen.headers ?? {}),
    },
  })
}

async function anfrage<T>(pfad: string, optionen: RequestInit = {}): Promise<T> {
  let antwort: Response
  try {
    antwort = await rohAnfrage(serverUrl(), pfad, optionen)
  } catch {
    // Redundanz: denselben Aufruf beim Ausweichserver versuchen. Klappt er,
    // wechselt die App dorthin – die Sitzung gilt weiter, der Standby führt
    // die replizierten Konten und Sitzungen des Hauptservers.
    const ausweich = fallbackUrlCache
    if (ausweich && ausweich !== serverUrl()) {
      try {
        antwort = await rohAnfrage(ausweich, pfad, optionen)
        await wechsleAufFallback()
      } catch {
        throw new ApiError(`Der Alarmserver unter ${serverUrl()} ist nicht erreichbar (auch nicht der Ausweichserver).`, 0)
      }
    } else {
      throw new ApiError(`Der Alarmserver unter ${serverUrl()} ist nicht erreichbar.`, 0)
    }
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
  /** Name der Organisation – erscheint vor der Anmeldung */
  organization?: string | null
  /** Akzentfarbe (#rrggbb) und Logo-Version – Branding schon vor der Anmeldung */
  organizationColor?: string | null
  logoVersion?: string | null
  /** Redundanz: Rolle dieses Servers und Ausweichadresse */
  serverRolle?: 'primary' | 'standby' | null
  fallbackUrl?: string | null
  failover?: boolean
}

/** Adresse des Kundenlogos – die Versionskennung macht sie dauerhaft cachebar */
export const logoUri = (version: string): string => `${serverUrl()}/api/branding/logo?v=${encodeURIComponent(version)}`

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
      body: JSON.stringify({ token, platform: Platform.OS, criticalAlerts }),
    }),
  unregisterPush: (token: string) =>
    anfrage<{ ok: boolean }>('/push/unregister', { method: 'POST', body: JSON.stringify({ token }) }),
}
