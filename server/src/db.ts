import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * SQLite als Datenhaltung: eine Datei, keine externe Datenbank, überall lauffähig.
 * Sammlungen mit fester Struktur liegen in Tabellen; verschachtelte Teile eines
 * Alarms (Zustellungen, Journal) als JSON in der jeweiligen Zeile.
 */

const DB_PATH = resolve(process.env.SOBE_DB_PATH ?? 'data/sobe-notfall.sqlite')
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    groupIds TEXT NOT NULL DEFAULT '[]',
    locationId TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'de',
    absence TEXT,
    partTimeNote TEXT,
    passwordHash TEXT,
    passwordSalt TEXT,
    mustChangePassword INTEGER NOT NULL DEFAULT 0,
    lastLoginAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    isCrisisTeam INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    geofence TEXT,
    operatingHours TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS buttons (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    triggeredAt INTEGER NOT NULL,
    status TEXT NOT NULL,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lone_work (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    userId TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS push_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'ios',
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_alarms_ts ON alarms(triggeredAt DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
`)

/** Nachträglich ergänzte Spalten – SQLite kennt kein «ADD COLUMN IF NOT EXISTS» */
function ensureColumn(table: string, column: string, definition: string): void {
  const vorhanden = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column)
  if (!vorhanden) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

// Darf dieses Gerät Alarme auch bei stummem Telefon hörbar machen?
ensureColumn('push_tokens', 'criticalAlerts', 'INTEGER NOT NULL DEFAULT 0')

// Geofencing: aktueller Aufenthaltsort pro Person – nur der Standort-Name,
// nie GPS-Koordinaten. locationId NULL heisst: an keinem erfassten Standort.
db.exec(`
  CREATE TABLE IF NOT EXISTS presence (
    userId TEXT PRIMARY KEY,
    locationId TEXT,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// Push-Tickets: Expo bestätigt die Zustellung erst später über eine Quittung
db.exec(`
  CREATE TABLE IF NOT EXISTS push_tickets (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    userId TEXT NOT NULL,
    alarmId TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_push_tickets_created ON push_tickets(createdAt);
`)

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}
