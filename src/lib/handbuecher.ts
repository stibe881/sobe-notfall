import type { Role } from '../types'

/**
 * Die mitgelieferten Handbücher und die Rollen, für die sie gelten.
 *
 * Der Alarmserver liefert sie unter /handbuecher aus dem Ordner docs/ der
 * installierten Version aus – sie passen damit immer zum laufenden Stand.
 * Gezeigt wird jeder Person nur, was ihre Rolle betrifft; die Liste steht an
 * einer Stelle, damit Portal und App-Vorschau nicht auseinanderlaufen.
 */
export interface Handbuch {
  datei: string
  nr: number
  titel: string
  fuer: string
  beschreibung: string
  rollen: Role[]
}

export const HANDBUECHER: Handbuch[] = [
  {
    datei: 'handbuch-1-administration.html',
    nr: 1,
    titel: 'Administration',
    fuer: 'Schulleitung und Systemverantwortliche',
    beschreibung: 'Das System einrichten und aktuell halten: Szenarien, Konten, Gruppen, Alarmpläne, Integrationen, Aktualisierung.',
    rollen: ['admin'],
  },
  {
    datei: 'handbuch-2-krisenstab.html',
    nr: 2,
    titel: 'Krisenstab',
    fuer: 'Krisenstabsmitglieder',
    beschreibung: 'Führen im Ereignis: Alarm auslösen, Alarmzentrale, Lagemeldungen, Entwarnung, Krisenteam aufbieten.',
    rollen: ['admin', 'krisenstab'],
  },
  {
    datei: 'handbuch-3-mitarbeitende.html',
    nr: 3,
    titel: 'Mitarbeitende',
    fuer: 'alle Mitarbeitenden',
    beschreibung: 'Die App im Alltag und im Ernstfall: Alarme empfangen und quittieren, Szenarien, SOS, Alleinarbeits-Timer, Notruf.',
    rollen: ['admin', 'krisenstab', 'mitarbeiter'],
  },
  {
    datei: 'handbuch-4-installation.html',
    nr: 4,
    titel: 'Installation & Konfiguration',
    fuer: 'Systemverantwortliche und technischen Betrieb',
    beschreibung: 'Vom leeren Server zum geprobten Failover: Installation, Einrichtung, Integrationen, App-Verteilung, Redundanz, Sicherung.',
    rollen: ['admin'],
  },
]

/** Nachschlagen nach Dateiname – für die Liste, die der Server meldet */
export const HANDBUCH_NACH_DATEI: Record<string, Handbuch> = Object.fromEntries(
  HANDBUECHER.map((h) => [h.datei, h]),
)

export const handbuecherFuer = (rolle: Role): Handbuch[] => HANDBUECHER.filter((h) => h.rollen.includes(rolle))
