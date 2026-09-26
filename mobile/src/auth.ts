import type { User } from './types'
import { sha256Hex } from './lib/sha256'

/**
 * Anmeldung mit E-Mail und Passwort.
 *
 * Diese Datei ist die einzige Stelle, an der Anmeldedaten geprüft werden. Wird später
 * SSO (Microsoft Entra ID / SAML) oder ein eigenes Backend angebunden, muss nur
 * `authenticate()` gegen den Identity-Provider bzw. die API ausgetauscht werden –
 * der übrige Code kennt nur das Ergebnis (AuthResult).
 *
 * Hinweis zur Sicherheit: Ohne Server werden die Passwort-Hashes lokal im Gerät
 * gespeichert (localStorage / AsyncStorage). Das schützt vor Mitlesen im Klartext und
 * vor fremdem Zugriff auf ein unbeaufsichtigtes Gerät, ersetzt aber keine
 * serverseitige Authentifizierung.
 */

/** Fester Zusatzwert, damit gleiche Passwörter nicht am Hash erkennbar sind */
const PEPPER = 'sobe-notfall-v1'

/** Mindestlänge für neue Passwörter */
export const MIN_PASSWORD_LENGTH = 8

export function randomSalt(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

export function hashPassword(password: string, salt: string): string {
  return sha256Hex(`${salt}:${PEPPER}:${password}`)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Neues Passwort auf Mindestanforderungen prüfen – Rückgabe: Fehlertext oder null */
/** Zwölf Zeichen für Administration und Krisenstab – dieselbe Regel wie auf dem Server */
export const MIN_PASSWORD_LENGTH_FUEHRUNG = 12

export function passwordProblem(password: string, rolle?: string): string | null {
  const mindest = rolle === 'admin' || rolle === 'krisenstab' ? MIN_PASSWORD_LENGTH_FUEHRUNG : MIN_PASSWORD_LENGTH
  if (password.length < mindest) {
    return `Das Passwort muss mindestens ${mindest} Zeichen lang sein${mindest > MIN_PASSWORD_LENGTH ? ' – für Administration und Krisenstab gilt die längere Regel' : ''}.`
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password)) return 'Das Passwort muss mindestens einen Buchstaben enthalten.'
  if (!/[0-9]/.test(password)) return 'Das Passwort muss mindestens eine Ziffer enthalten.'
  return null
}

/**
 * Ist für dieses Konto ein Passwort hinterlegt?
 *
 * Die Konten kommen vom Alarmserver, der die Hashes bewusst nicht mitschickt
 * und stattdessen das Kennzeichen hasPassword setzt.
 */
export function hasPassword(user: User): boolean {
  if (typeof user.hasPassword === 'boolean') return user.hasPassword
  return Boolean(user.passwordHash && user.passwordSalt)
}

export function verifyPassword(user: User, password: string): boolean {
  if (!hasPassword(user)) return false
  return hashPassword(password, user.passwordSalt!) === user.passwordHash
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

/** Anmeldedaten prüfen – hier später gegen Backend/SSO austauschen */
export function authenticate(users: User[], email: string, password: string): AuthResult {
  const target = normalizeEmail(email)
  if (!target) return { ok: false, error: 'Bitte E-Mail-Adresse eingeben.' }
  if (!password) return { ok: false, error: 'Bitte Passwort eingeben.' }

  const user = users.find((u) => normalizeEmail(u.email) === target)
  // Bewusst dieselbe Meldung für unbekannte Adresse und falsches Passwort,
  // damit sich keine gültigen Konten erraten lassen
  if (!user) return { ok: false, error: 'E-Mail-Adresse oder Passwort ist falsch.' }
  if (!hasPassword(user)) {
    return { ok: false, error: 'Für dieses Konto ist noch kein Passwort gesetzt. Bitte an die Administration wenden.' }
  }
  if (!verifyPassword(user, password)) return { ok: false, error: 'E-Mail-Adresse oder Passwort ist falsch.' }

  return { ok: true, user }
}

/** Passwort-Felder für einen Benutzer erzeugen */
export function withPassword(user: User, password: string, mustChange = false): User {
  const salt = randomSalt()
  return { ...user, passwordSalt: salt, passwordHash: hashPassword(password, salt), mustChangePassword: mustChange }
}
