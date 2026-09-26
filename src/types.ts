/**
 * Domänentypen, die Server, Portal und App gemeinsam haben, kommen aus
 * @sobe/shared-types (packages/shared-types) und werden hier nur
 * weitergereicht – bestehende Importe von './types' bleiben unverändert
 * gültig. Lokal bleibt nur, was für das Portal eigen ist: `User` (die vom
 * Server gesendete, flache Sicht auf ein Konto) und `AppState` (der volle
 * Portal-Zustand inkl. angemeldeter Sitzung und Vorschau-Funktion).
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
  IntegrationSettings,
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
   * angemeldet hat. Null bedeutet, dass sie kein Push erreicht – der
   * wichtigste Zustand in einem Alarmsystem und deshalb Teil des Bestands.
   */
  geraete?: number
  /** Vom Alarmserver gesetzt: Erlaubt mindestens ein Gerät Critical Alerts? */
  criticalAlerts?: boolean
  /** Vom Alarmserver gesetzt: letzte vom Push-Dienst bestätigte Zustellung – die ehrliche Grundlage für «erreichbar» */
  letzteZustellung?: number | null
  /** Erzwingt eine Passwortänderung bei der nächsten Anmeldung */
  mustChangePassword?: boolean
  lastLoginAt?: number
  /** Letzte Anmeldung über Microsoft (SSO) – kennzeichnet SSO-Konten */
  ssoLoginAt?: number
}

export interface AppState {
  /** Aktuelle Anmeldung */
  session: Session | null
  /** Version der Standard-Szenarien-Inhalte – für einmalige Content-Updates beim Laden */
  scenarioContentVersion?: number
  /** Version der Anmelde-Migration – für einmalige Korrekturen an Passwortdaten */
  authVersion?: number
  currentUserId: string
  /**
   * App-Vorschau als andere Person (nur Portal, nicht auf dem Server): Die
   * Ansicht zeigt deren Alarme und Schritte, Aktionen bleiben im Live-Betrieb
   * gesperrt – sie liefen sonst unter dem angemeldeten Konto.
   */
  previewUserId?: string
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
