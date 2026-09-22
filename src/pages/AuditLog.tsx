import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Card, formatDateTime, inputClass } from '../components/ui'

const TYPE_COLORS: Record<string, 'red' | 'blue' | 'violet' | 'amber' | 'green' | 'slate'> = {
  alarm: 'red',
  anmeldung: 'blue',
  admin: 'blue',
  cms: 'violet',
  alleinarbeit: 'amber',
  hardware: 'green',
  integration: 'slate',
  system: 'slate',
}

/** Klartext zu den Kategorien, die der Alarmserver schreibt */
const TYPE_LABELS: Record<string, string> = {
  alarm: 'Alarm',
  anmeldung: 'Anmeldung',
  alleinarbeit: 'Alleinarbeit',
  admin: 'Verwaltung',
  system: 'System',
  cms: 'Inhalte',
  hardware: 'Geräte',
  integration: 'Integrationen',
}

const typeLabel = (t: string) => TYPE_LABELS[t] ?? t

/** Zeitraum-Schnellwahl in Tagen; null bedeutet: ohne Begrenzung */
const ZEITRAEUME: { label: string; tage: number | null }[] = [
  { label: 'Heute', tage: 0 },
  { label: '7 Tage', tage: 7 },
  { label: '30 Tage', tage: 30 },
  { label: 'Alles', tage: null },
]

/** `YYYY-MM-DD` in Ortszeit – passend zum Wert eines Datumsfeldes */
function alsDatumswert(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Beginn des Tages in Ortszeit; leere Eingabe ergibt keine Grenze */
function tagesBeginn(wert: string): number | null {
  if (!wert) return null
  const t = new Date(`${wert}T00:00:00`).getTime()
  return Number.isNaN(t) ? null : t
}

/** Ende des Tages – damit der gewählte «bis»-Tag vollständig enthalten ist */
function tagesEnde(wert: string): number | null {
  const beginn = tagesBeginn(wert)
  return beginn === null ? null : beginn + 24 * 3600_000 - 1
}

export default function AuditLog() {
  const { state } = useStore()
  const [suche, setSuche] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [uebung, setUebung] = useState<'alle' | 'ernst' | 'uebung'>('alle')
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')

  const istUebung = (nachricht: string) => nachricht.startsWith('ÜBUNG')
  const types = [...new Set(state.audit.map((e) => e.type))].sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)))

  function zeitraumWaehlen(tage: number | null): void {
    if (tage === null) {
      setVon('')
      setBis('')
      return
    }
    setVon(alsDatumswert(Date.now() - tage * 24 * 3600_000))
    setBis(alsDatumswert(Date.now()))
  }

  /**
   * Durchsucht Text, Kategorie (Kürzel wie Klartext) und die auslösende Person
   * (Name und E-Mail). Mehrere Wörter werden mit UND verknüpft, damit sich eine
   * Suche wie «müller alarm» schrittweise eingrenzen lässt.
   */
  const entries = useMemo(() => {
    const begriffe = suche.toLowerCase().split(/\s+/).filter(Boolean)
    const vonTs = tagesBeginn(von)
    const bisTs = tagesEnde(bis)
    return state.audit.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false
      if (uebung !== 'alle' && (uebung === 'uebung') !== istUebung(e.message)) return false
      if (vonTs !== null && e.ts < vonTs) return false
      if (bisTs !== null && e.ts > bisTs) return false
      if (begriffe.length === 0) return true
      const user = e.userId ? state.users.find((u) => u.id === e.userId) : undefined
      const heuhaufen = [
        e.message,
        e.type,
        typeLabel(e.type),
        user ? `${user.firstName} ${user.lastName}` : '',
        user?.email ?? '',
      ].join(' ').toLowerCase()
      return begriffe.every((b) => heuhaufen.includes(b))
    })
  }, [state.audit, state.users, suche, typeFilter, uebung, von, bis])

  const gefiltert = suche !== '' || typeFilter !== '' || uebung !== 'alle' || von !== '' || bis !== ''

  function zuruecksetzen(): void {
    setSuche('')
    setTypeFilter('')
    setUebung('alle')
    setVon('')
    setBis('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ereignisprotokoll</h1>
        <p className="text-sm text-slate-500">Revisionssicheres Journal aller Aktionen – Alarme, Verwaltung, Konfiguration</p>
      </div>

      <Card>
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[16rem]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inputClass + ' pl-9'}
                placeholder="Suchen nach Text, Kategorie oder Person…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>
            <select className={inputClass + ' max-w-[12rem]'} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
            <div className="flex gap-1">
              {([['alle', 'Alles'], ['ernst', 'Ernstfälle'], ['uebung', 'Übungen']] as const).map(([wert, label]) => (
                <button
                  key={wert}
                  onClick={() => setUebung(wert)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${uebung === wert ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-slate-500">Zeitraum</span>
            <div className="flex gap-1">
              {ZEITRAEUME.map((z) => (
                <button
                  key={z.label}
                  onClick={() => zeitraumWaehlen(z.tage)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900 transition"
                >
                  {z.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Zeitraum von"
                className={inputClass + ' w-auto'}
                value={von}
                max={bis || undefined}
                onChange={(e) => setVon(e.target.value)}
              />
              <span className="text-xs text-slate-400">bis</span>
              <input
                type="date"
                aria-label="Zeitraum bis"
                className={inputClass + ' w-auto'}
                value={bis}
                min={von || undefined}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {gefiltert ? `${entries.length} von ${state.audit.length} Einträgen` : `${state.audit.length} Einträge`}
            </span>
            {gefiltert && (
              <button onClick={zuruecksetzen} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 underline">
                <X size={12} /> Filter zurücksetzen
              </button>
            )}
            <span className="text-slate-400">Der Alarmserver führt die letzten 300 Einträge.</span>
          </div>
        </div>

        <div className="space-y-1">
          {entries.map((e) => {
            const user = e.userId ? state.users.find((u) => u.id === e.userId) : undefined
            return (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-xs text-slate-400 whitespace-nowrap w-32 shrink-0 mt-0.5">{formatDateTime(e.ts)}</span>
                <Badge color={TYPE_COLORS[e.type] ?? 'slate'}>{typeLabel(e.type)}</Badge>
                {istUebung(e.message) && <Badge color="amber">Übung</Badge>}
                <span className="text-slate-700 flex-1">{e.message}</span>
                {user && <span className="text-xs text-slate-400 whitespace-nowrap">{user.firstName} {user.lastName}</span>}
              </div>
            )
          })}
          {entries.length === 0 && (
            <div className="text-sm text-slate-400 py-6 text-center">
              {gefiltert ? 'Keine Einträge für diese Suche.' : 'Keine Einträge.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
