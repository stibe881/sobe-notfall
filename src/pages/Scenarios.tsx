import { useMemo, useState } from 'react'
import { ClipboardList, Eye, EyeOff, Pencil, Phone, Plus, Scale, Trash2, Users, WifiOff } from 'lucide-react'
import { uid, useStore } from '../store'
import type { AlarmPlan, Channel, ResponseStep, Scenario, ScenarioPriority } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, useConfirm, kanalName } from '../components/ui'
import { SCENARIO_ICONS, ScenarioIcon } from '../components/ScenarioIcon'
import { isActive, responseStepsOf } from '../lib/scenarios'
import { PlanEditor } from './AlarmPlans'

const CATEGORIES = ['Schüler:innen', 'Gesundheit', 'Sicherheit', 'Gebäude & Technik', 'Naturereignis', 'Organisation']
const ALL_CHANNELS: Channel[] = ['push', 'sms', 'email', 'voice', 'conference', 'tts', 'teams']

const PRIORITY_META: Record<ScenarioPriority, { label: string; color: 'red' | 'amber' | 'slate' }> = {
  hoch: { label: 'Priorität hoch', color: 'red' },
  mittel: { label: 'Priorität mittel', color: 'amber' },
  tief: { label: 'Priorität tief', color: 'slate' },
}

