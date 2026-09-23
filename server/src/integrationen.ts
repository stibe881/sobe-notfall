import { randomBytes } from 'node:crypto'
import { getSetting, setSetting } from './db.js'
import type { IntegrationSettings, LorawanSettings, SmsGatewaySettings, TeamsSettings, TelephonySettings } from './types.js'

/**
 * Grundlagen der Integrationen: Vorgaben, Geheimnis-Maskierung und die reinen
 * Bausteine (SMS-Anbieter, Teams-Karten, LoRaWAN-Auswertung). Der eigentliche
 * Versand entlang eines Alarms steht in kanaele.ts.
 */

export const INTEGRATION_VORGABEN: IntegrationSettings = {
  organization: { name: '', shortName: '' },
  smsGateway: { enabled: false, provider: 'ecall', senderId: 'ALARM', username: '', password: '', httpUrl: '', sentCount: 0 },
  telephony: { enabled: false, tenantId: '', clientId: '', clientSecret: '', organizerEmail: '' },
  teams: { enabled: false, tenant: '', webhookUrl: '' },
  lorawan: { enabled: false, provider: 'ttn', token: '', stilleWarnungStunden: 36, batterieWarnungProzent: 20 },
  sso: { enabled: false, tenantId: '', clientId: '', clientSecret: '', adminGroupId: '', krisenstabGroupId: '', autoCreate: true },
  hrSync: { enabled: false, system: '' },
  hotline: { enabled: true, number: '' },
  multiLanguage: true,
  geofencing: false,
  webhooks: [],
  accessCodes: [],
}

/**
 * Gespeicherte Einstellungen um die Vorgaben ergänzen. Bestände aus früheren
 * Versionen kennen einzelne Abschnitte oder Felder noch nicht – sie erhalten
 * die Vorgabe, ohne dass Bestehendes verloren geht.
 */
export function mitVorgaben(roh: Partial<IntegrationSettings> | null | undefined): IntegrationSettings {
  const r = roh ?? {}
  return {
    ...INTEGRATION_VORGABEN,
    ...r,
    organization: { ...INTEGRATION_VORGABEN.organization, ...r.organization },
    smsGateway: { ...INTEGRATION_VORGABEN.smsGateway, ...r.smsGateway },
    telephony: { ...INTEGRATION_VORGABEN.telephony, ...r.telephony },
    teams: { ...INTEGRATION_VORGABEN.teams, ...r.teams },
    lorawan: { ...INTEGRATION_VORGABEN.lorawan, ...r.lorawan },
    sso: { ...INTEGRATION_VORGABEN.sso, ...r.sso },
    hrSync: { ...INTEGRATION_VORGABEN.hrSync, ...r.hrSync },
    hotline: { ...INTEGRATION_VORGABEN.hotline, ...r.hotline },
    webhooks: r.webhooks ?? [],
    accessCodes: r.accessCodes ?? [],
  }
}

// ---------- Geheimnisse ----------

/**
 * Geheimnisse verlassen den Server nie im Klartext: Der Datenbestand geht an
 * alle angemeldeten Geräte, auch an die App der Mitarbeitenden. Gespeicherte
 * Werte erscheinen dort nur als Platzhalter; wer den Platzhalter zurückschickt,
 * lässt das gespeicherte Geheimnis unverändert.
 */
export const GEHEIM_PLATZHALTER = '••••••••'

const GEHEIME_FELDER = [
  ['smsGateway', 'password'],
  ['telephony', 'clientSecret'],
  ['teams', 'webhookUrl'],
  ['lorawan', 'token'],
  ['sso', 'clientSecret'],
] as const

export function maskiereIntegrationen(integ: IntegrationSettings): IntegrationSettings {
  const kopie = structuredClone(integ)
  for (const [abschnitt, feld] of GEHEIME_FELDER) {
    const teil = kopie[abschnitt] as unknown as Record<string, string>
    if (teil[feld]) teil[feld] = GEHEIM_PLATZHALTER
  }
  return kopie
}

