import { useState } from 'react'
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { uid, useStore } from '../store'
import type { AlarmPlan, Channel, EscalationLevel } from '../types'
import { CHANNEL_LABELS } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, useConfirm, VORBEREITET, Vorbereitet, kanalName } from '../components/ui'
import { AuswahlChip, Wizard } from '../components/Wizard'
import { ScenarioIcon } from '../components/ScenarioIcon'

const ALL_CHANNELS: Channel[] = ['push', 'sms', 'email', 'voice', 'conference', 'tts', 'teams']

export default function AlarmPlans() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<AlarmPlan | null>(null)
  const [wizardOffen, setWizardOffen] = useState(false)
  const { ask, confirmEl } = useConfirm()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alarmpläne</h1>
          <p className="text-sm text-slate-500">
            Individuell konfigurierbare Alarmierungspläne mit Eskalationsstufen – dynamisch anpassbar an sich ändernde Bedingungen
          </p>
        </div>
        <Button onClick={() => setWizardOffen(true)}><Plus size={16} /> Neuer Alarmplan</Button>
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
      {wizardOffen && <PlanWizard onClose={() => setWizardOffen(false)} />}
    </div>
  )
}

function PlanEditor({ plan, onClose }: { plan: AlarmPlan; onClose: () => void }) {
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
        <Button onClick={() => { dispatch({ type: 'UPSERT_PLAN', plan: draft }); onClose() }} disabled={!draft.name.trim()}>Speichern</Button>
      </div>
    </Modal>
  )
}

// ---------- Assistent für neue Alarmpläne ----------

/**
 * Fünf Schritte statt einer langen Maske: Grundlagen (mit Szenario-Auswahl als
 * Karten – Kanäle und Gruppen werden vom gewählten Szenario übernommen),
 * Empfänger, Kanäle & Optionen, Eskalationsstufen, Zusammenfassung.
 * Der bestehende Editor bleibt fürs Bearbeiten.
 */
