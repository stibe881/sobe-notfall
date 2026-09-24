import { useEffect, useState } from 'react'
import type { Role } from '../types'

/**
 * Welche Bereiche des Portals wem offenstehen.
 *
 * Die eigentliche Schranke steht auf dem Server: Konten, Gruppen, Standorte
 * und die Einstellungen darf nur die Administration ändern, alles Übrige auch
 * der Krisenstab. Was hier steht, spiegelt genau diese Grenze im Menü – damit
 * niemand Seiten vor sich hat, deren Knöpfe ihm der Server verweigert.
 *
 * **Diese Liste ersetzt die Prüfung auf dem Server nicht.** Sie ist die
 * Höflichkeit, nicht das Schloss.
 */
export const NUR_ADMIN: readonly string[] = [
  '/benutzer',
  '/gruppen',
  '/standorte',
  '/integrationen',
]

export type Ansicht = 'admin' | 'krisenstab'

const SPEICHER = 'sobe-ansicht'

/**
 * Wirksame Rolle für die Darstellung.
 *
 * Die Administration darf die Ansicht auf «Krisenstab» stellen, um zu sehen,
 * was ihr Krisenstab sieht. Das ändert **nur die Anzeige** – auf dem Server
 * bleibt sie Administration. Für eine echte Rechtebeschränkung wäre ein
 * zweites Konto nötig; ein Schalter, den man selbst umlegen kann, ist keine.
 */
export function wirksameRolle(rolle: Role, ansicht: Ansicht): Role {
  return rolle === 'admin' && ansicht === 'krisenstab' ? 'krisenstab' : rolle
}

/** Darf diese Rolle die Seite öffnen? */
export function darfOeffnen(rolle: Role, pfad: string): boolean {
  return rolle === 'admin' || !NUR_ADMIN.includes(pfad)
}

/**
 * Gewählte Ansicht, über die Sitzung hinweg gemerkt.
 *
 * Bewusst im sessionStorage: Beim nächsten Anmelden steht die Administration
 * wieder in ihrer eigenen Ansicht. Eine vergessene Umschaltung, die Tage
 * später Menüpunkte vermissen lässt, kostet mehr Zeit als sie spart.
 */
export function useAnsicht(): [Ansicht, (a: Ansicht) => void] {
  const [ansicht, setAnsichtRoh] = useState<Ansicht>(() => {
    try {
      return sessionStorage.getItem(SPEICHER) === 'krisenstab' ? 'krisenstab' : 'admin'
    } catch {
      return 'admin'
    }
  })
  useEffect(() => {
    const uebernehmen = () => {
      try {
        setAnsichtRoh(sessionStorage.getItem(SPEICHER) === 'krisenstab' ? 'krisenstab' : 'admin')
      } catch {
        // ohne Speicher bleibt es bei der aktuellen Ansicht
      }
    }
    window.addEventListener('sobe-ansicht', uebernehmen)
    return () => window.removeEventListener('sobe-ansicht', uebernehmen)
  }, [])
  const setAnsicht = (a: Ansicht) => {
    try {
      sessionStorage.setItem(SPEICHER, a)
    } catch {
      // ohne Speicher gilt die Umschaltung nur bis zum Neuladen
    }
    setAnsichtRoh(a)
    // Sidebar und Inhaltsbereich hängen an derselben Wahl
    window.dispatchEvent(new Event('sobe-ansicht'))
  }
  return [ansicht, setAnsicht]
}
