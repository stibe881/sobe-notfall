import { createHash, randomBytes } from 'node:crypto'
import type { Role, SsoSettings } from './types.js'

/**
 * Single Sign-On über Microsoft Entra ID (OpenID Connect, Authorization Code
 * mit PKCE). Der Server ist ein vertraulicher Client: Er tauscht den Code
 * selbst mit seinem Geheimnis direkt beim Token-Endpunkt von Microsoft – das
 * ID-Token kommt damit über TLS aus erster Hand und nie über den Browser.
 */

const LOGIN = 'https://login.microsoftonline.com'

export function ssoKonfiguriert(sso: SsoSettings): boolean {
  return sso.enabled && Boolean(sso.tenantId && sso.clientId && sso.clientSecret)
}

// ---------- Laufende Anmeldevorgänge ----------

interface Vorgang {
  verifier: string
  target: 'web' | 'app'
  createdAt: number
}

/** Offene Anmeldevorgänge, kurzlebig und nur im Arbeitsspeicher */
const vorgaenge = new Map<string, Vorgang>()
const VORGANG_GILT_MS = 10 * 60_000

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function aufraeumen(): void {
  const jetzt = Date.now()
  for (const [state, v] of vorgaenge) if (jetzt - v.createdAt > VORGANG_GILT_MS) vorgaenge.delete(state)
}

/** Anmeldung beginnen: Weiterleitungsadresse zu Microsoft aufbauen */
export function ssoStartUrl(sso: SsoSettings, callbackUrl: string, target: 'web' | 'app'): string {
  aufraeumen()
  const state = base64url(randomBytes(24))
  const verifier = base64url(randomBytes(48))
  vorgaenge.set(state, { verifier, target, createdAt: Date.now() })

  const params = new URLSearchParams({
    client_id: sso.clientId,
    response_type: 'code',
    redirect_uri: callbackUrl,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    code_challenge: base64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
  })
  return `${LOGIN}/${encodeURIComponent(sso.tenantId)}/oauth2/v2.0/authorize?${params.toString()}`
}

/** Abbruch durch Microsoft oder die Person: Ziel des Vorgangs auflösen und ihn schliessen */
export function ssoAbbruch(state: string): 'web' | 'app' {
  const vorgang = vorgaenge.get(state)
  vorgaenge.delete(state)
  return vorgang?.target ?? 'web'
}

// ---------- Rückkehr von Microsoft ----------

export interface SsoErgebnis {
  target: 'web' | 'app'
  email: string
  firstName: string
  lastName: string
  groups: string[]
}

function dekodiereIdToken(idToken: string): Record<string, unknown> | null {
  const teile = idToken.split('.')
  if (teile.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(teile[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Code gegen ein ID-Token tauschen und die Person daraus lesen.
 * Wirft mit einer verständlichen Meldung, wenn etwas nicht stimmt.
 */
export async function ssoCallback(sso: SsoSettings, callbackUrl: string, code: string, state: string): Promise<SsoErgebnis> {
  const vorgang = vorgaenge.get(state)
  vorgaenge.delete(state)
  if (!vorgang || Date.now() - vorgang.createdAt > VORGANG_GILT_MS) {
    throw new Error('Die Anmeldung ist abgelaufen – bitte erneut mit Microsoft anmelden.')
  }

  const antwort = await fetch(`${LOGIN}/${encodeURIComponent(sso.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: sso.clientId,
      client_secret: sso.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      code_verifier: vorgang.verifier,
    }).toString(),
  })
  const daten = (await antwort.json().catch(() => null)) as { id_token?: string; error_description?: string } | null
  if (!antwort.ok || !daten?.id_token) {
    throw new Error(daten?.error_description?.split('\n')[0] ?? `Microsoft hat die Anmeldung abgelehnt (HTTP ${antwort.status}).`)
  }

  const anspruch = dekodiereIdToken(daten.id_token)
  if (!anspruch) throw new Error('Antwort von Microsoft nicht lesbar.')
  // Das Token stammt direkt aus dem Token-Endpunkt (TLS, Client-Geheimnis) –
  // die Ansprüche werden trotzdem gegen die eigene Konfiguration geprüft
  const jetzt = Math.floor(Date.now() / 1000)
  if (anspruch.aud !== sso.clientId) throw new Error('Das Token gehört zu einer anderen Anwendung.')
  if (typeof anspruch.exp === 'number' && anspruch.exp < jetzt) throw new Error('Das Token ist abgelaufen.')
  const tid = String(anspruch.tid ?? '')
  if (tid && sso.tenantId.includes('-') && tid !== sso.tenantId) throw new Error('Das Token stammt aus einem fremden Mandanten.')

  const email = String(anspruch.email ?? anspruch.preferred_username ?? anspruch.upn ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) throw new Error('Microsoft hat keine E-Mail-Adresse mitgeliefert.')
  const name = String(anspruch.name ?? '')
  const firstName = String(anspruch.given_name ?? name.split(' ')[0] ?? '').trim() || 'Unbekannt'
  const lastName = String(anspruch.family_name ?? name.split(' ').slice(1).join(' ') ?? '').trim() || email.split('@')[0]
  const groups = Array.isArray(anspruch.groups) ? anspruch.groups.map(String) : []

  return { target: vorgang.target, email, firstName, lastName, groups }
}

/**
 * Rolle aus den Entra-Gruppen. null: keine Gruppenzuordnung konfiguriert –
 * bestehende Rollen bleiben dann unangetastet.
 */
export function rolleAusGruppen(sso: SsoSettings, groups: string[]): Role | null {
  if (!sso.adminGroupId && !sso.krisenstabGroupId) return null
  if (sso.adminGroupId && groups.includes(sso.adminGroupId)) return 'admin'
  if (sso.krisenstabGroupId && groups.includes(sso.krisenstabGroupId)) return 'krisenstab'
  return 'mitarbeiter'
}

/** Verbindungstest: Mandant erreichbar und Geheimnis gültig? */
export async function ssoTest(sso: SsoSettings): Promise<void> {
  const entdeckung = await fetch(`${LOGIN}/${encodeURIComponent(sso.tenantId)}/v2.0/.well-known/openid-configuration`)
  if (!entdeckung.ok) throw new Error(`Mandant «${sso.tenantId}» bei Microsoft nicht gefunden (HTTP ${entdeckung.status}).`)
  const antwort = await fetch(`${LOGIN}/${encodeURIComponent(sso.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: sso.clientId,
      client_secret: sso.clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }).toString(),
  })
  if (!antwort.ok) {
    const daten = (await antwort.json().catch(() => null)) as { error_description?: string } | null
    throw new Error(daten?.error_description?.split('\n')[0] ?? `Anwendungs-ID oder Geheimnis stimmen nicht (HTTP ${antwort.status}).`)
  }
}
