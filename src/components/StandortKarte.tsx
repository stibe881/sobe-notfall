import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Karte zum Festlegen eines Geofence.
 *
 * Statt Breiten- und Längengrad von Hand einzutippen wird der Punkt gesetzt:
 * Marker ziehen oder in die Karte tippen. Der Kreis zeigt den Radius in echtem
 * Massstab – erst damit ist erkennbar, ob 300 Meter das Schulhaus umfassen
 * oder das halbe Quartier.
 *
 * Die Kacheln kommen von OpenStreetMap und werden vom Browser geladen, nicht
 * vom Alarmserver. Ohne Internetzugang bleibt die Karte grau; die Koordinaten
 * lassen sich dann weiterhin über das Aufklappfeld darunter eingeben.
 */
export interface Punkt { lat: number; lng: number }

export function StandortKarte({
  punkt, radiusM, onPunkt, hoehe = 300,
}: {
  punkt: Punkt
  radiusM: number
  onPunkt: (p: Punkt) => void
  hoehe?: number
}) {
  const huelle = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const kreis = useRef<L.Circle | null>(null)
  // In einem Ref, damit die Karte nur einmal aufgebaut wird und der Rückruf
  // trotzdem immer der aktuelle ist
  const melde = useRef(onPunkt)
  melde.current = onPunkt
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    if (!huelle.current || karte.current) return
    try {
      const m = L.map(huelle.current, { attributionControl: true }).setView([punkt.lat, punkt.lng], 16)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(m)

      // Eigenes Symbol aus HTML: Die Standardgrafik von Leaflet liegt als Bild
      // im Paket und bräuchte eine Sonderbehandlung im Bündler.
      const symbol = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:#c81e1e;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      marker.current = L.marker([punkt.lat, punkt.lng], { icon: symbol, draggable: true }).addTo(m)
      kreis.current = L.circle([punkt.lat, punkt.lng], {
        radius: radiusM, color: '#c81e1e', weight: 2, fillColor: '#c81e1e', fillOpacity: 0.12,
      }).addTo(m)

      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng()
        melde.current({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })
      })
      m.on('click', (e: L.LeafletMouseEvent) => {
        melde.current({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) })
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

  // Punkt von aussen geändert (Adresssuche, Zahleneingabe) – nachführen
  useEffect(() => {
    if (!karte.current || !marker.current || !kreis.current) return
    const aktuell = marker.current.getLatLng()
    if (Math.abs(aktuell.lat - punkt.lat) > 1e-9 || Math.abs(aktuell.lng - punkt.lng) > 1e-9) {
      marker.current.setLatLng([punkt.lat, punkt.lng])
      karte.current.panTo([punkt.lat, punkt.lng])
    }
    kreis.current.setLatLng([punkt.lat, punkt.lng])
    kreis.current.setRadius(radiusM)
  }, [punkt.lat, punkt.lng, radiusM])

  if (fehler) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500" style={{ height: hoehe }}>
        Die Karte konnte nicht geladen werden. Koordinaten unten von Hand eintragen.
      </div>
    )
  }

  return (
    <div
      ref={huelle}
      style={{ height: hoehe }}
      className="rounded-xl overflow-hidden border border-slate-200 z-0"
      aria-label="Karte mit dem Standort; Marker ziehen oder in die Karte tippen"
    />
  )
}