/** Eingehende Einstellungen mit dem gespeicherten Stand zusammenführen */
export function mergeIntegrationen(neu: Partial<IntegrationSettings>, alt: IntegrationSettings): IntegrationSettings {
  const ergebnis = mitVorgaben(neu)
  for (const [abschnitt, feld] of GEHEIME_FELDER) {
    const teil = ergebnis[abschnitt] as unknown as Record<string, string>
    const bisher = alt[abschnitt] as unknown as Record<string, string>
    if (teil[feld] === GEHEIM_PLATZHALTER) teil[feld] = bisher[feld] ?? ''
  }
  // Der Kostenzähler wird nur vom Server geführt, nie vom Client gesetzt
  ergebnis.smsGateway.sentCount = alt.smsGateway.sentCount ?? 0
  // Die Logo-Version verwaltet allein der Upload-Endpunkt
  ergebnis.organization.logoVersion = alt.organization.logoVersion
  // Die Akzentfarbe landet in Stylesheets – nur ein sauberes #rrggbb speichern
  if (ergebnis.organization.color && !/^#[0-9a-fA-F]{6}$/.test(ergebnis.organization.color)) {
    ergebnis.organization.color = alt.organization.color
  }
  return ergebnis
}

// ---------- Lesen und Schreiben ----------

export function ladeIntegrationen(): IntegrationSettings {
  return mitVorgaben(JSON.parse(getSetting('integrations') ?? '{}') as Partial<IntegrationSettings>)
}

export function speichereIntegrationen(value: IntegrationSettings): void {
  setSetting('integrations', JSON.stringify(value))
}

export function neuesLorawanToken(): string {
  return `lw_${randomBytes(24).toString('hex')}`
}

// ---------- SMS-Anbieter ----------

/** Telefonnummer für den Versand normieren (Leerzeichen und Trennzeichen entfernen) */
export function normierteNummer(nummer: string): string {
  return nummer.replace(/[^\d+]/g, '')
}

export interface SmsErgebnis {
  ok: boolean
  fehler?: string
}

/**
 * Eine SMS an mehrere Empfänger übergeben. Rückgabe pro Nummer, damit die
 * Alarmzentrale den Zustellstatus je Person ehrlich zeigen kann.
 */
export async function sendeSms(sms: SmsGatewaySettings, nummern: string[], text: string): Promise<Map<string, SmsErgebnis>> {
  const ergebnis = new Map<string, SmsErgebnis>()
  const ziele = [...new Set(nummern.map(normierteNummer).filter(Boolean))]
  if (ziele.length === 0) return ergebnis

  if (sms.provider === 'aspsms') {
    // ASPSMS JSON-Schnittstelle – ein Aufruf für alle Empfänger
    try {
      const antwort = await fetch('https://json.aspsms.com/SendSimpleTextSMS', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: sms.username,
          Password: sms.password,
          Originator: sms.senderId || 'SOBE',
          Recipients: ziele,
          MessageText: text,
        }),
      })
      const daten = (await antwort.json().catch(() => null)) as { StatusCode?: string; StatusInfo?: string } | null
      const ok = antwort.ok && daten?.StatusCode === '1'
      for (const z of ziele) ergebnis.set(z, ok ? { ok } : { ok: false, fehler: daten?.StatusInfo ?? `HTTP ${antwort.status}` })
    } catch (fehler) {
      for (const z of ziele) ergebnis.set(z, { ok: false, fehler: (fehler as Error).message })
    }
    return ergebnis
  }

  for (const ziel of ziele) {
    try {
      if (sms.provider === 'http') {
        // Eigenes Gateway: URL-Vorlage mit {to}, {text}, {from}
        const url = sms.httpUrl
          .replace('{to}', encodeURIComponent(ziel))
          .replace('{text}', encodeURIComponent(text))
          .replace('{from}', encodeURIComponent(sms.senderId))
        const antwort = await fetch(url)
        ergebnis.set(ziel, antwort.ok ? { ok: true } : { ok: false, fehler: `HTTP ${antwort.status}` })
      } else {
        // eCall REST-Schnittstelle (Vorgabe)
        const antwort = await fetch('https://rest.ecall.ch/api/sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${sms.username}:${sms.password}`).toString('base64')}`,
          },
          body: JSON.stringify({ from: sms.senderId || undefined, to: ziel, content: text }),
        })
        ergebnis.set(ziel, antwort.ok ? { ok: true } : { ok: false, fehler: `HTTP ${antwort.status}` })
      }
    } catch (fehler) {
      ergebnis.set(ziel, { ok: false, fehler: (fehler as Error).message })
    }
  }
  return ergebnis
}

