export type Role = 'admin' | 'krisenstab' | 'mitarbeiter'

/** Demo: Beispieldaten + simulierte Zustellung · Live: echter, leerer Datenbestand ohne Simulation */
export type AppMode = 'demo' | 'live'

export type Channel = 'push' | 'sms' | 'email' | 'voice' | 'conference' | 'tts' | 'teams'

export const CHANNEL_LABELS: Record<Channel, string> = {
  push: 'Push-Mitteilung (Critical Alert)',
  sms: 'SMS',
  email: 'E-Mail',
  voice: 'Sprachanruf',
  conference: 'Telefonkonferenz',
  tts: 'Text-to-Speech-Durchsage',
  teams: 'Microsoft Teams',
}

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
   * Anmeldung im Demo-Modus: Salt und Hash liegen lokal (siehe src/lib/auth.ts).
   * Im Live-Modus liefert der Server diese Felder nie – er sendet stattdessen
   * hasPassword, weil Hashes den Server nicht verlassen.
   */
  passwordSalt?: string
  passwordHash?: string
  /** Vom Alarmserver gesetzt: Ist für dieses Konto ein Passwort hinterlegt? */
  hasPassword?: boolean
  /** Erzwingt eine Passwortänderung bei der nächsten Anmeldung */
  mustChangePassword?: boolean
  lastLoginAt?: number
}

export interface Group {
  id: string
  name: string
  description: string
  isCrisisTeam: boolean
}

export interface Location {
  id: string
  name: string
  address: string
  geofence?: { lat: number; lng: number; radiusM: number }
  operatingHours: { days: string; open: string; close: string }
}

export type ScenarioPriority = 'hoch' | 'mittel' | 'tief'

/** Ein Schritt für Empfänger:innen eines Alarms, wahlweise nur für bestimmte Gruppen */
export interface ResponseStep {
  text: string
  /** Leer oder fehlend: gilt für alle Empfänger:innen */
  groupIds?: string[]
}

export interface Scenario {
  id: string
  icon: string
  title: string
  category: string
  priority: ScenarioPriority
  /** Sofortmassnahmen – Schritt für Schritt */
  instructions: string[]
  /** Weiterführende Massnahmen nach der Akutphase */
  followUp: string[]
  checklist: string[]
  silentDefault: boolean
  /** Vorauswahl der Alarmierungskanäle beim Auslösen */
  defaultChannels: Channel[]
  /** Zuständige Gruppen – werden beim Auslösen vorausgewählt */
  responsibleGroupIds: string[]
  /** Verknüpfte Notfallkontakte (extern) */
  contactIds: string[]
  /**
   * Was beim Notruf zu sagen ist und wann überhaupt einer nötig ist.
   * Gehört in die Phase «Alarmieren» – die Sofortmassnahmen enthalten deshalb
   * keine Anweisungen mehr zum Anrufen oder Auslösen.
   */
  callGuidance?: string[]
  /** Was nach der Entwarnung zu tun ist – wird mit der Entwarnungs-Mitteilung angezeigt */
  allClearSteps?: string[]
  /**
   * Was Empfänger:innen dieses Alarms tun. Sie sind nicht am Ort des
   * Geschehens und haben den Alarm von jemand anderem erhalten: kein Notruf,
   * keine erneute Auslösung – stattdessen die eigene Aufgabe.
   *
   * Jeder Schritt kann auf Gruppen eingeschränkt sein; die App zeigt einer
   * Person nur die Schritte ihrer Gruppen. Ohne Gruppen gilt er für alle.
   */
  responseSteps?: ResponseStep[]
  /** @deprecated Vorgänger von responseSteps ohne Gruppenzuordnung; wird beim Lesen umgewandelt */
  responseInstructions?: string[]
  /**
   * Schweizer Rechtsgrundlagen und Normen, die für dieses Szenario gelten.
   * Orientierungshilfe – keine Rechtsberatung.
   */
  legalBasis?: string[]
  /**
   * Nur aktive Szenarien erscheinen in der App und bei der Alarmauslösung.
   * Inaktive bleiben in der Verwaltung ausgegraut erhalten. Fehlt das Feld,
   * gilt das Szenario als aktiv.
   */
  active?: boolean
  custom?: boolean
}

export interface EscalationLevel {
  afterMinutes: number
  channels: Channel[]
  groupIds: string[]
  notifyEmergencyServices: boolean
}

export interface AlarmPlan {
  id: string
  name: string
  scenarioId?: string
  locationIds: string[]
  groupIds: string[]
  channels: Channel[]
  requireAck: boolean
  respectOperatingHours: boolean
  escalation: EscalationLevel[]
}

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed'
export type AckStatus = 'none' | 'acknowledged' | 'declined'

export interface Delivery {
  id: string
  userId: string
  channel: Channel
  status: DeliveryStatus
  ack: AckStatus
  updatedAt: number
}

export interface AlarmLogEntry {
  ts: number
  message: string
}