export default function Scenarios() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Scenario | null>(null)
  const [viewing, setViewing] = useState<Scenario | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const { ask, confirmEl } = useConfirm()
  const [search, setSearch] = useState('')

  function newScenario(): Scenario {
    return {
      id: uid('sc'), icon: 'clipboard-list', title: '', category: 'Organisation', priority: 'mittel',
      instructions: [''], followUp: [], checklist: [''], silentDefault: false,
      defaultChannels: ['push'], responsibleGroupIds: [], contactIds: [], custom: true,
    }
  }

  const categories = useMemo(
    () => [...new Set([...CATEGORIES, ...state.scenarios.map((s) => s.category)])],
    [state.scenarios],
  )

  const filtered = state.scenarios.filter(
    (s) =>
      (!categoryFilter || s.category === categoryFilter) &&
      (!search || s.title.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Szenarien &amp; Checklisten</h1>
          <p className="text-sm text-slate-500">
            {state.scenarios.filter(isActive).length} von {state.scenarios.length} Szenarien sind für Mitarbeitende sichtbar ·
            Ausgegraute Szenarien bleiben erhalten, erscheinen aber weder in der App noch bei der Alarmauslösung ·
            Änderungen werden sofort an alle Apps verteilt
          </p>
        </div>
        <Button onClick={() => setEditing(newScenario())}><Plus size={16} /> Neues Szenario</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className={inputClass + ' max-w-xs'} placeholder="Szenario suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${!categoryFilter ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            Alle
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${c === categoryFilter ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <WifiOff size={14} className="text-emerald-600" />
        Offline-Verfügbarkeit: Alle Szenarien und Checklisten werden lokal auf den Endgeräten zwischengespeichert und sind auch ohne Netz abrufbar.
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((s) => {
          const aktiv = isActive(s)
          const plan = state.plans.find((p) => p.scenarioId === s.id)
          return (
          <Card key={s.id} className={aktiv ? 'hover:shadow transition' : 'transition bg-slate-50 border-dashed'}>
            <div className={`flex items-start gap-3 ${aktiv ? '' : 'opacity-55'}`}>
              <ScenarioIcon name={s.icon} size={28} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800">{s.title}</div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {!aktiv && <Badge color="slate">ausgeblendet</Badge>}
                  <Badge>{s.category}</Badge>
                  <Badge color={PRIORITY_META[s.priority].color}>{PRIORITY_META[s.priority].label}</Badge>
                  {s.silentDefault && <Badge color="violet">stiller Alarm</Badge>}
                  {s.custom && <Badge color="blue">eigenes Szenario</Badge>}
                  {(s.legalBasis?.length ?? 0) > 0 && <Badge color="green">Rechtsgrundlagen</Badge>}
                  {!plan && <Badge color="amber">kein Alarmplan hinterlegt</Badge>}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {s.instructions.length} Sofortmassnahmen · {responseStepsOf(s).length} für Empfänger · {s.checklist.length} Checklistenpunkte
                </div>
                {plan && (
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <ClipboardList size={11} />
                    Alarmplan: {plan.name}
                  </div>
                )}
                {s.responsibleGroupIds.length > 0 && (
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Users size={11} />
                    {s.responsibleGroupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setViewing(s)}>Ansehen</Button>
              <Button
                variant="ghost"
                title={aktiv ? 'Für Mitarbeitende ausblenden' : 'Für Mitarbeitende einblenden'}
                onClick={() => dispatch({ type: 'UPSERT_SCENARIO', scenario: { ...s, active: !aktiv } })}
              >
                {aktiv ? <Eye size={14} /> : <EyeOff size={14} />}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(s)}><Pencil size={14} /></Button>
              <Button variant="ghost" onClick={() => ask(`Szenario «${s.title}» löschen?`, () => dispatch({ type: 'DELETE_SCENARIO', scenarioId: s.id }))}>
                <Trash2 size={14} />
              </Button>
            </div>
          </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-400 py-8">Keine Szenarien gefunden.</div>
        )}
      </div>

      {confirmEl}
      {viewing && <ScenarioDetail scenario={viewing} onClose={() => setViewing(null)} />}
      {editing && <ScenarioEditor scenario={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ScenarioDetail({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const { state } = useStore()
  const contacts = state.contacts.filter((c) => scenario.contactIds.includes(c.id))
  const groups = state.groups.filter((g) => scenario.responsibleGroupIds.includes(g.id))

  return (
    <Modal title={scenario.title} onClose={onClose} wide>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {!isActive(scenario) && <Badge color="slate">ausgeblendet – für Mitarbeitende nicht sichtbar</Badge>}
        <Badge>{scenario.category}</Badge>
        <Badge color={PRIORITY_META[scenario.priority].color}>{PRIORITY_META[scenario.priority].label}</Badge>
        {scenario.silentDefault && <Badge color="violet">stiller Alarm</Badge>}
        {scenario.defaultChannels.map((c) => <Badge key={c} color="blue">{kanalName(c)}</Badge>)}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          {(scenario.callGuidance?.length ?? 0) > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mb-2">Alarmieren – wann anrufen und was sagen</h4>
              <ul className="space-y-1.5 mb-5">
                {scenario.callGuidance!.map((hinweis, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 shrink-0">–</span> {hinweis}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 className="font-semibold text-slate-700 mb-2">Sofortmassnahmen</h4>
          <ol className="space-y-2">
            {scenario.instructions.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span className="text-slate-700 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {responseStepsOf(scenario).length > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2">Wenn Sie diesen Alarm erhalten</h4>
              <ol className="space-y-2">
                {responseStepsOf(scenario).map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="min-w-0 pt-0.5">
                      <span className="text-slate-700">{step.text}</span>
                      <span className="block mt-0.5">
                        {step.groupIds?.length
                          ? step.groupIds.map((id) => <Badge key={id} color="violet">{state.groups.find((g) => g.id === id)?.name ?? id}</Badge>)
                          : <Badge>alle Empfänger:innen</Badge>}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {(scenario.allClearSteps?.length ?? 0) > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2">Nach der Entwarnung</h4>
              <ol className="space-y-1.5">
                {scenario.allClearSteps!.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {scenario.followUp.length > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2">Weiterführende Massnahmen</h4>
              <ul className="space-y-1.5">
                {scenario.followUp.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 shrink-0">–</span> {step}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-slate-700 mb-2">Checkliste</h4>
          <ul className="space-y-1.5">
            {scenario.checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" /> {item}
              </li>
            ))}
          </ul>
          {groups.length > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2 flex items-center gap-1.5"><Users size={14} /> Zuständige Gruppen</h4>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => <Badge key={g.id} color={g.isCrisisTeam ? 'violet' : 'slate'}>{g.name}</Badge>)}
              </div>
            </>
          )}
          {(scenario.legalBasis?.length ?? 0) > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2 flex items-center gap-1.5"><Scale size={14} /> Rechtsgrundlagen</h4>
              <ul className="space-y-1.5">
                {scenario.legalBasis!.map((eintrag, i) => (
                  <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                    <span className="text-slate-400 shrink-0">§</span> {eintrag}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Orientierungshilfe, keine Rechtsberatung. Verbindlich sind die kantonalen Vorgaben und das
                Notfallkonzept der Trägerschaft.
              </p>
            </>
          )}
          {contacts.length > 0 && (
            <>
              <h4 className="font-semibold text-slate-700 mt-5 mb-2 flex items-center gap-1.5"><Phone size={14} /> Relevante Notrufnummern</h4>
              <div className="space-y-1.5">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-brand-600 w-12">{c.number}</span>
                    <span className="text-slate-700">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.description}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ScenarioEditor({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<Scenario>(JSON.parse(JSON.stringify(scenario)))
  // Jedes Szenario braucht einen Alarmplan – bestehender (verknüpfter oder noch freier) oder neu angelegter
  const [planId, setPlanId] = useState(() => state.plans.find((p) => p.scenarioId === scenario.id)?.id ?? '')
  const [newPlanDraft, setNewPlanDraft] = useState<AlarmPlan | null>(null)
  const waehlbarePlaene = state.plans.filter((p) => !p.scenarioId || p.scenarioId === scenario.id)

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function neuerPlan(): AlarmPlan {
    return {
      id: uid('pl'), name: draft.title ? `Alarmplan ${draft.title}` : '', scenarioId: draft.id,
      locationIds: [], groupIds: draft.responsibleGroupIds, channels: draft.defaultChannels.length ? draft.defaultChannels : ['push'],
      requireAck: false, respectOperatingHours: false, escalation: [],
    }
  }

  function save() {
    dispatch({
      type: 'UPSERT_SCENARIO',
      scenario: {
        ...draft,
        callGuidance: (draft.callGuidance ?? []).filter((s) => s.trim()),
        allClearSteps: (draft.allClearSteps ?? []).filter((s) => s.trim()),
        // Altes Feld ohne Gruppen wird beim Speichern endgültig abgelöst
        responseSteps: responseStepsOf(draft).map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text),
        responseInstructions: undefined,
        instructions: draft.instructions.filter((s) => s.trim()),
        followUp: draft.followUp.filter((s) => s.trim()),
        checklist: draft.checklist.filter((s) => s.trim()),
        legalBasis: (draft.legalBasis ?? []).filter((s) => s.trim()),
      },
    })
    // Verknüpfung mit dem Alarmplan nachführen: alten Plan lösen, falls gewechselt; neuen verknüpfen
    const bisherigerPlan = state.plans.find((p) => p.scenarioId === draft.id)
    if (bisherigerPlan && bisherigerPlan.id !== planId) {
      dispatch({ type: 'UPSERT_PLAN', plan: { ...bisherigerPlan, scenarioId: undefined } })
    }
    const neuVerknuepft = state.plans.find((p) => p.id === planId)
    if (neuVerknuepft && neuVerknuepft.scenarioId !== draft.id) {
      dispatch({ type: 'UPSERT_PLAN', plan: { ...neuVerknuepft, scenarioId: draft.id } })
    }
    onClose()
  }

  return (
    <Modal title={scenario.title ? `Szenario bearbeiten: ${scenario.title}` : 'Neues Szenario'} onClose={onClose} wide>
      <Field label="Titel">
        <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </Field>
      <Field label="Alarmplan – wer im Ernstfall alarmiert wird, über welche Kanäle und mit welcher Eskalation">
        <div className="flex gap-2">
          <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">– bitte wählen –</option>
            {waehlbarePlaene.map((p) => <option key={p.id} value={p.id}>{p.name || '(ohne Namen)'}</option>)}
          </select>
          <Button type="button" variant="secondary" onClick={() => setNewPlanDraft(neuerPlan())}>
            <Plus size={14} /> Neu
          </Button>
        </div>
        {!planId && <p className="text-xs text-amber-600 mt-1.5">Ohne Alarmplan lässt sich das Szenario nicht speichern.</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kategorie">
          <select className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Priorität">
          <select className={inputClass} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as ScenarioPriority })}>
            <option value="hoch">Hoch – unmittelbare Gefahr</option>
            <option value="mittel">Mittel – rasches Handeln nötig</option>
            <option value="tief">Tief – geordnetes Vorgehen</option>
          </select>
        </Field>
      </div>
      <Field label="Symbol">
        <div className="grid grid-cols-7 sm:grid-cols-11 gap-2">
          {Object.entries(SCENARIO_ICONS).map(([key, { icon: Icon, label }]) => (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => setDraft({ ...draft, icon: key })}
              className={`flex items-center justify-center rounded-lg border p-2.5 transition ${
                draft.icon === key ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Alarmieren: wann anrufen und was sagen (eine Zeile pro Hinweis)">
        <textarea
          className={inputClass} rows={5}
          placeholder="z. B. Feuerwehr 118 anrufen – bei jedem Brand, auch bei einem kleinen."
          value={(draft.callGuidance ?? []).join('\n')}
          onChange={(e) => setDraft({ ...draft, callGuidance: e.target.value.split('\n') })}
        />
      </Field>
      <Field label="Sofortmassnahmen (eine pro Zeile – klar und präzise, unter Stress verständlich)">
        <textarea
          className={inputClass} rows={6}
          value={draft.instructions.join('\n')}
          onChange={(e) => setDraft({ ...draft, instructions: e.target.value.split('\n') })}
        />
      </Field>
      <EmpfaengerSchritteEditor
        schritte={responseStepsOf(draft)}
        onChange={(responseSteps) => setDraft({ ...draft, responseSteps, responseInstructions: undefined })}
      />
      <Field label="Nach der Entwarnung – was die Alarmierten tun, sobald der Alarm beendet ist (eine pro Zeile)">
        <textarea
          className={inputClass} rows={4}
          placeholder="z. B. Rückkehr ins Gebäude nur nach Freigabe – Klasse erneut zählen."
          value={(draft.allClearSteps ?? []).join('\n')}
          onChange={(e) => setDraft({ ...draft, allClearSteps: e.target.value.split('\n') })}
        />
      </Field>
      <Field label="Weiterführende Massnahmen nach der Akutphase (eine pro Zeile)">
        <textarea
          className={inputClass} rows={4}
          value={draft.followUp.join('\n')}
          onChange={(e) => setDraft({ ...draft, followUp: e.target.value.split('\n') })}
        />
      </Field>
      <Field label="Checkliste (ein Punkt pro Zeile)">
        <textarea
          className={inputClass} rows={4}
          value={draft.checklist.join('\n')}
          onChange={(e) => setDraft({ ...draft, checklist: e.target.value.split('\n') })}
        />
      </Field>
      <Field label="Rechtsgrundlagen (eine pro Zeile) – Orientierungshilfe, keine Rechtsberatung">
        <textarea
          className={inputClass} rows={4}
          placeholder="z. B. StGB Art. 128: Unterlassung der Nothilfe ist strafbar."
          value={(draft.legalBasis ?? []).join('\n')}
          onChange={(e) => setDraft({ ...draft, legalBasis: e.target.value.split('\n') })}
        />
      </Field>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Toggle
          checked={draft.active !== false}
          onChange={(v) => setDraft({ ...draft, active: v })}
          label="Für Mitarbeitende sichtbar"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Ausgeschaltet erscheint das Szenario weder in der App noch bei der Alarmauslösung. Es bleibt in der
          Verwaltung ausgegraut erhalten und lässt sich jederzeit wieder einblenden.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Standard-Alarmkanäle">
          <div className="space-y-1">
            {ALL_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.defaultChannels.includes(c)} onChange={() => setDraft({ ...draft, defaultChannels: toggleIn(draft.defaultChannels, c) })} />
                {kanalName(c)}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Zuständige Gruppen (Vorauswahl beim Auslösen)">
          <div className="space-y-1">
            {state.groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.responsibleGroupIds.includes(g.id)} onChange={() => setDraft({ ...draft, responsibleGroupIds: toggleIn(draft.responsibleGroupIds, g.id) })} />
                {g.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Verknüpfte Notrufnummern">
          <div className="space-y-1">
            {state.contacts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.contactIds.includes(c.id)} onChange={() => setDraft({ ...draft, contactIds: toggleIn(draft.contactIds, c.id) })} />
                {c.number} {c.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <Toggle checked={draft.silentDefault} onChange={(v) => setDraft({ ...draft, silentDefault: v })} label="Standardmässig als stiller Alarm auslösen" />
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={!draft.title.trim() || !planId}>Speichern &amp; sofort verteilen</Button>
      </div>
      {newPlanDraft && (
        <PlanEditor
          plan={newPlanDraft}
          onClose={() => setNewPlanDraft(null)}
          onSaved={(saved) => setPlanId(saved.id)}
        />
      )}
    </Modal>
  )
}

// ---------- Empfängerschritte mit Gruppenzuordnung ----------

/**
 * Ein Schritt pro Zeile, dazu die Gruppen, für die er gilt. Ohne Gruppen gilt
 * er für alle Empfänger:innen. So sieht jede Person in der App nur, was sie
 * selbst betrifft – die Ersthelferin ihren Rucksack, der Hausdienst die Zufahrt.
 */
function EmpfaengerSchritteEditor({ schritte, onChange }: { schritte: ResponseStep[]; onChange: (s: ResponseStep[]) => void }) {
  const { state } = useStore()
  const gruppen = state.groups.filter((g) => g.id !== 'gr-alle')

  function setze(i: number, aenderung: Partial<ResponseStep>) {
    onChange(schritte.map((s, k) => (k === i ? { ...s, ...aenderung } : s)))
  }
  function gruppeUmschalten(i: number, id: string) {
    const aktuell = schritte[i].groupIds ?? []
    setze(i, { groupIds: aktuell.includes(id) ? aktuell.filter((g) => g !== id) : [...aktuell, id] })
  }
  function verschieben(i: number, richtung: -1 | 1) {
    const ziel = i + richtung
    if (ziel < 0 || ziel >= schritte.length) return
    const kopie = [...schritte]
    ;[kopie[i], kopie[ziel]] = [kopie[ziel], kopie[i]]
    onChange(kopie)
  }

  return (
    <div className="mb-3">
      <span className="block text-sm font-medium text-slate-600 mb-1">
        Empfänger: Was tun, wenn Sie diesen Alarm erhalten – kein Notruf, keine erneute Auslösung
      </span>
      <p className="text-xs text-slate-400 mb-2">
        Ohne Gruppe gilt ein Schritt für alle. Mit Gruppen sehen ihn nur deren Mitglieder – die App
        blendet einer Person die Schritte anderer Gruppen aus.
      </p>
      <div className="space-y-2">
        {schritte.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex gap-2 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold mt-1">{i + 1}</span>
              <textarea
                className={`${inputClass} flex-1`} rows={2}
                value={s.text}
                onChange={(e) => setze(i, { text: e.target.value })}
                placeholder="z. B. Kein zweiter Notruf: Die Feuerwehr ist alarmiert."
              />
              <div className="flex flex-col gap-1">
                <Button type="button" variant="ghost" title="Nach oben" onClick={() => verschieben(i, -1)} disabled={i === 0}>↑</Button>
                <Button type="button" variant="ghost" title="Nach unten" onClick={() => verschieben(i, 1)} disabled={i === schritte.length - 1}>↓</Button>
                <Button type="button" variant="ghost" title="Entfernen" onClick={() => onChange(schritte.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 pl-8">
              <button
                type="button"
                onClick={() => setze(i, { groupIds: [] })}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  !s.groupIds?.length ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-500'
                }`}
              >
                alle Empfänger:innen
              </button>
              {gruppen.map((g) => {
                const an = s.groupIds?.includes(g.id) ?? false
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => gruppeUmschalten(i, g.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      an ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 text-slate-500'
                    }`}
                  >
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" className="mt-2" onClick={() => onChange([...schritte, { text: '' }])}>
        + Schritt hinzufügen
      </Button>
    </div>
  )
}
