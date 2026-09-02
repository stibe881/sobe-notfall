import { randomBytes } from 'node:crypto'
import { getSetting, setSetting } from './db.js'
import type { IntegrationSettings, LorawanSettings, SmsGatewaySettings, TeamsSettings, TelephonySettings } from './types.js'

/**
 * Grundlagen der Integrationen: Vorgaben, Geheimnis-Maskierung und die reinen
 * Bausteine (SMS-Anbieter, Teams-Karten, LoRaWAN-Auswertung). Der eigentliche
 * Versand entlang eines Alarms steht in kanaele.ts.
 */

export const INTEGRATION_VORGABEN: IntegrationSettings = {
  smsGateway: { enabled: false, provider: 'ecall', senderId: 'SONNENBERG', username: '', password: '', httpUrl: '', sentCount: 0 },
  telephony: { enabled: false, tenantId: '', clientId: '', clientSecret: '', organizerEmail: '' },
  teams: { enabled: false, tenant: '', webhookUrl: '' },
  lorawan: { enabled: false, provider: 'ttn', token: '' },
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
}

/** Seriennummern vergleichbar machen: Gross-/Kleinschreibung und Trennzeichen sind egal */
export function normierteSerie(wert: string): string {
  return wert.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function alsProzent(wert: unknown): number | undefined {
  const zahl = Number(wert)
  if (!Number.isFinite(zahl) || zahl < 0) return undefined
  // Werte zwischen 0 und 1 sind Anteile, alles darüber bereits Prozent
  const pct = zahl > 0 && zahl <= 1 ? zahl * 100 : zahl
  return pct <= 100 ? Math.round(pct) : undefined
}

function istAlarmNutzlast(nutzlast: Record<string, unknown>): boolean {
  for (const schluessel of ['alarm', 'button', 'pressed', 'sos', 'panic', 'trigger']) {
    const wert = nutzlast[schluessel]
    if (wert === true || wert === 1 || wert === '1' || wert === 'true') return true
  }
  const ereignis = String(nutzlast.event ?? nutzlast.type ?? '').toLowerCase()
  return ['alarm', 'sos', 'button', 'panic', 'pressed'].includes(ereignis)
}

function gpsAus(nutzlast: Record<string, unknown>): { lat: number; lng: number } | undefined {
  const lat = Number(nutzlast.latitude ?? nutzlast.lat)
  const lng = Number(nutzlast.longitude ?? nutzlast.lng ?? nutzlast.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined
}

/**
 * Uplink eines LoRaWAN-Netzservers in ein einheitliches Ereignis übersetzen.
 * Verstanden werden The Things Network (v3), ChirpStack (v4) und ein
 * generisches JSON ({ serial | devEui, event, battery, lat, lng }).
 */
export function parseLorawanUplink(body: unknown): LorawanEreignis | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, any>

  // The Things Network v3
  if (b.end_device_ids?.dev_eui || b.end_device_ids?.device_id) {
    const nutzlast = (b.uplink_message?.decoded_payload ?? {}) as Record<string, unknown>
    return {
      geraet: String(b.end_device_ids.dev_eui ?? b.end_device_ids.device_id),
      alarm: istAlarmNutzlast(nutzlast),
      batteryPct: alsProzent(nutzlast.battery ?? nutzlast.batteryPct ?? nutzlast.battery_level ?? b.uplink_message?.last_battery_percentage?.value),
      gps: gpsAus(nutzlast),
    }
  }

  // ChirpStack v4
  if (b.deviceInfo?.devEui) {
    const nutzlast = (b.object ?? {}) as Record<string, unknown>
    return {
      geraet: String(b.deviceInfo.devEui),
      alarm: istAlarmNutzlast(nutzlast),
      batteryPct: alsProzent(nutzlast.battery ?? nutzlast.batteryPct ?? nutzlast.battery_level),
      gps: gpsAus(nutzlast),
    }
  }

  // Generisches JSON (GSM-Knöpfe, eigene Bridges)
  const geraet = b.serial ?? b.devEui ?? b.deviceId ?? b.device
  if (geraet) {
    return {
      geraet: String(geraet),
      alarm: istAlarmNutzlast(b),
      batteryPct: alsProzent(b.battery ?? b.batteryPct ?? b.battery_level),
      gps: gpsAus(b),
    }
  }
  return null
}

/** Token-Prüfung für den Uplink-Endpunkt: Authorization-Kopf oder ?token= */
export function lorawanTokenAusRequest(authHeader: string | undefined, queryToken: string | undefined): string {
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return queryToken ?? ''
}

export function lorawanTokenGueltig(lorawan: LorawanSettings, token: string): boolean {
  return Boolean(lorawan.token) && token === lorawan.token
}
