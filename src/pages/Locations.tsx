import { Suspense, lazy, useState } from 'react'
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import type { Location } from '../types'
import { Badge, Button, Card, Field, Modal, inputClass, useConfirm } from '../components/ui'
// Leaflet samt Kartenstil nur laden, wenn ein Standort bearbeitet wird – das
// hält das Bündel für alle anderen Seiten klein
const StandortKarte = lazy(() => import('../components/StandortKarte').then((m) => ({ default: m.StandortKarte })))
import { sucheAdresse, type Fundstelle } from '../lib/geokodierung'
import { MAX_PUNKTE, MIN_PUNKTE, flaecheM2, startViereck, umschliessenderKreis, type Punkt } from '../lib/umriss'

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
                      ? (
                        <Badge color={state.integrations.geofencing ? 'green' : 'slate'}>
                          <MapPin size={12} /> Geofence{' '}
                          {l.geofence.punkte?.length
                            ? `Umriss mit ${l.geofence.punkte.length} Punkten`
                            : `Umkreis ${l.geofence.radiusM} m`}
                          {state.integrations.geofencing ? ' · aktiv' : ' · Geofencing unter Integrationen ausgeschaltet'}
                        </Badge>
                      )
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

/** Wert für ein Zeitfeld: gültiges HH:MM, «24:00» wird zu «23:59» */
function zeitOderLeer(wert: string): string {
  if (wert === '24:00') return '23:59'
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(wert) ? wert : ''
}