export interface Alarm {
  id: string
  scenarioId: string
  planId?: string
  message: string
  silent: boolean
  requireAck: boolean
  triggeredByUserId: string
  triggeredVia: 'app' | 'web' | 'hotline' | 'button' | 'timer' | 'webhook'
  triggeredAt: number
  locationIds: string[]
  groupIds: string[]
  channels: Channel[]
  status: 'active' | 'ended'
  endedAt?: number
  /** Text, der mit der Entwarnung mitgeschickt wurde */
  endNote?: string
  /** Übung: gleiche Abläufe, aber als solche gekennzeichnet und im Protokoll getrennt */
  drill?: boolean
  /** Lagemeldungen des Krisenstabs, weitere Meldungen zum selben Ereignis, Fehlalarm-Meldungen */
  updates?: AlarmUpdate[]
  escalationStage: number
  escalation: EscalationLevel[]
  deliveries: Delivery[]
  log: AlarmLogEntry[]
}

export interface AlarmUpdate {
  ts: number
  message: string
  byUserId?: string
  /** lage: Krisenstab informiert · meldung: zweite Auslösung zusammengeführt · fehlalarm: Auslösende:r meldet Irrtum */
  kind: 'lage' | 'meldung' | 'fehlalarm'
}

export interface AlarmButton {
  id: string
  name: string
  type: 'lorawan' | 'gsm'
  serial: string
  locationId?: string
  assignedUserId?: string
  batteryPct: number
  lastSeen: number
  gps?: { lat: number; lng: number }
  messageTemplate: string
  targetGroupIds: string[]
  escalateToEmergencyServicesAfterMin: number
  /** Szenario des ausgelösten Alarms; ohne Angabe Gewalt/Bedrohung */
  scenarioId?: string
}

export interface LoneWorkSession {
  id: string
  userId: string
  locationId: string
  activity: string
  startedAt: number
  durationMin: number
  expiresAt: number
  silent: boolean
  status: 'running' | 'completed' | 'alarm'
  /** Wer beim Ablauf alarmiert wird: Gruppen am Standort (Standard Schulsanität und Hausdienst) … */
  alertGroupIds?: string[]
  /** … und wahlweise einzelne Personen, unabhängig von Gruppe und Standort */
  alertUserIds?: string[]
}

/** Standardempfänger eines Alleinarbeits-Alarms */
export const LONE_WORK_DEFAULT_GROUPS = ['gr-ersthelfer', 'gr-sicherheit']

export interface Webhook {
  id: string
  name: string
  url: string
  direction: 'inbound' | 'outbound'
  scenarioId?: string
  active: boolean
}

export interface AccessCode {
  code: string
  locationId: string
  role: Role
  createdAt: number
  used: number
}

/** SMS-Versand über ein Schweizer Gateway – nur noch konfigurieren, nicht mehr programmieren */
export interface SmsGatewaySettings {
  enabled: boolean
  /** 'ecall' | 'aspsms' | 'http' (eigenes Gateway mit URL-Vorlage) */
  provider: string
  senderId: string
  /** eCall: Benutzername · ASPSMS: Userkey */
  username: string
  /** Geheimnis – der Server liefert nur einen Platzhalter zurück */
  password: string
  /** Nur provider 'http': URL-Vorlage mit den Platzhaltern {to}, {text}, {from} */
  httpUrl: string
  /** Kostenzähler: bisher versendete SMS (führt der Server) */
  sentCount: number
}

/** Meldungen in einen Teams-Kanal des Krisenstabs */
export interface TeamsSettings {
  enabled: boolean
  tenant: string
  /** Incoming-Webhook- oder Workflows-URL des Kanals – maskiert */
  webhookUrl: string
}

/** Sprachanruf und Telefonkonferenz über Microsoft Teams (Graph-Schnittstelle) */
export interface TelephonySettings {
  enabled: boolean
  tenantId: string
  clientId: string
  /** Geheimnis der App-Registrierung – maskiert */
  clientSecret: string
  /** Organisator der Telefonkonferenzen (Teams-Konto, z. B. krisenstab@firma.ch) */
  organizerEmail: string
}

/** Uplink-Endpunkt für LoRaWAN-/GSM-Alarmknöpfe (TTN, ChirpStack oder generisch) */
export interface LorawanSettings {
  enabled: boolean
  /** 'ttn' | 'chirpstack' | 'generic' */
  provider: string
  /** Bearer-Token des Endpunkts – maskiert; Klartext holt die Administration beim Server */
  token: string
}

export interface IntegrationSettings {
  smsGateway: SmsGatewaySettings
  telephony: TelephonySettings
  teams: TeamsSettings
  lorawan: LorawanSettings
  sso: { enabled: boolean; provider: string; entityId: string }
  hrSync: { enabled: boolean; system: string; lastSync?: number }
  hotline: { enabled: boolean; number: string }
  multiLanguage: boolean
  geofencing: boolean
  webhooks: Webhook[]
  accessCodes: AccessCode[]
}

export interface EmergencyContact {
  id: string
  name: string
  number: string
  description: string
}

export interface AuditEntry {
  id: string
  ts: number
  type: string
  message: string
  userId?: string
}

/** Angemeldete Sitzung – null bedeutet: Anmeldemaske anzeigen */
export interface Session {
  userId: string
  loginAt: number
}

export interface AppState {
  mode: AppMode
  /** Aktuelle Anmeldung (pro Modus getrennt gespeichert) */
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
}
