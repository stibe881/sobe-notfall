import { fetchMitFrist } from './netz.js'
import type { SmsGatewaySettings } from './types.js'

/**
 * Twilio als SMS- und Anrufanbieter.
 *
 * Zwei Dinge unterscheiden Twilio von eCall und ASPSMS:
 *  - Es verlangt Nummern im internationalen Format (E.164, «+41791234567»).
 *    Im Bestand stehen sie meist schweizerisch («079 123 45 67»); ohne
 *    Umschreibung schlüge jeder Versand fehl.
 *  - Es kann Sprachanrufe führen. Damit wird der Kanal «Sprachanruf», den die
 *    Alarmpläne längst vorsehen, ohne Teams-Telefonie lebendig: Der Anruf
 *    liest den Alarmtext zweimal vor.
 *
 * Zugangsdaten: username = Account SID, password = Auth Token,
 * senderId = eigene Twilio-Nummer (+41…) oder ein alphanumerischer Absender.
 */

const BASIS = 'https://api.twilio.com/2010-04-01/Accounts'

/** Schweizer und internationale Schreibweisen nach E.164 – Twilio nimmt nichts anderes */
export function alsE164(nummer: string, landesvorwahl = '+41'): string {
  const roh = nummer.replace(/[^\d+]/g, '')
  if (roh.startsWith('+')) return roh
  if (roh.startsWith('00')) return '+' + roh.slice(2)
  if (roh.startsWith('0')) return landesvorwahl + roh.slice(1)
  return roh ? landesvorwahl + roh : roh
}

function xmlSicher(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function twilioKopf(sid: string, token: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

/** Anfrage für eine SMS – ohne Netz, damit sie prüfbar ist */
export function twilioSmsAnfrage(sid: string, absender: string, ziel: string, text: string): { url: string; body: string } {
  const body = new URLSearchParams({ To: alsE164(ziel), From: absender.startsWith('+') ? alsE164(absender) : absender, Body: text })
  return { url: `${BASIS}/${encodeURIComponent(sid)}/Messages.json`, body: body.toString() }
}

/**
 * Anfrage für einen Anruf: Twilio liest den Text vor. Zweimal, mit Pause –
 * wer abnimmt, verpasst die ersten Worte, und ein Alarm darf nicht am
 * ersten Halbsatz scheitern. Ein alphanumerischer Absender geht bei Anrufen
 * nicht; ohne echte Nummer als Absender scheitert der Anruf.
 */
export function twilioAnrufAnfrage(sid: string, absender: string, ziel: string, text: string): { url: string; body: string } {
  const gesagt = xmlSicher(text)
  const twiml =
    `<Response><Say language="de-DE">${gesagt}</Say><Pause length="1"/>` +
    `<Say language="de-DE">Ich wiederhole: ${gesagt}</Say></Response>`
  const body = new URLSearchParams({ To: alsE164(ziel), From: alsE164(absender), Twiml: twiml })
  return { url: `${BASIS}/${encodeURIComponent(sid)}/Calls.json`, body: body.toString() }
}

export interface TwilioErgebnis { ok: boolean; fehler?: string }

async function twilioAufruf(sms: SmsGatewaySettings, anfrage: { url: string; body: string }): Promise<TwilioErgebnis> {
  try {
    const antwort = await fetchMitFrist(anfrage.url, { method: 'POST', headers: twilioKopf(sms.username, sms.password), body: anfrage.body }, 10_000)
    const daten = (await antwort.json().catch(() => null)) as { sid?: string; status?: string; code?: number; message?: string } | null
    if (antwort.ok && daten?.sid) return { ok: true }
    return { ok: false, fehler: daten?.message ? `Twilio ${daten.code ?? antwort.status}: ${daten.message}` : `HTTP ${antwort.status}` }
  } catch (fehler) {
    return { ok: false, fehler: (fehler as Error).message }
  }
}

export async function sendeTwilioSms(sms: SmsGatewaySettings, ziele: string[], text: string): Promise<Map<string, TwilioErgebnis>> {
  const ergebnis = new Map<string, TwilioErgebnis>()
  for (const ziel of ziele) ergebnis.set(ziel, await twilioAufruf(sms, twilioSmsAnfrage(sms.username, sms.senderId || 'SOBE', ziel, text)))
  return ergebnis
}

export async function starteTwilioAnrufe(sms: SmsGatewaySettings, nummern: string[], text: string): Promise<Map<string, TwilioErgebnis>> {
  const ergebnis = new Map<string, TwilioErgebnis>()
  if (!sms.senderId.startsWith('+')) {
    for (const n of nummern) ergebnis.set(n, { ok: false, fehler: 'Für Anrufe braucht Twilio eine eigene Nummer als Absender (+41…), kein Kurzname.' })
    return ergebnis
  }
  for (const n of nummern) ergebnis.set(n, await twilioAufruf(sms, twilioAnrufAnfrage(sms.username, sms.senderId, n, text)))
  return ergebnis
}

/** Ist Twilio so eingerichtet, dass es Anrufe führen kann? */
export function twilioKannAnrufen(sms: SmsGatewaySettings): boolean {
  return sms.enabled && sms.provider === 'twilio' && Boolean(sms.username && sms.password) && sms.senderId.startsWith('+')
}