// ---------- Microsoft Teams: Karte in den Kanal ----------

export interface TeamsKarte {
  titel: string
  text: string
  fakten?: { name: string; wert: string }[]
  /** attention (Alarm), good (Entwarnung), default */
  farbe?: 'attention' | 'good' | 'default'
  linkTitel?: string
  linkUrl?: string
}

/** Adaptive-Card-Umschlag – wird von Incoming Webhooks und Teams-Workflows angenommen */
export function baueTeamsNachricht(karte: TeamsKarte): unknown {
  const body: unknown[] = [
    { type: 'TextBlock', size: 'Large', weight: 'Bolder', color: karte.farbe ?? 'default', text: karte.titel, wrap: true },
    { type: 'TextBlock', text: karte.text, wrap: true },
  ]
  if (karte.fakten?.length) {
    body.push({ type: 'FactSet', facts: karte.fakten.map((f) => ({ title: f.name, value: f.wert })) })
  }
  const actions = karte.linkUrl ? [{ type: 'Action.OpenUrl', title: karte.linkTitel ?? 'Öffnen', url: karte.linkUrl }] : undefined
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          msteams: { width: 'Full' },
          body,
          ...(actions ? { actions } : {}),
        },
      },
    ],
  }
}

export async function sendeTeamsKarte(teams: TeamsSettings, karte: TeamsKarte): Promise<SmsErgebnis> {
  if (!teams.webhookUrl) return { ok: false, fehler: 'Keine Kanal-Webhook-URL hinterlegt.' }
  try {
    const antwort = await fetch(teams.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baueTeamsNachricht(karte)),
    })
    return antwort.ok || antwort.status === 202
      ? { ok: true }
      : { ok: false, fehler: `HTTP ${antwort.status}` }
  } catch (fehler) {
    return { ok: false, fehler: (fehler as Error).message }
  }
}

// ---------- Microsoft Graph: Sprachanruf und Telefonkonferenz ----------

const GRAPH = 'https://graph.microsoft.com/v1.0'

/** Zugriffstoken über die App-Registrierung (Client Credentials) */
export async function graphToken(tel: TelephonySettings): Promise<string> {
  const antwort = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tel.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: tel.clientId,
      client_secret: tel.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  })
  const daten = (await antwort.json().catch(() => null)) as { access_token?: string; error_description?: string } | null
  if (!antwort.ok || !daten?.access_token) {
    throw new Error(daten?.error_description?.split('\n')[0] ?? `Anmeldung bei Microsoft fehlgeschlagen (HTTP ${antwort.status}).`)
  }
  return daten.access_token
}

export interface KonferenzInfo {
  joinUrl: string
  /** Einwahlnummer und Konferenz-ID, sofern der Mandant Audiokonferenzen lizenziert hat */
  einwahl?: string
}

