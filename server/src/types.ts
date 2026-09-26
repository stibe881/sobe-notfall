/**
 * Domänentypen, die Server, Portal und App gemeinsam haben, kommen aus
 * @sobe/shared-types (packages/shared-types) und werden hier nur
 * weitergereicht – bestehende Importe von './types.js' bleiben unverändert
 * gültig. Lokal bleiben nur die server-eigenen Typen: `StoredUser`/`User`
 * (Passwortfelder verlassen den Server nie), die Redundanz-Konfiguration und
 * `ServerState` (der volle, an Clients ausgelieferte Datenbestand).
 */
import type {
  Role,
  Channel,
  Group,
  Location,
  ScenarioPriority,
  ResponseStep,
  Scenario,
  EscalationLevel,
  AlarmPlan,
  DeliveryStatus,
  AckStatus,
  Delivery,
  AlarmLogEntry,
  Alarm,
  IndoorPosition,
  AlarmUpdate,
  AlarmButton,
  LoneWorkSession,
  Webhook,
  AccessCode,
  SmsGatewaySettings,
  TeamsSettings,
  TelephonySettings,
  LorawanSettings,
  SsoSettings,
  OrganizationSettings,
  MeridianKarte,
  MeridianSettings,
  IntegrationSettings,
  RetentionSettings,
  EmergencyContact,
  AuditEntry,
  ServerInfo,
} from '@sobe/shared-types'

export type {
  Role,
  Channel,
  Group,
  Location,
  ScenarioPriority,
  ResponseStep,
  Scenario,
  EscalationLevel,
  AlarmPlan,
  DeliveryStatus,
  AckStatus,
  Delivery,
  AlarmLogEntry,
  Alarm,
  IndoorPosition,
  AlarmUpdate,
  AlarmButton,
  LoneWorkSession,
  Webhook,
  AccessCode,
  SmsGatewaySettings,
  TeamsSettings,
  TelephonySettings,
  LorawanSettings,
  SsoSettings,
  OrganizationSettings,
  MeridianKarte,
  MeridianSettings,
  IntegrationSettings,
  RetentionSettings,
  EmergencyContact,
  AuditEntry,
  ServerInfo,
}

export { CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS } from '@sobe/shared-types'

/** Benutzer, wie er in der Datenbank liegt – mit Passwortfeldern */
export interface StoredUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: Role
  groupIds: string[]
  locationId: string
  language: 'de' | 'en' | 'fr' | 'it'
  absence?: { from: string; to: string }
  partTimeNote?: string
  passwordHash?: string
  passwordSalt?: string
  mustChangePassword?: boolean
  lastLoginAt?: number
  /** Letzte Anmeldung über Microsoft (SSO) – kennzeichnet SSO-Konten in der Benutzerverwaltung */
  ssoLoginAt?: number
}

/** Benutzer, wie ihn die Clients erhalten – ohne Passwortdaten */
/**
 * Konto, wie es die Clients sehen. Passwortfelder verlassen den Server nie;
 * `geraete` und `criticalAlerts` rechnet der Server aus den registrierten
 * Push-Geräten – ohne sie liesse sich nicht sagen, ob ein Alarm die Person
 * überhaupt erreicht.
 */
export type User = Omit<StoredUser, 'passwordHash' | 'passwordSalt'> & {
  hasPassword: boolean
  geraete?: number
  criticalAlerts?: boolean
  /** Letzte vom Push-Dienst bestätigte Zustellung an eines ihrer Geräte */
  letzteZustellung?: number | null
}

/**
 * Redundanz: Konfiguration dieser Instanz für den Betrieb mit einem zweiten
 * Alarmserver. Gehört zur Instanz selbst und wird deshalb NIE repliziert –
 * sonst würde der Standby seine eigene Rolle mit der des Hauptservers
 * überschreiben.
 */
export interface RedundanzConfig {
  enabled: boolean
  /** primary: führt die Daten · standby: spiegelt sie und übernimmt bei Ausfall */
  role: 'primary' | 'standby'
  /** Adresse des Partnerservers, z. B. https://notfall2.firma.ch */
  peerUrl: string
  /** Gemeinsames Geheimnis beider Instanzen – schützt die Replikations-Endpunkte */
  secret: string
  /** Abstand der Abgleiche in Sekunden (nur Standby) */
  intervalS: number
}

/** Laufender Zustand des Abgleichs – für die Anzeige im Portal */
export interface RedundanzStatus {
  lastSyncAt: number | null
  lastSyncOk: boolean | null
  lastSyncError: string | null
  /** Der Standby hat übernommen, weil der Hauptserver nicht erreichbar ist */
  failoverAktiv: boolean
}

/** Vollständiger Datenbestand, wie ihn die Clients erhalten */
export interface ServerState {
  users: User[]
  groups: Group[]
  locations: Location[]
  scenarios: Scenario[]
  plans: AlarmPlan[]
  alarms: Alarm[]
  buttons: AlarmButton[]
  loneWorkSessions: LoneWorkSession[]
  integrations: IntegrationSettings
  contacts: EmergencyContact[]
  audit: AuditEntry[]
  /** Rolle und Ausweichadresse dieses Servers (nur im Live-Betrieb vorhanden) */
  serverInfo?: ServerInfo
}