function LocationEditor({ location, onClose }: { location: Location; onClose: () => void }) {
  const { dispatch } = useStore()
  const [draft, setDraft] = useState<Location>(() => ({
    ...location,
    // «24:00» kennt ein Zeitfeld nicht – es bliebe leer und wäre beim Speichern
    // stillschweigend weg. Rund um die Uhr heisst hier 00:00 bis 23:59.
    operatingHours: {
      ...location.operatingHours,
      open: zeitOderLeer(location.operatingHours.open),
      close: zeitOderLeer(location.operatingHours.close),
    },
  }))
  const [geoEnabled, setGeoEnabled] = useState(!!location.geofence)
  /**
   * Eckpunkte des Umrisses. Ein früher als Kreis erfasster Standort wird beim
   * Öffnen in ein Viereck umgewandelt, das sich zurechtziehen lässt – sonst
   * müsste er ganz neu erfasst werden.
   */
  const [punkte, setPunkte] = useState<Punkt[]>(() => {
    const g = location.geofence
    if (!g) return []
    if (g.punkte && g.punkte.length >= MIN_PUNKTE) return g.punkte
    return startViereck({ lat: g.lat, lng: g.lng }, Math.min(g.radiusM * 1.4, 400))
  })
  const [suchLauft, setSuchLauft] = useState(false)
  const [treffer, setTreffer] = useState<Fundstelle[] | null>(null)
  const [suchFehler, setSuchFehler] = useState<string | null>(null)
  const [zahlenOffen, setZahlenOffen] = useState(false)

  const genugPunkte = punkte.length >= MIN_PUNKTE
  const kreis = genugPunkte ? umschliessenderKreis(punkte) : null
  const flaeche = genugPunkte ? flaecheM2(punkte) : 0

  function save() {
    // Kreis und Mittelpunkt werden aus dem Umriss gerechnet: Sie sind das,
    // was die Betriebssysteme überwachen können.
    const geofence = geoEnabled && kreis ? { ...kreis, punkte } : undefined
    dispatch({ type: 'UPSERT_LOCATION', location: { ...draft, geofence } })
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
        setSuchFehler('Zu dieser Adresse wurde nichts gefunden. Umriss in der Karte selbst zeichnen.')
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
    if (an && punkte.length < MIN_PUNKTE && draft.address.trim().length >= 3) void adresseSuchen()
  }

  /**
   * Treffer übernehmen. Ist noch kein Umriss gezeichnet, wird ein Viereck um
   * die Adresse gelegt – es lässt sich an den Ecken zurechtziehen, statt bei
   * null anzufangen. Ein bestehender Umriss bleibt unangetastet.
   */
  function uebernehmen(f: Fundstelle) {
    if (punkte.length < MIN_PUNKTE) setPunkte(startViereck({ lat: f.lat, lng: f.lng }))
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
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
          <Suspense fallback={<div className="rounded-xl border border-slate-200 bg-slate-50 animate-pulse" style={{ height: 320 }} />}>
            <StandortKarte punkte={punkte} onPunkte={setPunkte} />
          </Suspense>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className={genugPunkte ? 'text-slate-600' : 'text-alarm-600 font-medium'}>
              <b>{punkte.length}</b> von {MAX_PUNKTE} Eckpunkten
              {genugPunkte
                ? ` · rund ${flaeche < 10000 ? `${Math.round(flaeche)} m²` : `${(flaeche / 10000).toFixed(2)} ha`}`
                : ` · mindestens ${MIN_PUNKTE} nötig`}
            </span>
            {punkte.length > 0 && (
              <button onClick={() => setPunkte([])} className="text-slate-500 hover:text-slate-800 underline underline-offset-2">
                Umriss verwerfen
              </button>
            )}
            {punkte.length > 0 && punkte.length < MAX_PUNKTE && (
              <span className="text-slate-400">In die Karte tippen setzt weitere Punkte.</span>
            )}
            {punkte.length >= MAX_PUNKTE && (
              <span className="text-slate-400">Mehr als {MAX_PUNKTE} Punkte sind nicht vorgesehen.</span>
            )}
          </div>

          <p className="text-xs text-slate-500">
            In die Karte tippen setzt einen Eckpunkt, Ziehen verschiebt ihn, Doppeltippen entfernt ihn.
            Der gestrichelte Kreis zeigt, was das Telefon überwacht: iOS und Android kennen nur
            kreisförmige Bereiche. Er weckt die App an der Grenze &ndash; ob jemand am Standort ist,
            entscheidet danach der Umriss.
          </p>

          {/* Für den Fall, dass die Karte nicht lädt, oder wenn Koordinaten aus einer
              anderen Quelle übernommen werden sollen */}
          <div>
            <button
              onClick={() => setZahlenOffen(!zahlenOffen)}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              {zahlenOffen ? 'Eckpunkte ausblenden' : 'Eckpunkte als Zahlen bearbeiten'}
            </button>
            {zahlenOffen && (
              <div className="mt-2 space-y-2">
                {punkte.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-alarm-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="number" step="0.000001" aria-label={`Breitengrad Punkt ${i + 1}`}
                      className={inputClass} value={p.lat}
                      onChange={(e) => setPunkte(punkte.map((q, j) => (j === i ? { ...q, lat: Number(e.target.value) } : q)))}
                    />
                    <input
                      type="number" step="0.000001" aria-label={`Längengrad Punkt ${i + 1}`}
                      className={inputClass} value={p.lng}
                      onChange={(e) => setPunkte(punkte.map((q, j) => (j === i ? { ...q, lng: Number(e.target.value) } : q)))}
                    />
                    <Button variant="ghost" onClick={() => setPunkte(punkte.filter((_, j) => j !== i))} title="Punkt entfernen">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {punkte.length < MAX_PUNKTE && (
                  <Button
                    variant="secondary"
                    onClick={() => setPunkte([...punkte, punkte[punkte.length - 1] ?? { lat: 47.3769, lng: 8.5417 }])}
                  >
                    <Plus size={13} /> Punkt anfügen
                  </Button>
                )}
              </div>
            )}
          </div>

          {!genugPunkte && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Ohne mindestens {MIN_PUNKTE} Eckpunkte lässt sich kein Umriss speichern. Der Geofence
              bleibt dann ausgeschaltet.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.name.trim() || (geoEnabled && !genugPunkte)}>Speichern</Button>
      </div>
    </Modal>
  )
}
