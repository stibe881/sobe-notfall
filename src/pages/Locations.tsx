import { Suspense, lazy, useState } from 'react'
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Location } from '../types'
import { Badge, Button, Card, Field, Modal, inputClass, useConfirm } from '../components/ui'
// Leaflet samt Kartenstil nur laden, wenn ein Standort bearbeitet wird – das
// hält das Bündel für alle anderen Seiten klein
const StandortKarte = lazy(() => import('../components/StandortKarte').then((m) => ({ default: m.StandortKarte })))
import { sucheAdresse, type Fundstelle } from '../lib/geokodierung'

export default function Locations() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Location | null>(null)
  const { ask, confirmEl } = useConfirm()

  function newLocation(): Location {
    return {
      id: uid('loc'), name: '', address: '',
      operatingHours: { days: 'Mo–Fr', open: '08:00', close: '17:00' },
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Standorte</h1>
          <p className="text-sm text-slate-500">
            Standortverwaltung mit Betriebszeiten und Geofencing zur automatischen Standortzuweisung der Nutzer
          </p>
        </div>
        <Button onClick={() => setEditing(newLocation())}><Plus size={16} /> Neuer Standort</Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.locations.map((l) => {
          const userCount = state.users.filter((u) => u.locationId === l.id).length
          return (
            <Card key={l.id}>
              <div className="flex items-start gap-3">
                <Building2 size={24} className="text-slate-400" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{l.name}</div>
                  <div className="text-sm text-slate-500">{l.address}</div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div>Betriebszeiten: {l.operatingHours.days}, {l.operatingHours.open}–{l.operatingHours.close}</div>
                    <div>{userCount} zugewiesene Nutzer</div>
                  </div>
                  <div className="mt-2">
                    {l.geofence
                      ? <Badge color={state.integrations.geofencing ? 'green' : 'slate'}><MapPin size={12} /> Geofence {l.geofence.radiusM} m{state.integrations.geofencing ? ' · aktiv' : ' · Geofencing unter Integrationen ausgeschaltet'}</Badge>
                      : <Badge>kein Geofence</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" onClick={() => setEditing(l)}><Pencil size={14} /></Button>
                <Button variant="ghost" onClick={() => ask(`Standort «${l.name}» löschen?`, () => dispatch({ type: 'DELETE_LOCATION', locationId: l.id }))}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {confirmEl}
      {editing && <LocationEditor location={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function LocationEditor({ location, onClose }: { location: Location; onClose: () => void }) {
  const { dispatch } = useStore()
  const [draft, setDraft] = useState<Location>({ ...location })
  const [geoEnabled, setGeoEnabled] = useState(!!location.geofence)
  const [geo, setGeo] = useState(location.geofence ?? { lat: 47.3769, lng: 8.5417, radiusM: 300 })
  const [suchLauft, setSuchLauft] = useState(false)
  const [treffer, setTreffer] = useState<Fundstelle[] | null>(null)
  const [suchFehler, setSuchFehler] = useState<string | null>(null)
  const [zahlenOffen, setZahlenOffen] = useState(false)

  function save() {
    dispatch({ type: 'UPSERT_LOCATION', location: { ...draft, geofence: geoEnabled ? geo : undefined } })
    onClose()
  }

  /**
   * Adresse suchen. Bei genau einem Treffer wird er übernommen, sonst zur Wahl
   * gestellt: «Bahnhofstrasse» gibt es in jeder zweiten Gemeinde, und ein
   * stillschweigend gesetzter Geofence am falschen Ort fiele erst im Ernstfall
   * auf.
   */
  async function adresseSuchen() {
    setSuchLauft(true)
    setSuchFehler(null)
    setTreffer(null)
    try {
      const gefunden = await sucheAdresse(`${draft.address} ${draft.name}`.trim() || draft.address)
      if (gefunden.length === 0) {
        setSuchFehler('Zu dieser Adresse wurde nichts gefunden. Punkt in der Karte selbst setzen.')
      } else if (gefunden.length === 1) {
        uebernehmen(gefunden[0])
      } else {
        setTreffer(gefunden)
      }
    } catch (fehler) {
      setSuchFehler((fehler as Error).message)
    } finally {
      setSuchLauft(false)
    }
  }

  /**
   * Beim Einschalten des Geofence die Adresse einmal automatisch suchen –
   * aber nur, solange noch kein Punkt gesetzt ist. Ein bestehender Geofence
   * wird nie von selbst verschoben; das merkt sonst niemand.
   */
  function geofenceUmschalten(an: boolean) {
    setGeoEnabled(an)
    if (an && !location.geofence && draft.address.trim().length >= 3) void adresseSuchen()
  }

  function uebernehmen(f: Fundstelle) {
    setGeo((g) => ({ ...g, lat: f.lat, lng: f.lng }))
    setGeoEnabled(true)
    setTreffer(null)
  }

  return (
    <Modal title={location.name ? `Standort: ${location.name}` : 'Neuer Standort'} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Adresse">
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Strasse Nr., PLZ Ort"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adresseSuchen() } }}
            />
            <Button variant="secondary" onClick={() => void adresseSuchen()} disabled={suchLauft || draft.address.trim().length < 3}>
              {suchLauft ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Suchen
            </Button>
          </div>
        </Field>
      </div>

      {suchFehler && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">{suchFehler}</p>}
      {treffer && (
        <div className="rounded-xl border border-slate-200 mb-3 divide-y divide-slate-100">
          <div className="px-3 py-2 text-xs text-slate-500">Mehrere Treffer – bitte wählen:</div>
          {treffer.map((t) => (
            <button
              key={`${t.lat},${t.lng}`}
              onClick={() => uebernehmen(t)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              {t.bezeichnung}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Betriebstage">
          <input className={inputClass} value={draft.operatingHours.days} onChange={(e) => setDraft({ ...draft, operatingHours: { ...draft.operatingHours, days: e.target.value } })} />
        </Field>
        <Field label="Von">
          <input type="time" className={inputClass} value={draft.operatingHours.open} onChange={(e) => setDraft({ ...draft, operatingHours: { ...draft.operatingHours, open: e.target.value } })} />
        </Field>
        <Field label="Bis">
          <input type="time" className={inputClass} value={draft.operatingHours.close} onChange={(e) => setDraft({ ...draft, operatingHours: { ...draft.operatingHours, close: e.target.value } })} />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm mb-3">
        <input type="checkbox" className="mt-0.5" checked={geoEnabled} onChange={(e) => geofenceUmschalten(e.target.checked)} />
        Geofence hinterlegen – die App meldet Betreten und Verlassen dieses Umkreises (nur den Standort-Namen, kein GPS)
      </label>

      {geoEnabled && (
        <div className="space-y-3">
          <Suspense fallback={<div className="rounded-xl border border-slate-200 bg-slate-50 animate-pulse" style={{ height: 300 }} />}>
            <StandortKarte
              punkt={{ lat: geo.lat, lng: geo.lng }}
              radiusM={geo.radiusM}
              onPunkt={(p) => setGeo((g) => ({ ...g, ...p }))}
            />
          </Suspense>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Radius (m)" className="w-40 mb-0">
              <input
                type="number" min={50} max={5000} step={10} className={inputClass}
                value={geo.radiusM}
                onChange={(e) => setGeo({ ...geo, radiusM: Math.max(50, Number(e.target.value) || 0) })}
              />
            </Field>
            <p className="text-xs text-slate-500 flex-1 min-w-[14rem]">
              Marker ziehen oder in die Karte tippen, um den Mittelpunkt zu setzen. Der Kreis zeigt
              den Radius im Massstab der Karte.
            </p>
          </div>

          {/* Für den Fall, dass die Karte nicht lädt, oder wenn Koordinaten aus einer
              anderen Quelle übernommen werden sollen */}
          <div>
            <button
              onClick={() => setZahlenOffen(!zahlenOffen)}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              {zahlenOffen ? 'Koordinaten ausblenden' : 'Koordinaten von Hand eingeben'}
            </button>
            {zahlenOffen && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Field label="Breitengrad">
                  <input type="number" step="0.000001" className={inputClass} value={geo.lat} onChange={(e) => setGeo({ ...geo, lat: Number(e.target.value) })} />
                </Field>
                <Field label="Längengrad">
                  <input type="number" step="0.000001" className={inputClass} value={geo.lng} onChange={(e) => setGeo({ ...geo, lng: Number(e.target.value) })} />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.name.trim()}>Speichern</Button>
      </div>
    </Modal>
  )
}
