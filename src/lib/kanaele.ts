import type { Channel, IntegrationSettings } from '../types'

/** Kurzer Name für Abzeichen und Chips */
export const KANAL_KURZ: Record<Channel, string> = {
  push: 'Push',
  sms: 'SMS',
  email: 'E-Mail',
  voice: 'Sprachanruf',
  conference: 'Telefonkonferenz',
  tts: 'Durchsage',
  teams: 'Teams',
}

export type KanalZustand = 'aktiv' | 'nicht eingerichtet' | 'vorbereitet'

/**
 * Wird über diesen Kanal heute wirklich zugestellt?
 *
 * Push geht immer. SMS, Teams, Sprachanruf und Konferenz sind im Server
 * umgesetzt, brauchen aber die passende Integration – ohne sie wählt man den
 * Kanal im Plan und es passiert nichts. E-Mail und Durchsage gibt es bisher
 * nur in der Planung. Das gehört dorthin, wo der Kanal gewählt wird: Wer einen
 * Alarmplan schreibt, muss sehen, was davon ankommt.
 */
export function kanalZustand(c: Channel, integ: IntegrationSettings | undefined): KanalZustand {
  if (c === 'push') return 'aktiv'
  if (c === 'email' || c === 'tts') return 'vorbereitet'
  if (!integ) return 'nicht eingerichtet'
  if (c === 'sms') return integ.smsGateway.enabled ? 'aktiv' : 'nicht eingerichtet'
  if (c === 'teams') return integ.teams.enabled ? 'aktiv' : 'nicht eingerichtet'
  return integ.telephony.enabled ? 'aktiv' : 'nicht eingerichtet'
}

/** Kurzer Hinweis, was mit diesem Kanal passiert – für Titel und Nebentexte */
export function kanalHinweis(c: Channel, integ: IntegrationSettings | undefined): string {
  switch (kanalZustand(c, integ)) {
    case 'aktiv':
      return `${KANAL_KURZ[c]}: wird zugestellt`
    case 'nicht eingerichtet':
      return `${KANAL_KURZ[c]}: unter Einstellungen & Konfiguration nicht eingerichtet – es wird nichts versendet`
    default:
      return `${KANAL_KURZ[c]}: vorbereitet, noch nicht umgesetzt`
  }
}
