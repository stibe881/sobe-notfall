import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronUp, Pencil, Search, Siren, Users } from 'lucide-react'
import { createAlarm, resolveRecipients, useStore } from '../store'
import { activeScenarios } from '../lib/scenarios'
import type { AlarmPlan, Channel, Scenario } from '../types'
import { CHANNEL_LABELS } from '../types'
import { Badge, HoldButton, Toggle, Vorbereitet, inputClass, kanalName } from '../components/ui'
import { ScenarioIcon } from '../components/ScenarioIcon'

const ALL_CHANNELS: Channel[] = ['push', 'sms', 'email', 'voice', 'conference', 'tts', 'teams']

const PRIORITY_COLOR = { hoch: 'red', mittel: 'amber', tief: 'slate' } as const

export default function TriggerAlarm() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()

  const [scenarioId, setScenarioId] = useState('')
  const [planId, setPlanId] = useState('')
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<Channel[]>(['push', 'sms'])
  const [groupIds, setGroupIds] = useState<string[]>(['gr-alle'])
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [silent, setSilent] = useState(false)
  const [requireAck, setRequireAck] = useState(false)
  const [drill, setDrill] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const scenario = state.scenarios.find((s) => s.id === scenarioId)
  const recipients = useMemo(() => resolveRecipients(state, groupIds, locationIds), [state, groupIds, locationIds])

  function selectScenario(s: Scenario) {
    setScenarioId(s.id)
    setSilent(s.silentDefault)
    setRequireAck(false)
    if (s.defaultChannels.length > 0) setChannels(s.defaultChannels)
    if (s.responsibleGroupIds.length > 0) setGroupIds(s.responsibleGroupIds)
    setMessage('')
    setAdjustOpen(false)
    window.scrollTo({ top: 0 })
  }

  function applyPlan(id: string) {
    setPlanId(id)
    const plan = state.plans.find((p) => p.id === id)
    if (!plan) return
    if (plan.scenarioId) setScenarioId(plan.scenarioId)
    setChannels(plan.channels)
    setGroupIds(plan.groupIds)
    setLocationIds(plan.locationIds)
    setRequireAck(plan.requireAck)
    const sc = state.scenarios.find((s) => s.id === plan.scenarioId)
    if (sc) setSilent(sc.silentDefault)
    setAdjustOpen(false)
    window.scrollTo({ top: 0 })
  }

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function fire() {
    if (!scenario) return
    const plan: AlarmPlan | undefined = state.plans.find((p) => p.id === planId)
    const alarm = createAlarm(state, {
      scenarioId: scenario.id,
      message: message || `${scenario.title}: Bitte Handlungsanweisungen in der App befolgen.`,
      silent,
      requireAck,
      channels,
      groupIds,
      locationIds,
      triggeredByUserId: state.currentUserId,
      triggeredVia: 'web',
      planId: planId || undefined,
      escalation: plan?.escalation ?? [],
      drill,
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `${drill ? 'Übung' : 'Alarm'} ausgelöst: ${scenario.title} (${recipients.length} Empfänger)` })
    navigate('/monitor')
  }

  // ---------- Schritt 1: Szenario wählen ----------
  if (!scenario) {
    // Deaktivierte Szenarien stehen nicht zur Auswahl
    const auswaehlbar = activeScenarios(state.scenarios)
    const categories = [...new Set(auswaehlbar.map((s) => s.category))]
    const visibleScenarios = auswaehlbar.filter(
      (s) =>
        (!categoryFilter || s.category === categoryFilter) &&
        (!search || s.title.toLowerCase().includes(search.toLowerCase())),
    )
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alarm auslösen</h1>
          <p className="text-sm text-slate-500">Szenario antippen – Empfänger und Kanäle werden automatisch vorbereitet.</p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={inputClass + ' pl-9'}
            placeholder="Szenario suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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

        <select className={inputClass} value={planId} onChange={(e) => applyPlan(e.target.value)}>
          <option value="">Alarmplan anwenden (optional)…</option>
          {state.plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleScenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => selectScenario(s)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.98] hover:border-brand-500"
            >
              <div className="flex items-start justify-between">
                <ScenarioIcon name={s.icon} size={26} className={s.priority === 'hoch' ? 'text-alarm-600' : 'text-slate-500'} />
                {s.silentDefault && <Badge color="violet">still</Badge>}
              </div>
              <div className="font-semibold text-slate-800 leading-tight mt-2">{s.title}</div>
              <div className="text-xs text-slate-400 mt-1">{s.category}</div>
            </button>
          ))}
          {visibleScenarios.length === 0 && (
            <div className="col-span-full text-center text-sm text-slate-400 py-8">Kein Szenario gefunden.</div>
          )}
        </div>
      </div>
    )
  }

  // ---------- Schritt 2: Prüfen & auslösen ----------
  return (
    <div className="max-w-2xl mx-auto pb-40 lg:pb-6">
      <button
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-3"
        onClick={() => { setScenarioId(''); setPlanId('') }}
      >
        <ChevronLeft size={16} /> Anderes Szenario wählen
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <ScenarioIcon name={scenario.icon} size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">{scenario.title}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge color={PRIORITY_COLOR[scenario.priority]}>Priorität {scenario.priority}</Badge>
              {planId && <Badge color="blue">{state.plans.find((p) => p.id === planId)?.name}</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3.5 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Users size={15} />
            {recipients.length} Empfänger werden alarmiert
          </div>
          <div className="text-slate-500">
            {groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || 'Alle Gruppen'}
            {' · '}
            {locationIds.length > 0
              ? locationIds.map((l) => state.locations.find((x) => x.id === l)?.name).filter(Boolean).join(', ')
              : 'alle Standorte'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => <Badge key={c} color="blue">{kanalName(c)}</Badge>)}
            {silent && <Badge color="violet">stiller Alarm</Badge>}
            {requireAck && <Badge color="green">mit Quittierung</Badge>}
            {drill && <Badge color="amber">ÜBUNG</Badge>}
          </div>
          {state.mode === 'live' && !state.integrations.smsGateway.enabled && !state.integrations.telephony.enabled && (
            <div className="text-xs text-amber-700 pt-1">
              Live-Modus ohne SMS-/Anruf-Gateway: Der Alarm geht per Push und an Webhooks, aber nicht per SMS/Anruf.
              Anbindung unter Integrationen.
            </div>
          )}
        </div>

        <button
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setAdjustOpen(!adjustOpen)}
        >
          <Pencil size={14} /> Anpassen {adjustOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {adjustOpen && (
          <div className="mt-3 space-y-5 border-t border-slate-100 pt-4">
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Zielgruppen</div>
              <div className="grid sm:grid-cols-2 gap-1">
                {state.groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggle(groupIds, g.id, setGroupIds)} />
                    {g.name} {g.isCrisisTeam && <Badge color="violet">Krisenteam</Badge>}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Standorte (keine Auswahl = alle)</div>
              <div className="grid sm:grid-cols-2 gap-1">
                {state.locations.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={locationIds.includes(l.id)} onChange={() => toggle(locationIds, l.id, setLocationIds)} />
                    {l.name}
                  </label>
                ))}
              </div>
              <div className="text-xs text-slate-400 mt-1">Abwesende Personen (Ferien) werden automatisch übersprungen.</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Alarmierungskanäle</div>
              <div className="grid sm:grid-cols-2 gap-1">
                {ALL_CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-1 text-sm">
                    <input type="checkbox" checked={channels.includes(c)} onChange={() => toggle(channels, c, setChannels)} />
                    {CHANNEL_LABELS[c]} {c !== 'push' && <Vorbereitet />}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Toggle checked={silent} onChange={setSilent} label="Stiller Alarm (keine Signaltöne)" />
              <Toggle checked={requireAck} onChange={setRequireAck} label="Aufgebot mit Quittierfunktion" />
              <Toggle checked={drill} onChange={setDrill} label="Übung – Mitteilungen tragen den Vorspann «ÜBUNG», das Protokoll kennzeichnet sie" />
            </div>
          </div>
        )}

        <div className="mt-4">
          <textarea
            className={inputClass}
            rows={2}
            placeholder={`Meldung (Standard: "${scenario.title}: Bitte Handlungsanweisungen in der App befolgen.")`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {scenario.instructions.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-100 p-3.5">
            <div className="text-sm font-semibold text-slate-700 mb-2">Sofortmassnahmen (werden mitgesendet)</div>
            <ol className="space-y-1.5">
              {scenario.instructions.slice(0, 3).map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            {scenario.instructions.length > 3 && (
              <div className="text-xs text-slate-400 mt-1.5">+ {scenario.instructions.length - 3} weitere Schritte in der App</div>
            )}
          </div>
        )}
      </div>

      {/* Auslöse-Leiste: mobil fix am unteren Rand, Desktop im Fluss */}
      <div className="fixed lg:static inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t lg:border-0 border-slate-200 p-4 lg:px-0 lg:mt-5">
        <div className="max-w-2xl mx-auto">
          <HoldButton
            onTrigger={fire}
            disabled={channels.length === 0 || recipients.length === 0}
            hint="Zum Auslösen gedrückt halten"
            className={drill ? 'w-full' : 'w-full alarm-pulse'}
          >
            <Siren size={22} /> {drill ? 'Übung starten' : 'Alarm auslösen'}
          </HoldButton>
          {(channels.length === 0 || recipients.length === 0) && (
            <div className="text-center text-xs text-alarm-600 mt-2">
              {recipients.length === 0 ? 'Keine Empfänger in der aktuellen Auswahl.' : 'Mindestens einen Kanal wählen.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
