import { useState } from 'react'
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Location } from '../types'
import { Badge, Button, Card, Field, Modal, inputClass, useConfirm } from '../components/ui'

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

  function save() {
    dispatch({ type: 'UPSERT_LOCATION', location: { ...draft, geofence: geoEnabled ? geo : undefined } })
    onClose()
  }

  return (
    <Modal title={location.name ? `Standort: ${location.name}` : 'Neuer Standort'} onClose={onClose}>
      <Field label="Name">
        <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label="Adresse">
        <input className={inputClass} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
      </Field>
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
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={geoEnabled} onChange={(e) => setGeoEnabled(e.target.checked)} />
        Geofence hinterlegen – die App meldet Betreten und Verlassen dieses Umkreises (nur den Standort-Namen, kein GPS)
      </label>
      {geoEnabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Breitengrad">
            <input type="number" step="0.0001" className={inputClass} value={geo.lat} onChange={(e) => setGeo({ ...geo, lat: Number(e.target.value) })} />
          </Field>
          <Field label="Längengrad">
            <input type="number" step="0.0001" className={inputClass} value={geo.lng} onChange={(e) => setGeo({ ...geo, lng: Number(e.target.value) })} />
          </Field>
          <Field label="Radius (m)">
            <input type="number" className={inputClass} value={geo.radiusM} onChange={(e) => setGeo({ ...geo, radiusM: Number(e.target.value) })} />
          </Field>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.name.trim()}>Speichern</Button>
      </div>
    </Modal>
  )
}
