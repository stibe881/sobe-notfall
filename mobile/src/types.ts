export type Role = 'admin' | 'krisenstab' | 'mitarbeiter'

/** Anzeigenamen der Rollen – geschlechtsneutral und ausgeschrieben */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administration',
  krisenstab: 'Krisenstab',
  mitarbeiter: 'Mitarbeitende',
}

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
  /**
   * Umkreis oder Umriss des Standorts.
   *
   * `lat`, `lng` und `radiusM` beschreiben immer einen Kreis: Betriebssysteme
   * überwachen ausschliesslich kreisförmige Regionen, iOS wie Android. Sind
   * `punkte` gesetzt (drei bis zehn Eckpunkte), dient der Kreis nur noch als
   * Auslöser – ob jemand wirklich am Standort ist, entscheidet dann der Umriss.
   * Ohne `punkte` gilt der Kreis selbst.
   */
  geofence?: { lat: number; lng: number; radiusM: number; punkte?: { lat: number; lng: number }[] }
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
  /**
   * Nur aufbieten, wenn bis dahin niemand zugesagt hat.
   *
   * Zwei Arten von Stufen gibt es, und sie schliessen sich aus:
   *
   *   false (Standard) – geplanter Ablauf. Die Stufe zündet nach ihrer Frist,
   *     ob jemand zugesagt hat oder nicht. So sind die schweren Lagen gedacht:
   *     Bei einem Brand kommt das Evakuationsteam nach drei Minuten dazu und
   *     der Krisenstab nach zehn – unabhängig davon, ob eine einzelne Lehrperson
   *     «ich komme» getippt hat. Diese Gruppen sollen gerade dann aufgeboten
   *     werden, wenn vor Ort schon jemand handelt.
   *
   *   true – Rückfallebene. Die Stufe entfällt, sobald jemand aus der bereits
   *     alarmierten zuständigen Gruppe zugesagt hat. Gedacht für Lagen, in
   *     denen eine Zusage die Sache erledigt – etwa «Krisenstab einberufen»:
   *     meldet sich ein Mitglied, braucht es die zweite Runde nicht.
   *
   * Fehlt das Feld, gilt der geplante Ablauf. Das ist die sichere Annahme:
   * lieber eine Gruppe zu viel aufbieten als den Krisenstab nie erreichen.
   */
  nurWennUnbeantwortet?: boolean
}

export interface AlarmPlan {
  id: string
  name: string
  scenarioId?: string
  locationIds: string[]
  groupIds: string[]
  channels: Channel[]
  requireAck: boolean
  /**
   * @deprecated Wurde nie ausgewertet und ist aus der Oberfläche entfernt.
   * Ein Notfall nach Uhrzeit zu unterdrücken ist nie richtig – der Schalter
   * stand im Seed ausgerechnet beim Medizinischen Notfall auf «an». Bleibt
   * nur, damit gespeicherte Pläne weiterhin lesbar sind.
   */
  respectOperatingHours?: boolean
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
  /** Letzte Position der auslösenden Person im Gebäude (Indoor-Ortung) */
  indoor?: IndoorPosition
  /** Lagemeldungen des Krisenstabs, weitere Meldungen zum selben Ereignis, Fehlalarm-Meldungen */
  updates?: AlarmUpdate[]
  escalationStage: number
  escalation: EscalationLevel[]
  /**
   * Nur für den Versand an den Server: bewusst ohne Alarmplan und Stufen –
   * etwa die Information an ein einzelnes Krisenstab-Mitglied. Fehlt das
   * Feld und sind keine Stufen gesetzt, löst der Server den Plan auf.
   */
  ohneEskalation?: boolean
  deliveries: Delivery[]
  log: AlarmLogEntry[]
}

/**
 * Position im Gebäude laut Meridian-SDK. x/y sind Pixel auf dem Grundriss der
 * Karte – dasselbe Koordinatensystem, in dem das Portal die Markierung zeichnet.
 */
export interface IndoorPosition {
  mapId: string
  x: number
  y: number
  /** Maximaler Fehler in Metern, soweit das SDK ihn angibt */
  genauigkeitM?: number
  /** Wann das Gerät die Position bestimmt hat */
  ermitteltAt: number
  /** Woraus das SDK sie errechnet hat: Beacons oder WLAN der Access Points, sonst Ortung des Betriebssystems */
  quelle?: 'beacons' | 'wlan' | 'system' | 'unbekannt'
}

