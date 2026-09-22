/**
 * Pfade unabhängig vom Arbeitsverzeichnis auflösen.
 *
 * Wird ein Skript aus einem anderen Verzeichnis gestartet – etwa aus einem
 * Cron-Eintrag, der im Benutzerverzeichnis landet –, zeigte ein relativer Pfad
 * wie `data/sobe-notfall.sqlite` plötzlich woandershin. Die Sicherung kopierte
 * dann monatelang eine verwaiste Datei, ohne dass es jemandem auffiel.
 * Massgeblich ist deshalb immer der Ordner `server/`, in dem diese Skripte
 * liegen. `SOBE_DB_PATH` und `SOBE_ENV_FILE` gehen weiterhin vor.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Ordner server/ – eine Ebene über scripts/ */
export const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** server/.env laden, egal von wo das Skript gestartet wurde */
export function ladeEnv() {
  const datei = process.env.SOBE_ENV_FILE
    ? resolve(process.env.SOBE_ENV_FILE)
    : resolve(SERVER_ROOT, '.env')
  if (existsSync(datei)) process.loadEnvFile(datei)
  return datei
}

/** Datenbankdatei: SOBE_DB_PATH, sonst server/data/sobe-notfall.sqlite */
export function datenbankPfad() {
  const wert = process.env.SOBE_DB_PATH
  if (!wert) return resolve(SERVER_ROOT, 'data/sobe-notfall.sqlite')
  return isAbsolute(wert) ? wert : resolve(SERVER_ROOT, wert)
}
