import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hebt das angesprungene Element kurz hervor, damit erkennbar ist, welche
 * Einstellung gemeint war – bei einer langen Seite sonst leicht zu übersehen.
 */
const HERVORHEBUNG = ['ring-2', 'ring-slate-400', 'ring-offset-2', 'transition-shadow']

/**
 * Springt zu dem Element, dessen id im Adress-Anhang steht
 * (`/integrationen#int-sms`).
 *
 * Das Portal läuft mit Hash-Routing: Die Adresse lautet dann
 * `#/integrationen#int-sms`, und der Browser springt nicht von selbst – der
 * vordere Teil ist bereits der Seitenpfad. Deshalb wird hier selbst gescrollt.
 * Der Versuch wird kurz wiederholt, weil die Karte beim ersten Rendern noch
 * nicht im Dokument stehen muss.
 */
export function useSprungziel(): void {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    let abgebrochen = false
    let aufraeumen: (() => void) | undefined

    function versuchen(restVersuche: number): void {
      if (abgebrochen) return
      const ziel = document.getElementById(id)
      if (!ziel) {
        if (restVersuche > 0) {
          const t = setTimeout(() => versuchen(restVersuche - 1), 120)
          aufraeumen = () => clearTimeout(t)
        }
        return
      }
      ziel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      ziel.classList.add(...HERVORHEBUNG)
      const t = setTimeout(() => ziel.classList.remove(...HERVORHEBUNG), 2500)
      aufraeumen = () => {
        clearTimeout(t)
        ziel.classList.remove(...HERVORHEBUNG)
      }
    }

    versuchen(8)
    return () => {
      abgebrochen = true
      aufraeumen?.()
    }
  }, [hash])
}