export interface AlarmUpdate {
  ts: number
  message: string
  byUserId?: string
  /** lage: Krisenstab informiert · meldung: zweite Auslösung zusammengeführt · fehlalarm: Auslösende:r meldet Irrtum */
  kind: 'lage' | 'meldung' | 'fehlalarm' | 'standort'
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
  /**
   * Modell des Geräts. Bei bekannten Modellen übersetzt der Alarmserver die
   * Nutzlast selbst – nötig, wenn der Netzserver keinen Payload-Decoder kennt.
   */
  geraetetyp?: string
  /** Still alarmieren: Mitteilung ohne Ton und ohne Vibration. Ohne Angabe laut. */
  silent?: boolean
  /** Wann der Server zuletzt wegen Stille bzw. schwacher Batterie gewarnt hat */
  gewarnt?: { stillAt?: number; batterieAt?: number }
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

/** Eine Karte (ein Stockwerk) im Meridian Editor und wie sie in Alarmen heisst */
export interface MeridianKarte {
  /** Map-ID aus dem Meridian Editor (steht in der Adresse der Karte) */
  mapId: string
  /** Klarname für Alarmtexte, z. B. «Hauptgebäude, 2. OG» */
  name: string
  /** Standort, zu dem die Karte gehört – der Alarm geht dann auch an die Personen dort */
  locationId?: string
}

/**
 * Indoor-Ortung über Aruba Meridian (Option B des Konzepts): Die Access Points
 * senden Bluetooth-Beacons, das Meridian-SDK in der App rechnet daraus eine
 * Position auf dem Grundriss. Die App übermittelt sie nur mit einem Alarm.
 */
export interface MeridianSettings {
  enabled: boolean
  /** Rechenzentrum des Meridian-Kontos: edit.meridianapps.com (us) oder edit-eu.meridianapps.com (eu) */
  region: 'us' | 'eu'
  /** Location-ID im Meridian Editor (im SDK «App» genannt) */
  appId: string
  /**
   * Application Token für das Mobile-SDK. Es steckt in jeder App, die sich
   * ortet – deshalb nicht geheim und nicht maskiert.
   */
  sdkToken: string
  /** Lese-Token (read-only) für die Grundrissanzeige im Portal – maskiert */
  apiToken: string
  karten: MeridianKarte[]
}

export interface IntegrationSettings {
  /** Name und Auftritt der Organisation – kommt pro Kunde vom Alarmserver */
  organization?: { name: string; appName?: string; shortName: string; color?: string; logoVersion?: string; logoPlatte?: boolean }
  smsGateway: { enabled: boolean; provider: string; senderId: string; username: string; password: string; httpUrl: string; sentCount: number }
  telephony: { enabled: boolean; tenantId: string; clientId: string; clientSecret: string; organizerEmail: string }
  teams: { enabled: boolean; tenant: string; webhookUrl: string }
  lorawan: { enabled: boolean; provider: string; token: string; stilleWarnungStunden: number; batterieWarnungProzent: number }
  sso: { enabled: boolean; tenantId: string; clientId: string; clientSecret: string; adminGroupId: string; krisenstabGroupId: string; autoCreate: boolean }
  /** Indoor-Ortung (Aruba Meridian); fehlt bei älteren Alarmservern */
  meridian?: MeridianSettings
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
  /** Reihenfolge in Listen und in der App – tiefere Zahl zuerst; ohne Angabe zuletzt */
  order?: number
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
  /**
   * Wie die Anmeldung zustande kam. Nach einer Microsoft-Anmeldung (sso) wird
   * ein erzwungener Passwortwechsel nicht angezeigt – er betrifft nur die
   * Passwort-Anmeldung.
   */
  via?: 'password' | 'sso'
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

/** Auskunft des Servers zur Redundanz: Rolle dieser Instanz und Partneradresse */
export interface ServerInfo {
  rolle: 'primary' | 'standby' | null
  fallbackUrl: string | null
  failover: boolean
}