function PlanWizard({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<AlarmPlan>(() => ({
    id: uid('pl'), name: '', locationIds: [], groupIds: [], channels: ['push', 'sms'],
    requireAck: false, respectOperatingHours: false, escalation: [],
  }))
  const [uebernommenVon, setUebernommenVon] = useState<string | null>(null)

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function szenarioWaehlen(id: string | undefined) {
    if (!id) {
      setDraft({ ...draft, scenarioId: undefined })
      setUebernommenVon(null)
      return
    }
    const s = state.scenarios.find((x) => x.id === id)
    setDraft({
      ...draft,
      scenarioId: id,
      channels: s?.defaultChannels.length ? [...s.defaultChannels] : draft.channels,
      groupIds: s?.responsibleGroupIds.length ? [...s.responsibleGroupIds] : draft.groupIds,
    })
    setUebernommenVon(s && (s.defaultChannels.length || s.responsibleGroupIds.length) ? s.title : null)
  }

  function updateEscalation(i: number, patch: Partial<EscalationLevel>) {
    setDraft({ ...draft, escalation: draft.escalation.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  const szenario = state.scenarios.find((s) => s.id === draft.scenarioId)

  return (
    <Wizard
      titel="Neuen Alarmplan erstellen"
      untertitel="In fünf Schritten zum einsatzbereiten Alarmplan – jederzeit später anpassbar."
      fertigLabel="Alarmplan erstellen"
      onFertig={() => { dispatch({ type: 'UPSERT_PLAN', plan: draft }); onClose() }}
      onClose={onClose}
      schritte={[
        {
          titel: 'Grundlagen',
          hinweis: 'Name des Plans und das Szenario, für das er gilt. Kanäle und Gruppen werden vom Szenario übernommen.',
          gueltig: !!draft.name.trim(),
          inhalt: (
            <>
              <Field label="Name des Alarmplans">
                <input
                  autoFocus className={inputClass} placeholder="z. B. Brandalarm Hauptgebäude"
                  value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Verknüpftes Szenario">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  <button
                    type="button" onClick={() => szenarioWaehlen(undefined)}
                    className={`rounded-xl border p-3 text-left transition ${
                      !draft.scenarioId ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <ClipboardList size={20} className="text-slate-400 mb-1.5" />
                    <div className="text-sm font-medium text-slate-700">Ohne festes Szenario</div>
                    <div className="text-[11px] text-slate-400">freier Plan</div>
                  </button>
                  {state.scenarios.map((s) => (
                    <button
                      key={s.id} type="button" onClick={() => szenarioWaehlen(s.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        draft.scenarioId === s.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <ScenarioIcon name={s.icon} size={20} className={`mb-1.5 ${draft.scenarioId === s.id ? 'text-brand-600' : 'text-slate-400'}`} />
                      <div className="text-sm font-medium text-slate-700 leading-tight">{s.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{s.category}</div>
                    </button>
                  ))}
                </div>
              </Field>
              {uebernommenVon && (
                <p className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                  Kanäle und Zielgruppen wurden vom Szenario «{uebernommenVon}» übernommen – in den nächsten Schritten anpassbar.
                </p>
              )}
            </>
          ),
        },
        {
          titel: 'Empfänger',
          hinweis: 'Wen erreicht dieser Plan? Ohne Auswahl gilt er für alle Gruppen bzw. alle Standorte.',
          gueltig: true,
          inhalt: (
            <>
              <Field label="Zielgruppen (leer = alle)">
                <div className="flex flex-wrap gap-2">
                  {state.groups.map((g) => (
                    <AuswahlChip key={g.id} aktiv={draft.groupIds.includes(g.id)} onClick={() => setDraft({ ...draft, groupIds: toggleIn(draft.groupIds, g.id) })}>
                      {g.name}
                    </AuswahlChip>
                  ))}
                </div>
              </Field>
              <Field label="Standorte (leer = alle)">
                <div className="flex flex-wrap gap-2">
                  {state.locations.map((l) => (
                    <AuswahlChip key={l.id} aktiv={draft.locationIds.includes(l.id)} onClick={() => setDraft({ ...draft, locationIds: toggleIn(draft.locationIds, l.id) })}>
                      {l.name}
                    </AuswahlChip>
                  ))}
                </div>
              </Field>
            </>
          ),
        },
        {
          titel: 'Kanäle & Optionen',
          hinweis: 'Über welche Kanäle geht der Erstaussand – und muss quittiert werden?',
          gueltig: draft.channels.length > 0,
          inhalt: (
            <>
              <Field label="Kanäle für den Erstaussand (mindestens einer)">
                <div className="flex flex-wrap gap-2">
                  {ALL_CHANNELS.map((c) => (
                    <AuswahlChip key={c} aktiv={draft.channels.includes(c)} onClick={() => setDraft({ ...draft, channels: toggleIn(draft.channels, c) })}>
                      {kanalName(c)}
                    </AuswahlChip>
                  ))}
                </div>
              </Field>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <Toggle checked={draft.requireAck} onChange={(v) => setDraft({ ...draft, requireAck: v })} label="Aufgebot mit Quittierfunktion" />
                  <p className="text-xs text-slate-500 mt-1 ml-11">
                    Empfänger:innen bestätigen den Erhalt – die Eskalationsstufen zünden nur, solange nicht alle quittiert haben.
                  </p>
                </div>
                <Toggle checked={draft.respectOperatingHours} onChange={(v) => setDraft({ ...draft, respectOperatingHours: v })} label={`Nur während Betriebszeiten alarmieren – ${VORBEREITET}`} />
              </div>
            </>
          ),
        },
        {
          titel: 'Eskalation',
          hinweis: 'Optional: Wer wird zusätzlich alarmiert, wenn nach einigen Minuten nicht alle quittiert haben?',
          gueltig: true,
          inhalt: (
            <>
              {draft.escalation.length === 0 && (
                <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-xl px-4 py-6 text-center mb-3">
                  Noch keine Eskalationsstufen – der Plan alarmiert dann nur einmal über die gewählten Kanäle.
                </p>
              )}
              {draft.escalation.map((esc, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3 mb-2 text-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    <label className="flex items-center gap-1.5">
                      nach
                      <input
                        type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-0.5"
                        value={esc.afterMinutes}
                        onChange={(e) => updateEscalation(i, { afterMinutes: Number(e.target.value) })}
                      />
                      Min. ohne vollständige Quittierung
                    </label>
                    <Button variant="ghost" className="ml-auto" onClick={() => setDraft({ ...draft, escalation: draft.escalation.filter((_, j) => j !== i) })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">Zusätzliche Gruppen</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {state.groups.map((g) => (
                      <AuswahlChip key={g.id} aktiv={esc.groupIds.includes(g.id)} onClick={() => updateEscalation(i, { groupIds: toggleIn(esc.groupIds, g.id) })}>
                        {g.name}
                      </AuswahlChip>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mb-1">Kanäle dieser Stufe</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ALL_CHANNELS.map((c) => (
                      <AuswahlChip key={c} aktiv={esc.channels.includes(c)} onClick={() => updateEscalation(i, { channels: toggleIn(esc.channels, c) })}>
                        {kanalName(c)}
                      </AuswahlChip>
                    ))}
                  </div>
                  <label className="flex flex-wrap items-center gap-1.5">
                    <input type="checkbox" checked={esc.notifyEmergencyServices} onChange={(e) => updateEscalation(i, { notifyEmergencyServices: e.target.checked })} />
                    Blaulichtorganisationen benachrichtigen <Vorbereitet />
                  </label>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setDraft({ ...draft, escalation: [...draft.escalation, { afterMinutes: 5, channels: ['voice'], groupIds: [], notifyEmergencyServices: false }] })}
              >
                <Plus size={14} /> Eskalationsstufe hinzufügen
              </Button>
            </>
          ),
        },
        {
          titel: 'Zusammenfassung',
          hinweis: 'Kurz prüfen – danach steht der Plan sofort bei der Alarmauslösung zur Verfügung.',
          gueltig: true,
          inhalt: (
            <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl bg-white border border-brand-200 flex items-center justify-center shrink-0">
                  {szenario
                    ? <ScenarioIcon name={szenario.icon} size={24} className="text-brand-600" />
                    : <ClipboardList size={24} className="text-brand-600" />}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{draft.name.trim() || 'Ohne Namen'}</div>
                  <div className="text-sm text-slate-500">{szenario ? `Szenario: ${szenario.title}` : 'ohne festes Szenario'}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {draft.channels.map((c) => <Badge key={c} color="blue">{kanalName(c)}</Badge>)}
                    {draft.requireAck && <Badge color="violet">Quittierung</Badge>}
                    {draft.respectOperatingHours && <Badge color="amber">nur Betriebszeiten</Badge>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 space-y-1">
                <div>Zielgruppen: {draft.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || 'alle'}</div>
                <div>Standorte: {draft.locationIds.map((l) => state.locations.find((x) => x.id === l)?.name).filter(Boolean).join(', ') || 'alle'}</div>
              </div>
              {draft.escalation.length > 0 && (
                <div className="mt-3 space-y-1">
                  {draft.escalation.map((e, i) => (
                    <div key={i} className="text-xs text-slate-600 bg-white border border-brand-100 rounded px-2 py-1">
                      Stufe {i + 1} nach {e.afterMinutes} Min.: {e.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || 'gleiche Empfänger'} via {e.channels.map(kanalName).join(', ')}
                      {e.notifyEmergencyServices && ' + Blaulichtorganisationen (vorbereitet)'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
