import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import { ladeIntegrationen, maskiereIntegrationen, speichereIntegrationen } from './integrationen.js'
import { publicUser } from './auth.js'
import type {
  Alarm, AlarmButton, AlarmPlan, AuditEntry, Channel, Delivery, EmergencyContact, EscalationLevel,
  Group, IntegrationSettings, Location, LoneWorkSession, Scenario, ServerState, StoredUser, User,
} from './types.js'
import { CHANNEL_LABELS } from './types.js'

export function uid(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

// ---------- Lesen ----------

function parseUser(row: Record<string, unknown>): StoredUser {
  return {
    id: row.id as string,
    firstName: row.firstName as string,
    lastName: row.lastName as string,
    email: row.email as string,
    phone: row.phone as string,
    role: row.role as StoredUser['role'],
    groupIds: JSON.parse((row.groupIds as string) || '[]'),
    locationId: row.locationId as string,
    language: row.language as StoredUser['language'],
    absence: row.absence ? JSON.parse(row.absence as string) : undefined,
    partTimeNote: (row.partTimeNote as string) || undefined,
    passwordHash: (row.passwordHash as string) || undefined,
    passwordSalt: (row.passwordSalt as string) || undefined,
    mustChangePassword: Boolean(row.mustChangePassword),
    lastLoginAt: (row.lastLoginAt as number) || undefined,
  }
}

export function allStoredUsers(): StoredUser[] {
  return (db.prepare('SELECT * FROM users ORDER BY lastName, firstName').all() as Record<string, unknown>[]).map(parseUser)
}

export function findStoredUser(id: string): StoredUser | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? parseUser(row) : null
}

export function findStoredUserByEmail(email: string): StoredUser | null {
  const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.trim()) as
    | Record<string, unknown>
    | undefined
  return row ? parseUser(row) : null
}

const docRows = <T>(table: string, order = ''): T[] =>
  (db.prepare(`SELECT doc FROM ${table} ${order}`).all() as { doc: string }[]).map((r) => JSON.parse(r.doc) as T)

export function allGroups(): Group[] {
  return db.prepare('SELECT id, name, description, isCrisisTeam FROM groups ORDER BY name').all().map((r) => {
    const row = r as Record<string, unknown>
    return { ...row, isCrisisTeam: Boolean(row.isCrisisTeam) } as Group
  })
}

export function allLocations(): Location[] {
  return db.prepare('SELECT * FROM locations ORDER BY name').all().map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      name: row.name as string,
      address: row.address as string,
      geofence: row.geofence ? JSON.parse(row.geofence as string) : undefined,
      operatingHours: JSON.parse(row.operatingHours as string),
    }
  })
}

export const allScenarios = (): Scenario[] => docRows<Scenario>('scenarios')
export const allPlans = (): AlarmPlan[] => docRows<AlarmPlan>('plans')
export const allContacts = (): EmergencyContact[] => docRows<EmergencyContact>('contacts')
export const allButtons = (): AlarmButton[] => docRows<AlarmButton>('buttons')
export const allAlarms = (): Alarm[] => docRows<Alarm>('alarms', 'ORDER BY triggeredAt DESC LIMIT 200')
export const allLoneWork = (): LoneWorkSession[] => docRows<LoneWorkSession>('lone_work')

export function allAudit(): AuditEntry[] {
  return db.prepare('SELECT id, ts, type, message, userId FROM audit ORDER BY ts DESC LIMIT 300').all().map((r) => {
    const row = r as Record<string, unknown>
    return { ...row, userId: (row.userId as string) || undefined } as AuditEntry
  })
}

export function integrations(): IntegrationSettings {
  return ladeIntegrationen()
}

export function saveIntegrations(value: IntegrationSettings): void {
  speichereIntegrationen(value)
}

export function fullState(): ServerState {
  return {
    users: allStoredUsers().map(publicUser),
    groups: allGroups(),
    locations: allLocations(),
    scenarios: allScenarios(),
    plans: allPlans(),
    alarms: allAlarms(),
    buttons: allButtons(),
    loneWorkSessions: allLoneWork(),
    // Geheimnisse (Gateway-Passwörter, Tokens) gehen nur maskiert an die Clients
    integrations: maskiereIntegrationen(integrations()),
    contacts: allContacts(),
    audit: allAudit(),
  }
}

// ---------- Schreiben ----------

export function upsertUser(user: StoredUser): void {
  db.prepare(`
    INSERT INTO users (id, firstName, lastName, email, phone, role, groupIds, locationId, language,
                       absence, partTimeNote, passwordHash, passwordSalt, mustChangePassword, lastLoginAt)
    VALUES (@id, @firstName, @lastName, @email, @phone, @role, @groupIds, @locationId, @language,
            @absence, @partTimeNote, @passwordHash, @passwordSalt, @mustChangePassword, @lastLoginAt)
    ON CONFLICT(id) DO UPDATE SET
      firstName = excluded.firstName, lastName = excluded.lastName, email = excluded.email,
      phone = excluded.phone, role = excluded.role, groupIds = excluded.groupIds,
      locationId = excluded.locationId, language = excluded.language, absence = excluded.absence,
      partTimeNote = excluded.partTimeNote, passwordHash = excluded.passwordHash,
      passwordSalt = excluded.passwordSalt, mustChangePassword = excluded.mustChangePassword,
      lastLoginAt = excluded.lastLoginAt
  `).run({
    ...user,
    groupIds: JSON.stringify(user.groupIds ?? []),
    absence: user.absence ? JSON.stringify(user.absence) : null,
    partTimeNote: user.partTimeNote ?? null,
    passwordHash: user.passwordHash ?? null,
    passwordSalt: user.passwordSalt ?? null,
    mustChangePassword: user.mustChangePassword ? 1 : 0,
    lastLoginAt: user.lastLoginAt ?? null,
  })
}

