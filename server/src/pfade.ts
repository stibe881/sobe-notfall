import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Feste Bezugspunkte im Dateisystem.
 *
 * Früher hingen Datenbank, Portal-Verzeichnis und Repository-Wurzel am
 * Arbeitsverzeichnis des Prozesses. Wurde der Server einmal von woanders
 * gestartet – etwa aus einem Cron-Eintrag oder von Hand –, öffnete er
 * stillschweigend eine andere Datenbank, lieferte ein altes Portal aus und die
 * Aktualisierung hätte in einem fremden Verzeichnis gezogen und gebaut. Nichts
 * davon meldete einen Fehler. Massgeblich ist deshalb der Ort dieser Datei.
 */

/** Ordner server/ – eine Ebene über src/ (Entwicklung) bzw. dist/ (Betrieb) */
export const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Wurzel des Repositorys – enthält server/, mobile/, docs/ und dist/ */
export function repoRoot(): string {
  return resolve(process.env.SOBE_REPO_ROOT ?? resolve(SERVER_ROOT, '..'))
}

/** Einen einstellbaren Pfad auflösen: absolut gilt, relativ zählt ab server/ */
export function abServerRoot(wert: string | undefined, vorgabe: string): string {
  if (!wert) return resolve(SERVER_ROOT, vorgabe)
  return isAbsolute(wert) ? wert : resolve(SERVER_ROOT, wert)
}
