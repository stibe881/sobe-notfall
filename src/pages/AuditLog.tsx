import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Card, formatDateTime, inputClass, useConfirm } from '../components/ui'

const TYPE_COLORS: Record<string, 'red' | 'blue' | 'violet' | 'amber' | 'green' | 'slate'> = {
  alarm: 'red',
  admin: 'blue',
  cms: 'violet',
  alleinarbeit: 'amber',
  hardware: 'green',
  integration: 'slate',
  system: 'slate',
}

export default function AuditLog() {
  const { state, dispatch } = useStore()
  const [typeFilter, setTypeFilter] = useState('')
  const [uebung, setUebung] = useState<'alle' | 'ernst' | 'uebung'>('alle')
  const { ask, confirmEl } = useConfirm()

  const istUebung = (nachricht: string) => nachricht.startsWith('ÜBUNG')
  const types = [...new Set(state.audit.map((e) => e.type))]
  const entries = state.audit.filter(
    (e) => (!typeFilter || e.type === typeFilter) && (uebung === 'alle' || (uebung === 'uebung') === istUebung(e.message)),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ereignisprotokoll</h1>
          <p className="text-sm text-slate-500">Revisionssicheres Journal aller Aktionen – Alarme, Verwaltung, Konfiguration</p>
        </div>
      </div>

      {confirmEl}
      <Card>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <select className={inputClass + ' max-w-xs'} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Alle Kategorien</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
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
        <div className="space-y-1">
          {entries.map((e) => {
            const user = e.userId ? state.users.find((u) => u.id === e.userId) : undefined
            return (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-xs text-slate-400 whitespace-nowrap w-32 shrink-0 mt-0.5">{formatDateTime(e.ts)}</span>
                <Badge color={TYPE_COLORS[e.type] ?? 'slate'}>{e.type}</Badge>
                {istUebung(e.message) && <Badge color="amber">Übung</Badge>}
                <span className="text-slate-700 flex-1">{e.message}</span>
                {user && <span className="text-xs text-slate-400">{user.firstName} {user.lastName}</span>}
              </div>
            )
          })}
          {entries.length === 0 && <div className="text-sm text-slate-400 py-6 text-center">Keine Einträge.</div>}
        </div>
      </Card>
    </div>
  )
}