export const deleteUser = (id: string) => db.prepare('DELETE FROM users WHERE id = ?').run(id)

export function upsertGroup(g: Group): void {
  db.prepare(`
    INSERT INTO groups (id, name, description, isCrisisTeam) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, isCrisisTeam = excluded.isCrisisTeam
  `).run(g.id, g.name, g.description ?? '', g.isCrisisTeam ? 1 : 0)
}

export function upsertLocation(l: Location): void {
  db.prepare(`
    INSERT INTO locations (id, name, address, geofence, operatingHours) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = excluded.address,
      geofence = excluded.geofence, operatingHours = excluded.operatingHours
  `).run(l.id, l.name, l.address ?? '', l.geofence ? JSON.stringify(l.geofence) : null, JSON.stringify(l.operatingHours))
}

export function upsertDoc(table: 'scenarios' | 'plans' | 'contacts' | 'buttons' | 'lone_work', id: string, doc: unknown): void {
  db.prepare(`INSERT INTO ${table} (id, doc) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc`).run(id, JSON.stringify(doc))
}

export const deleteDoc = (table: string, id: string) => db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)

export function saveAlarm(alarm: Alarm): void {
  db.prepare(`
    INSERT INTO alarms (id, triggeredAt, status, doc) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, doc = excluded.doc
  `).run(alarm.id, alarm.triggeredAt, alarm.status, JSON.stringify(alarm))
}

export function findAlarm(id: string): Alarm | null {
  const row = db.prepare('SELECT doc FROM alarms WHERE id = ?').get(id) as { doc: string } | undefined
  return row ? (JSON.parse(row.doc) as Alarm) : null
}

export function addAudit(type: string, message: string, userId?: string): AuditEntry {
  const entry: AuditEntry = { id: uid('audit'), ts: Date.now(), type, message, userId }
  db.prepare('INSERT INTO audit (id, ts, type, message, userId) VALUES (?, ?, ?, ?, ?)').run(
    entry.id, entry.ts, entry.type, entry.message, entry.userId ?? null,
  )
  return entry
}

// ---------- Alarmlogik ----------

/** Empfänger bestimmen: Gruppen ∩ Standorte, Abwesende ausfiltern */
export function resolveRecipients(users: User[] | StoredUser[], groupIds: string[], locationIds: string[]): (User | StoredUser)[] {
  const today = new Date().toISOString().slice(0, 10)
  return users.filter((u) => {
    const inGroup = groupIds.length === 0 || u.groupIds.some((g) => groupIds.includes(g))
    const inLocation = locationIds.length === 0 || locationIds.includes(u.locationId)
    const absent = u.absence && u.absence.from <= today && today <= u.absence.to
    return inGroup && inLocation && !absent
  })
}

export function buildDeliveries(recipientIds: string[], channels: Channel[]): Delivery[] {
  const now = Date.now()
  const out: Delivery[] = []
  for (const userId of recipientIds) {
    for (const channel of channels) {
      out.push({ id: uid('dlv'), userId, channel, status: 'pending', ack: 'none', updatedAt: now })
    }
  }
  return out
}

export interface TriggerOptions {
  scenarioId: string
  message: string
  silent: boolean
  requireAck: boolean
  channels: Channel[]
  groupIds: string[]
  locationIds: string[]
  triggeredByUserId: string
  triggeredVia: Alarm['triggeredVia']
  planId?: string
  escalation?: EscalationLevel[]
  recipientUserIds?: string[]
}

export function createAlarm(opts: TriggerOptions): Alarm {
  const users = allStoredUsers()
  const recipients = opts.recipientUserIds
    ? users.filter((u) => opts.recipientUserIds!.includes(u.id))
    : resolveRecipients(users, opts.groupIds, opts.locationIds)
  const now = Date.now()
  return {
    id: uid('alarm'),
    scenarioId: opts.scenarioId,
    planId: opts.planId,
    message: opts.message,
    silent: opts.silent,
    requireAck: opts.requireAck,
    triggeredByUserId: opts.triggeredByUserId,
    triggeredVia: opts.triggeredVia,
    triggeredAt: now,
    locationIds: opts.locationIds,
    groupIds: opts.groupIds,
    channels: opts.channels,
    status: 'active',
    escalationStage: 0,
    escalation: opts.escalation ?? [],
    deliveries: buildDeliveries(recipients.map((r) => r.id), opts.channels),
    log: [
      {
        ts: now,
        message: `Alarm ausgelöst (${opts.triggeredVia}) – ${recipients.length} Empfänger über ${opts.channels
          .map((c) => CHANNEL_LABELS[c])
          .join(', ')}`,
      },
    ],
  }
}
