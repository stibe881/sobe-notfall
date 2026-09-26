/**
 * Domänentypen, die Server, Portal und App gemeinsam haben, kommen aus
 * @sobe/shared-types (packages/shared-types) und werden hier nur
 * weitergereicht – bestehende Importe von './types' bleiben unverändert
 * gültig. Lokal bleibt nur, was für die App eigen ist: `User` (die vom
 * Server gesendete, flache Sicht auf ein Konto), `IntegrationSettings`
 * (defensiver als bei Server/Portal, weil die App auch ältere Alarmserver
 * unterstützen muss, die organization/meridian/retention noch nicht
 * mitschicken) und `AppState` (ohne die portal-eigene Vorschau-Funktion).
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
  RetentionSettings,
  EmergencyContact,
  AuditEntry,
  Session,
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
  RetentionSettings,
  EmergencyContact,
  AuditEntry,
  Session,
  ServerInfo,
}

export { ROLE_LABELS, CHANNEL_LABELS, LONE_WORK_DEFAULT_GROUPS } from '@sobe/shared-types'

export interface User {
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
  /**
   * Der Server liefert diese Felder nie – er sendet stattdessen hasPassword,
   * weil Hashes den Server nicht verlassen.
   */
  passwordSalt?: string
  passwordHash?: string
  /** Vom Alarmserver gesetzt: Ist für dieses Konto ein Passwort hinterlegt? */
  hasPassword?: boolean
  /**
   * Vom Alarmserver gesetzt: Zahl der Geräte, auf denen diese Person die App
   * angemeldet hat. Null bedeutet, dass sie kein Push erreicht.
   */
  geraete?: number
  /** Vom Alarmserver gesetzt: Erlaubt mindestens ein Gerät Critical Alerts? */
  criticalAlerts?: boolean
  /** Erzwingt eine Passwortänderung bei der nächsten Anmeldung */
  mustChangePassword?: boolean
  lastLoginAt?: number
  /** Letzte Anmeldung über Microsoft (SSO) – kennzeichnet SSO-Konten */
  ssoLoginAt?: number
}

export interface IntegrationSettings {
  /** Name und Auftritt der Organisation – kommt pro Kunde vom Alarmserver */
  organization?: OrganizationSettings
  smsGateway: SmsGatewaySettings
  telephony: TelephonySettings
  teams: TeamsSettings
  lorawan: LorawanSettings
  sso: SsoSettings
  /** Indoor-Ortung (Aruba Meridian); fehlt bei älteren Alarmservern */
  meridian?: MeridianSettings
  hrSync: { enabled: boolean; system: string; lastSync?: number }
  hotline: { enabled: boolean; number: string }
  multiLanguage: boolean
  geofencing: boolean
  webhooks: Webhook[]
  accessCodes: AccessCode[]
  /** Aufbewahrungsfristen für Alarme/Audit-Log (Tage, 0 = unbegrenzt); fehlt bei älteren Alarmservern */
  retention?: RetentionSettings
}

export interface AppState {
  /** Aktuelle Anmeldung */
  session: Session | null
  /** Version der Standard-Szenarien-Inhalte – für einmalige Content-Updates beim Laden */
  scenarioContentVersion?: number
  /** Version der Anmelde-Migration – für einmalige Korrekturen an Passwortdaten */
  authVersion?: number
  currentUserId: string
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
  /** Rolle und Ausweichadresse des Alarmservers */
  serverInfo?: ServerInfo
}