/** Telefonkonferenz: Teams-Besprechung im Namen des Organisators anlegen */
export async function erstelleKonferenz(tel: TelephonySettings, betreff: string): Promise<KonferenzInfo> {
  const token = await graphToken(tel)
  const jetzt = new Date()
  const antwort = await fetch(`${GRAPH}/users/${encodeURIComponent(tel.organizerEmail)}/onlineMeetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      subject: betreff,
      startDateTime: jetzt.toISOString(),
      endDateTime: new Date(jetzt.getTime() + 4 * 3600_000).toISOString(),
    }),
  })
  const daten = (await antwort.json().catch(() => null)) as {
    joinWebUrl?: string
    audioConferencing?: { tollNumber?: string; conferenceId?: string }
    error?: { message?: string }
  } | null
  if (!antwort.ok || !daten?.joinWebUrl) {
    throw new Error(daten?.error?.message ?? `Besprechung konnte nicht angelegt werden (HTTP ${antwort.status}).`)
  }
  const audio = daten.audioConferencing
  return {
    joinUrl: daten.joinWebUrl,
    einwahl: audio?.tollNumber && audio.conferenceId ? `${audio.tollNumber}, Konferenz-ID ${audio.conferenceId}` : undefined,
  }
}

/** Teams-Konto einer Person über die E-Mail-Adresse auflösen */
async function graphBenutzerId(token: string, email: string): Promise<string | null> {
  const antwort = await fetch(`${GRAPH}/users/${encodeURIComponent(email)}?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!antwort.ok) return null
  const daten = (await antwort.json().catch(() => null)) as { id?: string } | null
  return daten?.id ?? null
}

/** Rückruf-Adresse für die Graph-Anrufschnittstelle – öffentlich erreichbare Serveradresse */
export function graphCallbackUrl(): string {
  const basis = (process.env.SOBE_PUBLIC_URL ?? '').replace(/\/+$/, '')
  return `${basis || 'https://sobe-notfall.invalid'}/api/graph/callback`
}

/**
 * Sprachanruf: Die Person klingelt in Teams (Handy, Desktop, Web) an. Rückgabe
 * pro E-Mail-Adresse, damit der Zustellstatus je Person geführt werden kann.
 */
