import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAX_PUNKTE, umschliessenderKreis, type Punkt } from '../lib/umriss'

/**
 * Karte zum Zeichnen des Standort-Umrisses.
 *
 * Statt eines Kreises mit Radius wird das Gebäude oder Areal als Vieleck
 * erfasst – ein Kreis um ein Schulhaus schliesst regelmässig die halbe Strasse
 * mit ein oder lässt den Hinterhof aus. Eckpunkte werden durch Antippen der
 * Karte gesetzt und lassen sich ziehen.
 *
 * Der blasse Kreis zeigt, was das Betriebssystem überwacht: iOS und Android
 * kennen nur kreisförmige Regionen. Er weckt die App an der Grenze; ob jemand
 * am Standort ist, entscheidet danach der Umriss.
 *
 * Die Kacheln kommen von OpenStreetMap und werden vom Browser geladen, nicht
 * vom Alarmserver. Ohne Internetzugang bleibt die Karte grau.
 */
export function StandortKarte({
  punkte, onPunkte, hoehe = 320,
}: {
  punkte: Punkt[]
  onPunkte: (p: Punkt[]) => void
  hoehe?: number
}) {
  const huelle = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const ebene = useRef<L.LayerGroup | null>(null)
  // In Refs, damit die Karte nur einmal aufgebaut wird und die Rückrufe
  // trotzdem immer den aktuellen Stand sehen
  const aktuelle = useRef(punkte)
  aktuelle.current = punkte
  const melde = useRef(onPunkte)
  melde.current = onPunkte
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    if (!huelle.current || karte.current) return
    try {
      const start = punkte[0] ?? { lat: 47.3769, lng: 8.5417 }
      const m = L.map(huelle.current).setView([start.lat, start.lng], 17)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m)
      ebene.current = L.layerGroup().addTo(m)

      m.on('click', (e: L.LeafletMouseEvent) => {
        if (aktuelle.current.length >= MAX_PUNKTE) return
        melde.current([
          ...aktuelle.current,
          { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) },
        ])
      })
      karte.current = m
      // Im Dialog steht die Grösse erst nach dem Einblenden fest
      setTimeout(() => m.invalidateSize(), 50)
    } catch {
      setFehler(true)
    }
    return () => {
      karte.current?.remove()
      karte.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Umriss, Eckpunkte und Überwachungskreis neu zeichnen
  useEffect(() => {
    const m = karte.current
    const g = ebene.current
    if (!m || !g) return
    g.clearLayers()

    if (punkte.length >= 3) {
      L.polygon(punkte.map((p) => [p.lat, p.lng] as L.LatLngTuple), {
        color: '#c81e1e', weight: 2, fillColor: '#c81e1e', fillOpacity: 0.15,
      }).addTo(g)
      const kreis = umschliessenderKreis(punkte)
      L.circle([kreis.lat, kreis.lng], {
        radius: kreis.radiusM, color: '#94a3b8', weight: 1, dashArray: '4 4', fill: false,
      }).addTo(g)
    } else if (punkte.length === 2) {
      L.polyline(punkte.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color: '#c81e1e', weight: 2, dashArray: '4 4' }).addTo(g)
    }

    punkte.forEach((p, i) => {
      const symbol = L.divIcon({
        className: '',
        html:
          `<div style="width:22px;height:22px;border-radius:9999px;background:#c81e1e;border:2px solid #fff;` +
          `box-shadow:0 1px 4px rgba(0,0,0,.4);color:#fff;font:600 11px/18px system-ui;text-align:center">${i + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      const marker = L.marker([p.lat, p.lng], { icon: symbol, draggable: true }).addTo(g)
      marker.on('drag', () => {
        // Während des Ziehens nur die Zeichnung mitführen; der Zustand wird
        // erst am Ende gesetzt, sonst baut React die Marker laufend neu auf
        const pos = marker.getLatLng()
        const vorschau = aktuelle.current.map((q, j) => (j === i ? { lat: pos.lat, lng: pos.lng } : q))
        const flaeche = g.getLayers()[0]
        if (flaeche instanceof L.Polygon) {
          flaeche.setLatLngs(vorschau.map((q) => [q.lat, q.lng] as L.LatLngTuple))
        }
      })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        melde.current(
          aktuelle.current.map((q, j) =>
            j === i ? { lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) } : q,
          ),
        )
      })
      // Doppeltippen entfernt den Eckpunkt – schneller als die Liste darunter
      marker.on('dblclick', (e) => {
        L.DomEvent.stop(e)
        melde.current(aktuelle.current.filter((_, j) => j !== i))
      })
    })
  }, [punkte])

  // Auf den Umriss zoomen, wenn er von aussen gesetzt wurde (Adresssuche)
  const letzteAnzahl = useRef(punkte.length)
  useEffect(() => {
    if (!karte.current || punkte.length < 1) return
    if (letzteAnzahl.current === 0 && punkte.length > 0) {
      karte.current.fitBounds(L.latLngBounds(punkte.map((p) => [p.lat, p.lng] as L.LatLngTuple)).pad(0.6))
    }
    letzteAnzahl.current = punkte.length
  }, [punkte])

  if (fehler) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500" style={{ height: hoehe }}>
        Die Karte konnte nicht geladen werden. Eckpunkte unten von Hand eintragen.
      </div>
    )
  }

  return (
    <div
      ref={huelle}
      style={{ height: hoehe }}
      className="rounded-xl overflow-hidden border border-slate-200 z-0"
      aria-label="Karte mit dem Umriss des Standorts; in die Karte tippen setzt einen Eckpunkt, Punkte lassen sich ziehen"
    />
  )
}
