import { db, getSetting, setSetting } from './db.js'
import { hashPassword, newSalt } from './auth.js'
import { INTEGRATION_VORGABEN } from './integrationen.js'
import {
  SCENARIO_CONTENT_VERSION, SEED_CONTACTS, SEED_GROUPS, SEED_LOCATIONS, SEED_PLANS, SEED_SCENARIOS,
} from './seed.js'
import { allStoredUsers, integrations, saveIntegrations, upsertDoc, upsertGroup, upsertLocation, upsertUser, addAudit } from './store.js'
import type { AlarmPlan, IntegrationSettings, StoredUser } from './types.js'

/** Erstpasswort des Administrators; muss bei der ersten Anmeldung geändert werden */
export const INITIAL_ADMIN_PASSWORD = process.env.SOBE_ADMIN_PASSWORD ?? 'SOBE-Start2026!'
export const INITIAL_ADMIN_EMAIL = process.env.SOBE_ADMIN_EMAIL ?? 'admin@sobe-notfall.local'

/**
 * Erstbefüllungs-Profil dieser Installation.
 *
 * standard: neutraler Start für einen neuen Kunden – Szenarien, Gruppen,
 * Alarmplan-Vorlagen und Notrufnummern, aber keine Standorte und keine
 * kundenspezifischen Angaben; der Einrichtungsassistent im Portal fragt sie ab.
 *
 * sonnenberg: die historische Erstbefüllung des SONNENBERG Kompetenzzentrums.
 * Bestehende Installationen behalten dieses Profil automatisch.
 */
export type SeedProfil = 'standard' | 'sonnenberg'

export function seedProfil(): SeedProfil {
  return getSetting('seedProfile') === 'sonnenberg' ? 'sonnenberg' : 'standard'
}

/** Interne Notfallnummer des Kompetenzzentrums – nur im Profil «sonnenberg» */
export const NOTFALLNUMMER = '+41 41 767 49 48'
/** Platzhalter aus früheren Versionen, der beim Start ersetzt wird */
const ALTE_PLATZHALTER = ['', '+41 41 000 11 22']

/**
 * Alarmplan-Vorlagen ohne Standortbezug: Für neue Kunden gibt es die
 * Sonnenberg-Standorte nicht, die Pläne bleiben als Vorlage trotzdem nützlich.
 */
function neutralePlaene(): AlarmPlan[] {
  return SEED_PLANS.map((p) => ({
    ...p,
    name: p.name.replace(' Hauptsitz Baar', ''),
    locationIds: [],
  }))
}

/** Steht der Einrichtungsassistent im Portal noch aus? */
export function einrichtungOffen(): boolean {
  return getSetting('setupPending') === 'true'
}

export function einrichtungAbschliessen(): void {
  setSetting('setupPending', 'false')
}

/**
 * Erstbefüllung und Inhalts-Aktualisierungen.
 * Stammdaten (Gruppen, Alarmpläne, Notrufnummern) werden nur angelegt,
 * wenn sie fehlen – bestehende Anpassungen bleiben erhalten. Standard-Szenarien
 * werden bei einer neuen Inhaltsversion aktualisiert, selbst erstellte nicht.
 */
export function seedDatabase(): void {
  const erstinstallation = getSetting('initialized') !== 'true'

  // Profil festlegen: Bestehende Installationen (vor Einführung der Profile)
  // sind Sonnenberg-Installationen und bleiben es. Neue starten neutral,
  // sofern SOBE_SEED_PROFILE nichts anderes sagt.
  if (!getSetting('seedProfile')) {
    const gewuenscht = process.env.SOBE_SEED_PROFILE === 'sonnenberg' ? 'sonnenberg' : 'standard'
    setSetting('seedProfile', erstinstallation ? gewuenscht : 'sonnenberg')
  }
  const profil = seedProfil()

  // Standorte gehören zum Kunden – nur das Sonnenberg-Profil bringt eigene mit
  if (profil === 'sonnenberg') {
    for (const l of SEED_LOCATIONS) {
      if (!db.prepare('SELECT 1 FROM locations WHERE id = ?').get(l.id)) upsertLocation(l)
    }
  }
  for (const g of SEED_GROUPS) {
    if (!db.prepare('SELECT 1 FROM groups WHERE id = ?').get(g.id)) upsertGroup(g)
  }
  for (const p of profil === 'sonnenberg' ? SEED_PLANS : neutralePlaene()) {
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

  if (!getSetting('integrations')) {
    const leer: IntegrationSettings = {
      ...INTEGRATION_VORGABEN,
      ...(profil === 'sonnenberg'
        ? {
            organization: { name: 'SONNENBERG Kompetenzzentrum', shortName: 'SONNENBERG' },
            smsGateway: { ...INTEGRATION_VORGABEN.smsGateway, senderId: 'SONNENBERG' },
            hotline: { enabled: true, number: NOTFALLNUMMER },
          }
        : {}),
    }
    saveIntegrations(leer)
  } else {
    // integrations() ergänzt fehlende Abschnitte neuer Versionen mit den Vorgaben
    const bisher = integrations()
    if (profil === 'sonnenberg') {
      // Bestehende Sonnenberg-Installationen kennen die echte Nummer oder den
      // Organisationsnamen noch nicht
      if (ALTE_PLATZHALTER.includes((bisher.hotline?.number ?? '').trim())) {
        bisher.hotline = { enabled: true, number: NOTFALLNUMMER }
      }
      if (!bisher.organization.name) {
        bisher.organization = { name: 'SONNENBERG Kompetenzzentrum', shortName: 'SONNENBERG' }
      }
    }
    saveIntegrations(bisher)
  }

  ensureAdmin()

  if (erstinstallation) {
    setSetting('initialized', 'true')
    if (profil === 'standard') setSetting('setupPending', 'true')
    addAudit(
      'system',
      profil === 'sonnenberg'
        ? 'Alarmserver initialisiert – Grundkonfiguration für SONNENBERG Kompetenzzentrum eingerichtet.'
        : 'Alarmserver initialisiert – neutrale Grundkonfiguration; Einrichtungsassistent im Portal offen.',
    )
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
  const ersterStandort = (db.prepare('SELECT id FROM locations ORDER BY name LIMIT 1').get() as { id: string } | undefined)?.id ?? ''
  const admin: StoredUser = vorhandenerAdmin ?? {
    id: 'u-admin',
    firstName: 'System',
    lastName: 'Administrator',
    email: INITIAL_ADMIN_EMAIL,
    phone: '',
    role: 'admin',
    groupIds: ['gr-krisenstab', 'gr-alle'],
    locationId: ersterStandort,
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