export async function starteAnrufe(tel: TelephonySettings, emails: string[], betreff: string): Promise<Map<string, SmsErgebnis>> {
  const ergebnis = new Map<string, SmsErgebnis>()
  let token: string
  try {
    token = await graphToken(tel)
  } catch (fehler) {
    for (const e of emails) ergebnis.set(e, { ok: false, fehler: (fehler as Error).message })
    return ergebnis
  }
  for (const email of emails) {
    const benutzerId = await graphBenutzerId(token, email)
    if (!benutzerId) {
      ergebnis.set(email, { ok: false, fehler: 'Kein Microsoft-Konto zu dieser E-Mail-Adresse.' })
      continue
    }
    try {
      const antwort = await fetch(`${GRAPH}/communications/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          '@odata.type': '#microsoft.graph.call',
          callbackUri: graphCallbackUrl(),
          subject: betreff,
          targets: [
            {
              '@odata.type': '#microsoft.graph.invitationParticipantInfo',
              identity: { '@odata.type': '#microsoft.graph.identitySet', user: { '@odata.type': '#microsoft.graph.identity', id: benutzerId } },
            },
          ],
          requestedModalities: ['audio'],
          mediaConfig: { '@odata.type': '#microsoft.graph.serviceHostedMediaConfig' },
        }),
      })
      if (antwort.ok || antwort.status === 201) {
        ergebnis.set(email, { ok: true })
      } else {
        const daten = (await antwort.json().catch(() => null)) as { error?: { message?: string } } | null
        ergebnis.set(email, { ok: false, fehler: daten?.error?.message ?? `HTTP ${antwort.status}` })
      }
    } catch (fehler) {
      ergebnis.set(email, { ok: false, fehler: (fehler as Error).message })
    }
  }
  return ergebnis
}

// ---------- LoRaWAN: Uplinks der Alarmknöpfe auswerten ----------

export interface LorawanEreignis {
  /** Gerätekennung (DevEUI oder Seriennummer), wie vom Netz gemeldet */
  geraet: string
  /** true: Knopf gedrückt – Alarm auslösen. false: Statusmeldung (Batterie, Lebenszeichen). */
  alarm: boolean
  batteryPct?: number
  gps?: { lat: number; lng: number }
  /**
   * Der Uplink brachte nur rohe Bytes, keine übersetzte Nutzlast.
   *
   * Ohne Payload-Decoder im Netzserver kann kein Knopfdruck erkannt werden –
   * das Gerät meldet sich, aber der Alarm bleibt aus. Für einen Alarmknopf ist
   * das der gefährlichste denkbare Zustand, deshalb wird er ausdrücklich
   * gemeldet statt stillschweigend als Statusmeldung verbucht.
   */
  ohneDecoder?: boolean
  /** Rohe Nutzlast, wie der Netzserver sie schickt – Base64 oder Hex */
  daten?: string
  /** LoRaWAN-Port; viele Geräte unterscheiden daran die Art der Meldung */
  fPort?: number
  /**
   * Namen der übersetzten Felder. Nur für die Inbetriebnahme: Daran ist zu
   * sehen, ob der Payload-Decoder greift und wie er den Knopfdruck nennt.
   */
  felder?: string[]
}

// ---------- Inbetriebnahme: die letzten Uplinks nachvollziehen ----------

export type UplinkErgebnis =
  | 'alarm' | 'zusammengefasst' | 'status' | 'unbekanntes-geraet' | 'ohne-decoder'
  | 'nicht-verstanden' | 'token-falsch'

export interface UplinkSpur {
  ts: number
  /** Gerätekennung, wie der Server sie gelesen hat */
  geraet?: string
  ergebnis: UplinkErgebnis
  /** Name des zugeordneten Alarmknopfs, sofern gefunden */
  knopf?: string
  /** Namen der übersetzten Felder – zeigt, ob der Payload-Decoder greift */
  felder?: string[]
  batteryPct?: number
}

/**
 * Die letzten Uplinks – bewusst nur im Arbeitsspeicher.
 *
 * Beim Einrichten ist die wichtigste Frage «kommt überhaupt etwas an?», und
 * ein abgewiesener Uplink hinterliess bisher nirgends eine Spur. Was dauerhaft
 * festgehalten gehört, steht im Ereignisprotokoll; diese Liste ist eine
 * Sichthilfe und darf mit dem Server verschwinden.
 */
const SPUR_MAX = 25
const spur: UplinkSpur[] = []

export function merkeUplink(eintrag: Omit<UplinkSpur, 'ts'>): void {
  spur.unshift({ ts: Date.now(), ...eintrag })
  if (spur.length > SPUR_MAX) spur.length = SPUR_MAX
}

export function letzteUplinks(): UplinkSpur[] {
  return [...spur]
}

/**
 * Feld case-insensitiv nachschlagen. Die Netzserver schreiben dieselbe Sache
 * unterschiedlich: «devEUI» bei ChirpStack v3, «devEui» bei v4.
 */
function ausFeldern(b: Record<string, unknown>, ...namen: string[]): unknown {
  for (const name of namen) if (b[name] !== undefined) return b[name]
  const klein = new Map(Object.keys(b).map((k) => [k.toLowerCase(), k]))
  for (const name of namen) {
    const treffer = klein.get(name.toLowerCase())
    if (treffer !== undefined) return b[treffer]
  }
  return undefined
}

/**
 * Gerätekennung vereinheitlichen.
 *
 * Je nach Netzserver und Einstellung kommt die DevEUI als Hex-Zeichenkette
 * oder Base64-kodiert an; im Portal steht sie als Hex auf dem Gerät. Acht Byte
 * Base64 werden deshalb zu Hex aufgelöst, sonst fände der Server den Knopf nicht.
 */
function alsGeraetekennung(wert: unknown): string {
  const text = String(wert ?? '').trim()
  if (/^[0-9a-fA-F]{16}$/.test(text)) return text.toUpperCase()
  if (/^[A-Za-z0-9+/]{11}=$/.test(text)) {
    const roh = Buffer.from(text, 'base64')
    if (roh.length === 8) return roh.toString('hex').toUpperCase()
  }
  return text
}

/** Seriennummern vergleichbar machen: Gross-/Kleinschreibung und Trennzeichen sind egal */
export function normierteSerie(wert: string): string {
  return wert.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Zellspannung einer Lithium-Zelle, aus der die Prozentangabe geschätzt wird */
const ZELLE_LEER_V = 3.0
const ZELLE_VOLL_V = 4.2

/**
 * Batterieangabe vereinheitlichen.
 *
 * Die Geräte melden höchst unterschiedlich: Prozent, Anteil zwischen 0 und 1,
 * Zellspannung in Volt oder in Millivolt. Dragino etwa nennt das Feld «BAT»
 * und meint Volt – ungeprüft übernommen stünde im Portal dauerhaft «4 %» und
 * damit eine Batteriewarnung, die nie verstummt. Eine Warnung, die immer
 * leuchtet, liest nach zwei Wochen niemand mehr; das ist schlimmer als keine.
 *
 * Die Schätzung aus der Spannung ist grob – die Entladekurve hängt an der
 * Zelle. Für die Frage «bald wechseln?» reicht sie, für eine Restlaufzeit nicht.
 */
function alsProzent(wert: unknown): number | undefined {
  const zahl = Number(wert)
  if (!Number.isFinite(zahl) || zahl < 0) return undefined

  // Millivolt einer Lithium-Zelle
  if (zahl >= 2000 && zahl <= 4500) return ausSpannung(zahl / 1000)
  // Volt einer Lithium-Zelle. Ganze Zahlen bleiben Prozent: «3» ist eher ein
  // Prozentwert als eine auf die Volt genau gemessene Spannung.
  if (zahl >= 2 && zahl <= 4.5 && !Number.isInteger(zahl)) return ausSpannung(zahl)
  // Anteile zwischen 0 und 1, alles darüber bereits Prozent
  const pct = zahl > 0 && zahl <= 1 ? zahl * 100 : zahl
  return pct <= 100 ? Math.round(pct) : undefined
}

/**
 * Zellspannung in Millivolt in einen Prozentwert schätzen – für die Modelle,
 * deren Nutzlast der Alarmserver selbst übersetzt.
 */
export function alsBatterieProzent(millivolt: number | undefined): number | undefined {
  return millivolt === undefined ? undefined : alsProzent(millivolt)
}

function ausSpannung(volt: number): number {
  const anteil = (volt - ZELLE_LEER_V) / (ZELLE_VOLL_V - ZELLE_LEER_V)
  return Math.round(Math.min(1, Math.max(0, anteil)) * 100)
}

/**
 * Ist dieser Uplink ein Knopfdruck?
 *
 * Jeder Hersteller nennt das Feld anders. Der Decoder im Netzserver
 * (TTN/ChirpStack) übersetzt die rohen Bytes, danach greift diese Erkennung.
 * Ein reiner Zustandswert wie `press_count` wird bewusst nicht gewertet: Er
 * steht auch in Statusmeldungen und löste sonst Fehlalarme aus.
 */
function istAlarmNutzlast(nutzlast: Record<string, unknown>): boolean {
  const wahr = (wert: unknown) =>
    wert === true || wert === 1 || wert === '1' ||
    (typeof wert === 'string' && wert.toLowerCase() === 'true')

  // Die Schreibweise ist Herstellersache: Dragino nennt das Feld «ALARM»,
  // andere «alarm» oder «Alarm». Für die Erkennung darf das nicht zählen.
  for (const schluessel of [
    'alarm', 'button', 'pressed', 'sos', 'panic', 'trigger',
    // Weitere gängige Schreibweisen: Milesight, Browan, Dragino, Adeunis
    'sos_alarm', 'emergency', 'alert', 'button_pressed', 'buttonPressed', 'press',
  ]) {
    if (wahr(ausFeldern(nutzlast, schluessel))) return true
  }

  // Ereignisfelder, teils mit Hersteller-Präfix («short_press», «SOS_ALARM»)
  const ereignisse = ['event', 'type', 'message_type', 'messageType', 'action', 'state']
    .map((feld) => String(ausFeldern(nutzlast, feld) ?? '').toLowerCase().trim())
    .filter(Boolean)
  const treffer = ['alarm', 'sos', 'button', 'panic', 'pressed', 'press', 'emergency', 'alert']
  return ereignisse.some((e) => treffer.some((t) => e === t || e.endsWith(`_${t}`) || e.startsWith(`${t}_`)))
}

function gpsAus(nutzlast: Record<string, unknown>): { lat: number; lng: number } | undefined {
  const lat = Number(nutzlast.latitude ?? nutzlast.lat)
  const lng = Number(nutzlast.longitude ?? nutzlast.lng ?? nutzlast.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined
}

/**
 * Trägt diese Meldung überhaupt eine Funknutzlast?
 *
 * Manche Gateways verlangen, dass für Beitritt, Quittung und Gerätezustand
 * dieselbe Adresse hinterlegt wird wie für die Uplinks – beim RAK WisGate
 * lässt sich die Anwendung sonst gar nicht speichern. An diesem Endpunkt
 * treffen dann Meldungen ein, die nie von einem Tastendruck stammen können.
 *
 * Ein Alarm darf nur aus einer echten Funknutzlast entstehen. Was weder
 * übersetzte noch rohe Daten mitbringt, gilt als Lebenszeichen – auch wenn im
 * Umschlag zufällig ein Feld steht, das nach Alarm klingt.
 */
function istFunkmeldung(b: Record<string, unknown>): boolean {
  return b.object !== undefined || b.data !== undefined
}

/** Batteriestand aus einer übersetzten Nutzlast, unter allen gängigen Namen */
function batterieAus(nutzlast: Record<string, unknown>): unknown {
  return ausFeldern(nutzlast, 'battery', 'batteryPct', 'battery_level', 'batteryLevel', 'bat', 'batV', 'battery_percent')
}

/**
 * Batteriestand aus einer Gerätestatus-Meldung des Netzservers.
 *
 * LoRaWAN kennt dafür einen eigenen Mechanismus: Der Netzserver fragt das Gerät
 * periodisch ab und meldet den Stand im Umschlag statt in der Nutzlast. Das ist
 * die einzige Batteriequelle, wenn das Gerät keinen Payload-Decoder hat – und
 * damit genau dann wertvoll, wenn sonst nichts zu holen wäre. Meldet das Gerät
 * «Stand nicht verfügbar», wird der Wert verworfen statt als 0 % gedeutet.
 */
function batterieAusStatus(b: Record<string, unknown>): unknown {
  if (ausFeldern(b, 'batteryLevelUnavailable', 'battery_level_unavailable') === true) return undefined
  return ausFeldern(b, 'batteryLevel', 'battery_level')
}

/**
 * Uplink eines LoRaWAN-Netzservers in ein einheitliches Ereignis übersetzen.
 *
 * Verstanden werden The Things Network (v3), ChirpStack v4, ChirpStack v3 –
 * das ist auch der in Gateways eingebaute Netzserver, etwa beim RAK WisGate –
 * und ein generisches JSON ({ serial | devEui, event, battery, lat, lng }).
 */
export function parseLorawanUplink(body: unknown): LorawanEreignis | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, any>

  // The Things Network v3
  if (b.end_device_ids?.dev_eui || b.end_device_ids?.device_id) {
    const nutzlast = (b.uplink_message?.decoded_payload ?? {}) as Record<string, unknown>
    return {
      geraet: alsGeraetekennung(b.end_device_ids.dev_eui ?? b.end_device_ids.device_id),
      alarm: b.uplink_message !== undefined && istAlarmNutzlast(nutzlast),
      batteryPct: alsProzent(batterieAus(nutzlast) ?? b.uplink_message?.last_battery_percentage?.value),
      gps: gpsAus(nutzlast),
      felder: Object.keys(nutzlast),
      daten: typeof b.uplink_message?.frm_payload === 'string' ? b.uplink_message.frm_payload : undefined,
      fPort: Number.isFinite(Number(b.uplink_message?.f_port)) ? Number(b.uplink_message.f_port) : undefined,
      ohneDecoder: Object.keys(nutzlast).length === 0 && Boolean(b.uplink_message?.frm_payload),
    }
  }

  // ChirpStack v4
  if (b.deviceInfo?.devEui) {
    const nutzlast = (b.object ?? {}) as Record<string, unknown>
    return {
      geraet: alsGeraetekennung(b.deviceInfo.devEui),
      alarm: istFunkmeldung(b) && istAlarmNutzlast(nutzlast),
      batteryPct: alsProzent(batterieAus(nutzlast) ?? batterieAusStatus(b)),
      gps: gpsAus(nutzlast),
      felder: Object.keys(nutzlast),
      daten: typeof b.data === 'string' ? b.data : undefined,
      fPort: Number.isFinite(Number(b.fPort ?? b.fport)) ? Number(b.fPort ?? b.fport) : undefined,
      ohneDecoder: Object.keys(nutzlast).length === 0 && Boolean(b.data),
    }
  }

  // ChirpStack v3 und die in Gateways eingebauten Netzserver. Erkennbar an der
  // DevEUI auf oberster Ebene zusammen mit einem der Felder, die nur ein
  // Netzserver mitschickt – sonst wäre jedes generische JSON gemeint.
  const v3 = ausFeldern(b, 'devEUI', 'devEui', 'deveui')
  if (v3 !== undefined && (b.object !== undefined || b.rxInfo !== undefined || b.applicationID !== undefined)) {
    const nutzlast = (b.object ?? {}) as Record<string, unknown>
    return {
      geraet: alsGeraetekennung(v3),
      alarm: istFunkmeldung(b) && istAlarmNutzlast(nutzlast),
      batteryPct: alsProzent(batterieAus(nutzlast) ?? batterieAusStatus(b)),
      gps: gpsAus(nutzlast),
      felder: Object.keys(nutzlast),
      daten: typeof b.data === 'string' ? b.data : undefined,
      fPort: Number.isFinite(Number(b.fPort ?? b.fport)) ? Number(b.fPort ?? b.fport) : undefined,
      ohneDecoder: Object.keys(nutzlast).length === 0 && Boolean(b.data),
    }
  }

  // Generisches JSON (GSM-Knöpfe, eigene Bridges)
  const geraet = ausFeldern(b, 'serial', 'devEui', 'devEUI', 'deviceId', 'device')
  if (geraet !== undefined && String(geraet).trim()) {
    return {
      geraet: alsGeraetekennung(geraet),
      alarm: istAlarmNutzlast(b),
      batteryPct: alsProzent(batterieAus(b)),
      gps: gpsAus(b),
      felder: Object.keys(b),
    }
  }
  return null
}

/**
 * Token aus der Anfrage lesen: Authorization-Kopfzeile oder ?token=.
 *
 * Das «Bearer » davor ist geduldet, aber nicht verlangt. Manche Gateways lassen
 * im Kopfzeilen-Wert kein Leerzeichen zu – dort lässt sich nur das nackte Token
 * eintragen. Es deswegen abzuweisen hiesse, die Einrichtung in die Adresszeile
 * zu drängen, wo das Token in Protokolldateien landet.
 */
export function lorawanTokenAusRequest(authHeader: string | undefined, queryToken: string | undefined): string {
  const kopf = authHeader?.trim() ?? ''
  if (kopf) {
    const ohnePraefix = /^bearer\s+/i.test(kopf) ? kopf.replace(/^bearer\s+/i, '') : kopf
    if (ohnePraefix.trim()) return ohnePraefix.trim()
  }
  return queryToken?.trim() ?? ''
}

export function lorawanTokenGueltig(lorawan: LorawanSettings, token: string): boolean {
  return Boolean(lorawan.token) && token === lorawan.token
}
