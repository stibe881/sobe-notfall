import { db, getSetting, setSetting } from './db.js'
import { hashPassword, newSalt } from './auth.js'
import { INTEGRATION_VORGABEN } from './integrationen.js'
import {
  SCENARIO_CONTENT_VERSION, SEED_CONTACTS, SEED_GROUPS, SEED_LOCATIONS, SEED_PLANS, SEED_SCENARIOS,
} from './seed.js'
import { allStoredUsers, integrations, saveIntegrations, upsertDoc, upsertGroup, upsertLocation, upsertUser, addAudit } from './store.js'
import type { IntegrationSettings, StoredUser } from './types.js'

/** Erstpasswort des Administrators; muss bei der ersten Anmeldung geändert werden */
export const INITIAL_ADMIN_PASSWORD = process.env.SOBE_ADMIN_PASSWORD ?? 'SOBE-Start2026!'
export const INITIAL_ADMIN_EMAIL = process.env.SOBE_ADMIN_EMAIL ?? 'stefan.gross@sonnenberg-baar.ch'

/** Interne Notfallnummer des Kompetenzzentrums – in den Integrationen änderbar */
export const NOTFALLNUMMER = '+41 41 767 49 48'
/** Platzhalter aus früheren Versionen, der beim Start ersetzt wird */
const ALTE_PLATZHALTER = ['', '+41 41 000 11 22']

const LEER_INTEGRATIONEN: IntegrationSettings = {
  ...INTEGRATION_VORGABEN,
  hotline: { enabled: true, number: NOTFALLNUMMER },
}

/**
 * Erstbefüllung und Inhalts-Aktualisierungen.
 * Stammdaten (Standorte, Gruppen, Alarmpläne, Notrufnummern) werden nur angelegt,
 * wenn sie fehlen – bestehende Anpassungen bleiben erhalten. Standard-Szenarien
 * werden bei einer neuen Inhaltsversion aktualisiert, selbst erstellte nicht.
 */
export function seedDatabase(): void {
  const erstinstallation = getSetting('initialized') !== 'true'

  if (db.prepare('SELECT COUNT(*) AS n FROM locations').get() as { n: number }) {
    for (const l of SEED_LOCATIONS) {
      if (!db.prepare('SELECT 1 FROM locations WHERE id = ?').get(l.id)) upsertLocation(l)
    }
  }
  for (const g of SEED_GROUPS) {
    if (!db.prepare('SELECT 1 FROM groups WHERE id = ?').get(g.id)) upsertGroup(g)
  }
  for (const p of SEED_PLANS) {
    if (!db.prepare('SELECT 1 FROM plans WHERE id = ?').get(p.id)) upsertDoc('plans', p.id, p)
  }
  for (const c of SEED_CONTACTS) {
    if (!db.prepare('SELECT 1 FROM contacts WHERE id = ?').get(c.id)) upsertDoc('contacts', c.id, c)
  }

  // Szenarien: Standardinhalte auf die aktuelle Version heben, eigene unangetastet lassen
  const inhaltsVersion = Number(getSetting('scenarioContentVersion') ?? 0)
  if (inhaltsVersion < SCENARIO_CONTENT_VERSION) {
    for (const s of SEED_SCENARIOS) upsertDoc('scenarios', s.id, s)
    setSetting('scenarioContentVersion', String(SCENARIO_CONTENT_VERSION))
  }

  if (!getSetting('integrations')) saveIntegrations(LEER_INTEGRATIONEN)
  else {
    // integrations() ergänzt fehlende Abschnitte neuer Versionen mit den Vorgaben
    const bisher = integrations()
    // Bestehende Installationen kennen die echte Nummer noch nicht
    if (ALTE_PLATZHALTER.includes((bisher.hotline?.number ?? '').trim())) {
      bisher.hotline = { enabled: true, number: NOTFALLNUMMER }
    }
    saveIntegrations(bisher)
  }

  ensureAdmin()

  if (erstinstallation) {
    setSetting('initialized', 'true')
    addAudit('system', 'Alarmserver initialisiert – Grundkonfiguration für SONNENBERG Kompetenzzentrum eingerichtet.')
  }
}

/**
 * Es muss immer mindestens ein anmeldefähiger Administrator existieren,
 * sonst liesse sich der Server nicht mehr verwalten.
 */
export function ensureAdmin(): void {
  const users = allStoredUsers()
  const anmeldefaehigeAdmins = users.filter((u) => u.role === 'admin' && u.passwordHash && u.passwordSalt)
  if (anmeldefaehigeAdmins.length > 0) return

  const vorhandenerAdmin = users.find((u) => u.role === 'admin')
  const salt = newSalt()
  const admin: StoredUser = vorhandenerAdmin ?? {
    id: 'u-admin',
    firstName: 'Stefan',
    lastName: 'Gross',
    email: INITIAL_ADMIN_EMAIL,
    phone: '',
    role: 'admin',
    groupIds: ['gr-krisenstab', 'gr-alle'],
    locationId: 'loc-baar',
    language: 'de',
  }
  upsertUser({
    ...admin,
    passwordSalt: salt,
    passwordHash: hashPassword(INITIAL_ADMIN_PASSWORD, salt),
    mustChangePassword: true,
  })
  addAudit('system', `Administratorkonto ${admin.email} mit Erstpasswort eingerichtet – Wechsel bei der ersten Anmeldung erforderlich.`)
}
