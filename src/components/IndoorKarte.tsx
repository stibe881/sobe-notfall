import { useEffect, useRef, useState } from 'react'
import type { CustomAnnotationPoint, MeridianMap } from '@meridian/web-sdk'
import sdkAdresse from '@meridian/web-sdk/dist/meridian-sdk.js?url'
import { api } from '../lib/api'
import type { IndoorPosition } from '../types'

/**
 * Grundriss aus Aruba Meridian mit der Position der alarmierenden Person.
 *
 * Das Meridian-Web-SDK ist gross und nur bei eingeschalteter Indoor-Ortung
 * nötig – es wird erst geladen, wenn eine Karte erscheint oder die Stockwerke
 * übernommen werden.
 */

type Sdk = typeof import('@meridian/web-sdk')

interface Zugang {
  region: 'us' | 'eu'
  appId: string
  apiToken: string
}

let zugangLaden: Promise<Zugang | null> | null = null

/** Zugang einmal pro Sitzung holen; nach einem Fehler beim nächsten Mal erneut */
function ladeZugang(): Promise<Zugang | null> {
  zugangLaden ??= api
    .meridianZugang()
    .then((z) => (z.apiToken && z.appId ? { region: z.region, appId: z.appId, apiToken: z.apiToken } : null))
    .catch((fehler) => {
      zugangLaden = null
      throw fehler
    })
  return zugangLaden
}

/** Nach dem Speichern neuer Einstellungen den Zugang neu holen */
export function vergissMeridianZugang(): void {
  zugangLaden = null
}

let sdkLaden: Promise<Sdk> | null = null

/**
 * Das SDK als offizielles Browser-Bündel laden (setzt window.MeridianSDK).
 *
 * Die Variante für Bundler (dist/web-sdk.js) verlangt das Node-Modul «path»
 * und scheitert im Browser an path.basename; das Browser-Bündel bringt alles
 * mit. Vite legt es als eigene Datei neben das Portal – kein fremdes CDN.
 */
export function ladeMeridianSdk(): Promise<Sdk> {
  sdkLaden ??= new Promise<Sdk>((fertig, fehler) => {
    const fenster = window as unknown as { MeridianSDK?: Sdk }
    if (fenster.MeridianSDK) {
      fertig(fenster.MeridianSDK)
      return
    }
    const skript = document.createElement('script')
    skript.src = sdkAdresse
    skript.async = true
    skript.onload = () => (fenster.MeridianSDK ? fertig(fenster.MeridianSDK) : fehler(new Error('Meridian-SDK nicht geladen')))
    skript.onerror = () => fehler(new Error('Meridian-SDK nicht erreichbar'))
    document.head.appendChild(skript)
  }).catch((f: unknown) => {
    sdkLaden = null
    throw f
  })
  return sdkLaden
}

function markierung(position: IndoorPosition, titel: string): CustomAnnotationPoint {
  return { type: 'point', x: position.x, y: position.y, size: 26, backgroundColor: '#e02424', title: titel }
}

export function IndoorKarte({ position, titel, hoehe = '340px' }: { position: IndoorPosition; titel: string; hoehe?: string }) {
  const behaelter = useRef<HTMLDivElement>(null)
  const karte = useRef<MeridianMap | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  // Ein anderes Stockwerk ist eine andere Karte – dann neu aufbauen
  useEffect(() => {
    let abgebrochen = false
    setFehler(null)
    ;(async () => {
      const zugang = await ladeZugang()
      if (!zugang) {
        setFehler('Für die Grundrissanzeige fehlt unter Integrationen → Indoor-Ortung das Lese-Token oder die Location-ID.')
        return
      }
      const sdk = await ladeMeridianSdk()
      if (abgebrochen || !behaelter.current) return
      let zentriert = false
      karte.current = sdk.createMap(behaelter.current, {
        api: new sdk.API({ token: zugang.apiToken, environment: zugang.region === 'eu' ? 'eu' : 'production' }),
        locationID: zugang.appId,
        floorID: position.mapId,
        height: hoehe,
        showFloorsControl: false,
        showSearchControl: false,
        loadTags: false,
        annotations: [markierung(position, titel)],
        onLoadingStateChange: (laedt) => {
          // Nach dem ersten Laden auf die Person zoomen. Endet das Laden ohne
          // Grundriss (Token falsch, keine Verbindung), wirft das SDK – dann
          // beim nächsten Ladeende erneut versuchen.
          if (laedt || zentriert || !karte.current) return
          try {
            karte.current.zoomToPoint({ x: position.x, y: position.y, scale: 2 })
            zentriert = true
          } catch {
            // Grundriss noch nicht da
          }
        },
      })
    })().catch((f: unknown) => {
      if (!abgebrochen) setFehler(`Grundriss nicht verfügbar: ${f instanceof Error ? f.message : String(f)}`)
    })
    return () => {
      abgebrochen = true
      karte.current?.destroy()
      karte.current = null
    }
    // Nur das Stockwerk baut neu auf; Bewegungen führt der zweite Effekt nach
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.mapId, hoehe])

  // Bewegung auf demselben Stockwerk: nur die Markierung versetzen
  useEffect(() => {
    karte.current?.update({ annotations: [markierung(position, titel)] })
  }, [position, titel])

  if (fehler) return <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{fehler}</div>
  return <div ref={behaelter} className="rounded-lg overflow-hidden border border-slate-200" style={{ minHeight: hoehe }} />
}
