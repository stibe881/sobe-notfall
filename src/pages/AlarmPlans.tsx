import { useState } from 'react'
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import type { AlarmPlan, Channel, EscalationLevel } from '../types'
import { CHANNEL_LABELS } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, useConfirm, VORBEREITET, Vorbereitet, kanalName } from '../components/ui'
import { ScenarioIcon } from '../components/ScenarioIcon'

const ALL_CHANNELS: Channel[] = ['push', 'sms', 'email', 'voice', 'conference', 'tts', 'teams']

export default function AlarmPlans() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<AlarmPlan | null>(null)
  const { ask, confirmEl } = useConfirm()

  function newPlan(): AlarmPlan {
    return {
      id: uid('pl'), name: '', locationIds: [], groupIds: [], channels: ['push', 'sms'],
      requireAck: false, respectOperatingHours: false, escalation: [],
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alarmpläne</h1>
          <p className="text-sm text-slate-500">
            Individuell konfigurierbare Alarmierungspläne mit Eskalationsstufen – dynamisch anpassbar an sich ändernde Bedingungen
          </p>
        </div>
        <Button onClick={() => setEditing(newPlan())}><Plus size={16} /> Neuer Alarmplan</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {state.plans.map((p) => {
          const scenario = state.scenarios.find((s) => s.id === p.scenarioId)
          return (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <ClipboardList size={22} className="text-slate-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="text-sm text-slate-500 flex items-center gap-1.5">
                    {scenario ? (
                      <>
                        <ScenarioIcon name={scenario.icon} size={15} className="text-slate-400" /> {scenario.title}
                      </>
                    ) : (
                      'ohne festes Szenario'
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.channels.map((c) => <Badge key={c} color="blue">{kanalName(c)}</Badge>)}
                    {p.requireAck && <Badge color="violet">Quittierung</Badge>}
                    {p.respectOperatingHours && <Badge color="amber">nur Betriebszeiten</Badge>}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Zielgruppen: {p.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || 'alle'}
                    {' · '}Standorte: {p.locationIds.map((l) => state.locations.find((x) => x.id === l)?.name).filter(Boolean).join(', ') || 'alle'}
                  </div>
                  {p.escalation.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.escalation.map((e, i) => (
                        <div key={i} className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                          Stufe {i + 1} nach {e.afterMinutes} Min.: {e.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).join(', ')} via{' '}
                          {e.channels.map(kanalName).join(', ')}
                          {e.notifyEmergencyServices && ' + Blaulichtorganisationen (vorbereitet)'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" onClick={() => setEditing(p)}><Pencil size={14} /></Button>
                <Button variant="ghost" onClick={() => ask(`Alarmplan «${p.name}» löschen?`, () => dispatch({ type: 'DELETE_PLAN', planId: p.id }))}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {confirmEl}
      {editing && <PlanEditor plan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: AlarmPlan
  onClose: () => void
  /** Wird aufgerufen, wenn tatsächlich gespeichert wurde (nicht bei Abbrechen) */
  onSaved?: (plan: AlarmPlan) => void
}) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<AlarmPlan>(JSON.parse(JSON.stringify(plan)))

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function updateEscalation(i: number, patch: Partial<EscalationLevel>) {
    setDraft({ ...draft, escalation: draft.escalation.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  return (
    <Modal title={plan.name ? `Alarmplan: ${plan.name}` : 'Neuer Alarmplan'} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Verknüpftes Szenario">
          <select className={inputClass} value={draft.scenarioId ?? ''} onChange={(e) => setDraft({ ...draft, scenarioId: e.target.value || undefined })}>
            <option value="">–</option>
            {state.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Zielgruppen">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {state.groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.groupIds.includes(g.id)} onChange={() => setDraft({ ...draft, groupIds: toggleIn(draft.groupIds, g.id) })} />
                {g.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Standorte (leer = alle)">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {state.locations.map((l) => (
              <label key={l.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.locationIds.includes(l.id)} onChange={() => setDraft({ ...draft, locationIds: toggleIn(draft.locationIds, l.id) })} />
                {l.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Kanäle (Erstaussand)">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {ALL_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.channels.includes(c)} onChange={() => setDraft({ ...draft, channels: toggleIn(draft.channels, c) })} />
                {CHANNEL_LABELS[c]} {c !== 'push' && <Vorbereitet />}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-5 my-4">
        <Toggle checked={draft.requireAck} onChange={(v) => setDraft({ ...draft, requireAck: v })} label="Aufgebot mit Quittierfunktion" />
        <Toggle checked={draft.respectOperatingHours} onChange={(v) => setDraft({ ...draft, respectOperatingHours: v })} label={`Nur während Betriebszeiten alarmieren – ${VORBEREITET}`} />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-700 text-sm">Eskalationsstufen (zünden, solange nicht alle quittiert haben)</h4>
          <Button
            variant="secondary"
            onClick={() => setDraft({ ...draft, escalation: [...draft.escalation, { afterMinutes: 5, channels: ['voice'], groupIds: [], notifyEmergencyServices: false }] })}
          >
            <Plus size={14} /> Stufe
          </Button>
        </div>
        {draft.escalation.map((esc, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 mb-2 text-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium text-slate-700">Stufe {i + 1}</span>
              <label className="flex items-center gap-1.5">
                nach
                <input
                  type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-0.5"
                  value={esc.afterMinutes}
                  onChange={(e) => updateEscalation(i, { afterMinutes: Number(e.target.value) })}
                />
                Min.
              </label>
              <Button variant="ghost" className="ml-auto" onClick={() => setDraft({ ...draft, escalation: draft.escalation.filter((_, j) => j !== i) })}>
                <Trash2 size={14} />
              </Button>
            </div>
            <label className="flex flex-wrap items-center gap-1.5 mb-3">
              <input type="checkbox" checked={esc.notifyEmergencyServices} onChange={(e) => updateEscalation(i, { notifyEmergencyServices: e.target.checked })} />
              Blaulichtorganisationen benachrichtigen <Vorbereitet />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-1">Zusätzliche Gruppen</div>
                <div className="flex flex-wrap gap-2">
                  {state.groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={esc.groupIds.includes(g.id)} onChange={() => updateEscalation(i, { groupIds: toggleIn(esc.groupIds, g.id) })} />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Kanäle</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={esc.channels.includes(c)} onChange={() => updateEscalation(i, { channels: toggleIn(esc.channels, c) })} />
                      {kanalName(c)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button
          onClick={() => { dispatch({ type: 'UPSERT_PLAN', plan: draft }); onSaved?.(draft); onClose() }}
          disabled={!draft.name.trim()}
        >
          Speichern
        </Button>
      </div>
    </Modal>
  )
}
