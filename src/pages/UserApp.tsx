import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BellRing, BookOpen, Check, CheckCircle2, ChevronLeft, ClipboardCheck, Clock, KeyRound, LayoutDashboard,
  ListChecks, LogOut, MapPin, Megaphone, Phone, PhoneCall, Play, Scale, Search, ShieldAlert, ShieldCheck, Siren, Timer, User, Users, Volume2, X,
} from 'lucide-react'
import { alleinarbeitEmpfaenger, createAlarm, resolveRecipients, uid, useStore } from '../store'
import { LONE_WORK_DEFAULT_GROUPS, type Alarm, type Channel, type LoneWorkSession, type Scenario, type User as AppUser } from '../types'
import { Badge, HoldButton, Toggle, formatDuration, formatRelative, inputClass, kanalName, useConfirm, usePrompt } from '../components/ui'
import { ScenarioIcon } from '../components/ScenarioIcon'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/auth'
import { activeScenarios, allClearStepsOf, responseStepsFor, responseStepsOf } from '../lib/scenarios'

type Tab = 'start' | 'szenarien' | 'alleinarbeit' | 'notruf' | 'profil'

/**
 * Drei Wege in ein Szenario, drei Abläufe:
 * - entdecker: Ich habe die Lage entdeckt. Zuerst alarmieren, dann handeln.
 * - empfaenger: Ich wurde alarmiert. Kein Notruf, keine erneute Auslösung –
 *   stattdessen die eigene Aufgabe.
 * - entwarnung: Der Alarm ist beendet – die Schritte zurück in den Normalbetrieb.
 */
type ScenarioModus = 'entdecker' | 'empfaenger' | 'entwarnung'

/** Wie lange eine Entwarnung auf dem Start-Tab stehen bleibt */
const ENTWARNUNG_SICHTBAR_MS = 12 * 60 * 60_000

const TABS: { key: Tab; label: string; icon: typeof Siren }[] = [
  { key: 'start', label: 'Start', icon: Siren },
  { key: 'szenarien', label: 'Szenarien', icon: BookOpen },
  { key: 'alleinarbeit', label: 'Alleinarbeit', icon: Timer },
  { key: 'notruf', label: 'Notruf', icon: Phone },
  { key: 'profil', label: 'Profil', icon: User },
]

export default function UserApp() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>('start')
  const [openScenario, setOpenScenario] = useState<Scenario | null>(null)
  const [openModus, setOpenModus] = useState<ScenarioModus>('entdecker')
  const [openAlarm, setOpenAlarm] = useState<Alarm | null>(null)
  const [openPhase, setOpenPhase] = useState<number | null>(null)
  // Knopf oben rechts: zuerst das Ereignis wählen
  const [alarmWahl, setAlarmWahl] = useState(false)

  function oeffneSzenario(s: Scenario, modus: ScenarioModus = 'entdecker', alarm: Alarm | null = null, phase: number | null = null) {
    setOpenScenario(s)
    setOpenModus(modus)
    setOpenAlarm(alarm)
    setOpenPhase(phase)
    setAlarmWahl(false)
  }

  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const myLocation = state.locations.find((l) => l.id === me.locationId)
  // Krisenstab und Administration dürfen die App aus Sicht jeder erfassten Person ansehen
  const angemeldetId = state.session?.userId ?? state.currentUserId
  const angemeldet = state.users.find((u) => u.id === angemeldetId)
  const darfVorschau = (angemeldet?.role ?? 'mitarbeiter') !== 'mitarbeiter' && state.users.length > 1
  const myAlarms = state.alarms.filter(
    (a) => a.status === 'active' && (a.deliveries.some((d) => d.userId === me.id) || a.triggeredByUserId === me.id),
  )

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-lg mx-auto lg:border-x lg:border-slate-200">
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center gap-2.5">
        <Siren size={20} className="text-brand-500" />
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">SOBE Notfall</div>
          <div className="text-xs text-slate-400 truncate flex items-center gap-1">
            {me.firstName} {me.lastName} · <MapPin size={10} /> {myLocation?.name}
          </div>
        </div>
        <button
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-alarm-600 text-white text-xs font-bold px-3 py-1.5 active:scale-95 transition"
          onClick={() => { setOpenScenario(null); setAlarmWahl(true) }}
          aria-label="Alarm auslösen"
        >
          <Siren size={14} /> Alarm auslösen
        </button>
      </header>

      {darfVorschau && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2 text-xs text-amber-900">
          <Users size={13} className="shrink-0" />
          <label className="shrink-0" htmlFor="vorschau-person">Vorschau als</label>
          <select
            id="vorschau-person"
            className="flex-1 min-w-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-800"
            value={me.id}
            onChange={(e) => dispatch({ type: 'SET_PREVIEW_USER', userId: e.target.value === angemeldetId ? null : e.target.value })}
          >
            {[...state.users]
              .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}{u.id === angemeldetId ? ' (ich)' : ''} · {state.locations.find((l) => l.id === u.locationId)?.name ?? ''}
                </option>
              ))}
          </select>
          {me.id !== angemeldetId && (
            <span className="shrink-0 font-semibold" title="Im Live-Betrieb sind Aktionen in der Vorschau gesperrt">
              {state.mode === 'live' ? 'nur Ansicht' : 'handelt als diese Person'}
            </span>
          )}
        </div>
      )}

      {myAlarms.length > 0 && tab !== 'start' && !alarmWahl && (
        <button
          onClick={() => { setTab('start'); setOpenScenario(null) }}
          className="bg-alarm-600 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2 alarm-pulse"
        >
          <BellRing size={15} className="animate-pulse" />
          {myAlarms.length} aktiver Alarm{myAlarms.length > 1 ? 'e' : ''} – antippen
        </button>
      )}

      <main className="flex-1 p-4 pb-28">
        {openScenario ? (
          <ScenarioView
            key={`${openScenario.id}-${openModus}-${openAlarm?.id ?? ''}-${openPhase ?? ''}`}
            scenario={openScenario}
            startModus={openModus}
            alarm={openAlarm}
            startPhase={openPhase}
            onBack={() => setOpenScenario(null)}
          />
        ) : alarmWahl ? (
          <AlarmAuswahl onPick={(s) => oeffneSzenario(s, 'entdecker', null, 0)} onBack={() => setAlarmWahl(false)} />
        ) : tab === 'start' ? (
          <StartTab onOpenScenario={(s, a, modus) => oeffneSzenario(s, modus ?? 'empfaenger', a)} />
        ) : tab === 'szenarien' ? (
          <ScenarioListTab onOpen={(s) => oeffneSzenario(s)} />
        ) : tab === 'alleinarbeit' ? (
          <LoneWorkTab />
        ) : tab === 'notruf' ? (
          <ContactsTab />
        ) : (
          <ProfileTab />
        )}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 max-w-lg mx-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setOpenScenario(null); setAlarmWahl(false) }}
              className={`relative py-2.5 flex flex-col items-center gap-0.5 text-[11px] ${
                tab === key && !openScenario && !alarmWahl ? 'text-brand-600 font-semibold' : 'text-slate-400'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {key === 'start' && myAlarms.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-alarm-600 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center">
                    {myAlarms.length}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ---------- Start: Alarme + SOS ----------

/** Meldungen zum laufenden Alarm, neueste zuoberst */
function Lagemeldungen({ alarm }: { alarm: Alarm }) {
  const updates = [...(alarm.updates ?? [])].reverse()
  if (updates.length === 0) return null
  return (
    <div className="mt-2 space-y-1.5">
      {updates.map((u, i) => (
        <div key={i} className={`border-l-[3px] pl-2 ${u.kind === 'fehlalarm' ? 'border-amber-500' : 'border-violet-500'}`}>
          <div className={`text-[11px] font-bold ${u.kind === 'fehlalarm' ? 'text-amber-700' : 'text-violet-700'}`}>
            {u.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : u.kind === 'meldung' ? 'Weitere Meldung' : 'Lagemeldung'} · {formatRelative(u.ts)}
          </div>
          <div className="text-sm text-slate-700">{u.message}</div>
        </div>
      ))}
    </div>
  )
}

/** Live: Wie viele wurden benachrichtigt, wie viele kommen, wie viele sind nicht verfügbar */
export function rueckmeldungen(alarm: Alarm): { benachrichtigt: number; kommen: number; nichtVerfuegbar: number; offen: number } {
  const personen = new Map<string, 'none' | 'acknowledged' | 'declined'>()
  for (const d of alarm.deliveries) {
    const bisher = personen.get(d.userId)
    if (!bisher || bisher === 'none') personen.set(d.userId, d.ack)
  }
  const werte = [...personen.values()]
  const kommen = werte.filter((a) => a === 'acknowledged').length
  const nichtVerfuegbar = werte.filter((a) => a === 'declined').length
  return { benachrichtigt: werte.length, kommen, nichtVerfuegbar, offen: werte.length - kommen - nichtVerfuegbar }
}

function Rueckmeldestand({ alarm }: { alarm: Alarm }) {
  const r = rueckmeldungen(alarm)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500" aria-live="polite">
      <span><b className="text-slate-700">{r.benachrichtigt}</b> benachrichtigt</span>
      <span className="text-emerald-700"><b>{r.kommen}</b> kommen</span>
      <span className="text-slate-600"><b>{r.nichtVerfuegbar}</b> nicht verfügbar</span>
      <span><b>{r.offen}</b> offen</span>
    </div>
  )
}

const FEHLALARM_TEXT = 'Alle Empfänger und der Krisenstab erhalten Ihre Meldung; die Entwarnung gibt der Krisenstab. Kurze Begründung (optional):'
const ENTWARNUNG_TEXT = 'Der Alarm wird beendet und alle Empfänger erhalten die Entwarnung. Hinweis für die Empfänger (optional):'

function StartTab({ onOpenScenario }: { onOpenScenario: (s: Scenario, alarm: Alarm, modus?: 'empfaenger' | 'entwarnung') => void }) {
  const { state, dispatch } = useStore()
  const { ask, confirmEl } = useConfirm()
  const { frage, promptEl } = usePrompt()
  const istFuehrung = (state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId))?.role ?? 'mitarbeiter') !== 'mitarbeiter'
  const fehlalarmMelden = (alarmId: string) =>
    frage('Fehlalarm melden', FEHLALARM_TEXT, (text) => dispatch({ type: 'ALARM_UPDATE', alarmId, message: text, kind: 'fehlalarm' }), 'Melden')
  const entwarnungGeben = (alarmId: string) =>
    frage('Entwarnung geben', ENTWARNUNG_TEXT, (text) => dispatch({ type: 'END_ALARM', alarmId, byUserId: state.currentUserId, note: text }), 'Entwarnung senden', 'z. B. Rückkehr ab 10:30 über den Haupteingang')
  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const mySos = state.alarms.filter((a) => a.status === 'active' && a.triggeredByUserId === me.id)
  const myAlarms = state.alarms.filter(
    (a) => a.status === 'active' && a.triggeredByUserId !== me.id && a.deliveries.some((d) => d.userId === me.id),
  )
  // Beendete Alarme der letzten Stunden: Die Entwarnung bringt eigene Schritte mit
  const entwarnungen = state.alarms
    .filter(
      (a) => a.status === 'ended' && (a.endedAt ?? 0) > Date.now() - ENTWARNUNG_SICHTBAR_MS &&
        (a.triggeredByUserId === me.id || a.deliveries.some((d) => d.userId === me.id)),
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 3)

  function sos() {
    navigator.vibrate?.([120, 60, 120])
    const alarm = createAlarm(state, {
      scenarioId: 'sc-medizin',
      message: `SOS-Alarm von ${me.firstName} ${me.lastName} (App) – Standort: ${state.locations.find((l) => l.id === me.locationId)?.name ?? 'unbekannt'}`,
      silent: false,
      requireAck: true,
      channels: ['push', 'sms', 'voice'],
      groupIds: ['gr-ersthelfer', 'gr-sicherheit'],
      locationIds: [me.locationId],
      triggeredByUserId: me.id,
      triggeredVia: 'app',
      escalation: [{ afterMinutes: 3, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `SOS-Alarm via App: ${me.firstName} ${me.lastName}` })
  }

  return (
    <div className="space-y-4">
      {confirmEl}
      {promptEl}
      {state.integrations.hotline.enabled && (
        <a
          href={`tel:${state.integrations.hotline.number.replace(/\s/g, '')}`}
          className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4"
        >
          <Phone size={20} className="text-brand-600" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Interne Notfallnummer</div>
            <div className="text-xs text-slate-400">Alarmauslösung per Anruf</div>
          </div>
          <span className="font-bold text-brand-600">{state.integrations.hotline.number}</span>
        </a>
      )}
      {mySos.map((a) => {
        const delivered = a.deliveries.filter((d) => d.status === 'delivered').length
        const helpers = [...new Set(a.deliveries.filter((d) => d.ack === 'acknowledged').map((d) => d.userId))]
          .map((id) => state.users.find((u) => u.id === id))
          .filter(Boolean)
        const istTimer = a.triggeredVia === 'timer'
        const istSos = a.message.startsWith('SOS-Alarm') || istTimer
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        const fehlalarmGemeldet = (a.updates ?? []).some((u) => u.kind === 'fehlalarm')
        return (
          <div key={a.id} className="rounded-2xl border-2 border-alarm-500 bg-white p-4 alarm-pulse">
            <div className="flex items-center gap-2 font-bold text-alarm-700">
              <Siren size={18} className="animate-pulse" /> {istTimer ? 'Alleinarbeits-Timer abgelaufen – Alarm aktiv' : istSos ? 'Ihr SOS-Alarm ist aktiv' : `Ihr Alarm ist aktiv${scenario ? ` · ${scenario.title}` : ''}`}
              {a.drill && <Badge color="amber">ÜBUNG</Badge>}
              <span className="ml-auto text-xs font-normal text-slate-400">{formatRelative(a.triggeredAt)}</span>
            </div>
            <Lagemeldungen alarm={a} />
            <div className="mt-2.5 text-sm text-slate-700">
              {delivered}/{a.deliveries.length} Benachrichtigungen zugestellt
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${a.deliveries.length ? (delivered / a.deliveries.length) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2.5 text-sm">
              {helpers.length > 0 ? (
                <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  {helpers.map((u) => `${u!.firstName} ${u!.lastName}`).join(', ')} {helpers.length === 1 ? 'kommt' : 'kommen'}
                </span>
              ) : (
                <span className="text-slate-500">Warten auf Rückmeldung der Einsatzkräfte…</span>
              )}
            </div>
            {istSos ? (
              <button
                className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold ${istTimer ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700'}`}
                onClick={() =>
                  ask(
                    istTimer ? 'Ihnen geht es gut und der Alarm soll beendet werden? Alle Alarmierten erhalten die Entwarnung.' : 'Entwarnung geben und den SOS-Alarm beenden?',
                    () => dispatch({ type: 'END_ALARM', alarmId: a.id, byUserId: me.id, note: istTimer ? 'Mir geht es gut – der Timer wurde nicht rechtzeitig verlängert.' : undefined }),
                    'Entwarnung geben',
                  )
                }
              >
                Entwarnung – mir geht es gut
              </button>
            ) : istFuehrung ? (
              <button className="mt-3 w-full rounded-xl border border-slate-300 text-slate-700 py-2.5 text-sm font-semibold" onClick={() => entwarnungGeben(a.id)}>
                Entwarnung geben
              </button>
            ) : fehlalarmGemeldet ? (
              <div className="mt-3 text-xs text-center text-slate-500">Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung.</div>
            ) : (
              <button className="mt-3 w-full rounded-xl border border-slate-300 text-slate-700 py-2.5 text-sm font-semibold" onClick={() => fehlalarmMelden(a.id)}>
                Fehlalarm melden
              </button>
            )}
          </div>
        )
      })}

      {myAlarms.map((a) => {
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        const myAck = a.deliveries.find((d) => d.userId === me.id)?.ack ?? 'none'
        return (
          <div key={a.id} className={`rounded-2xl border-2 p-4 bg-white ${a.silent ? 'border-violet-400' : 'border-alarm-500 alarm-pulse'}`}>
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <BellRing size={18} className={a.silent ? 'text-violet-600' : 'text-alarm-600 animate-pulse'} />
              <ScenarioIcon name={scenario?.icon ?? ''} size={18} className="text-slate-500" />
              <span className="flex-1">{scenario?.title}</span>
              {a.drill && <Badge color="amber">ÜBUNG</Badge>}
              {a.silent && <Badge color="violet">still</Badge>}
            </div>
            <p className="text-sm text-slate-700 mt-2">{a.message}</p>
            <Rueckmeldestand alarm={a} />
            <Lagemeldungen alarm={a} />
            {!a.silent && (
              <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <Volume2 size={12} /> Critical Alert – auch bei stummgeschaltetem Gerät hörbar
              </div>
            )}
            {scenario && (
              <button
                className="mt-3 w-full rounded-xl bg-slate-800 text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => onOpenScenario(scenario, a)}
              >
                Was jetzt zu tun ist <ArrowRight size={14} />
              </button>
            )}
            {a.requireAck && myAck === 'none' && (
              <div className="flex gap-2 mt-2">
                <button
                  className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                  onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: a.id, userId: me.id, ack: 'acknowledged' })}
                >
                  <Check size={15} /> Ich komme
                </button>
                <button
                  className="flex-1 bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                  onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: a.id, userId: me.id, ack: 'declined' })}
                >
                  <X size={15} /> Nicht verfügbar
                </button>
              </div>
            )}
            {a.requireAck && myAck !== 'none' && (
              <div className="mt-2">
                {myAck === 'acknowledged'
                  ? <Badge color="green"><CheckCircle2 size={12} /> quittiert – Sie nehmen teil</Badge>
                  : <Badge>als nicht verfügbar gemeldet</Badge>}
              </div>
            )}
            {istFuehrung && (
              <button className="mt-3 w-full rounded-xl border border-slate-300 text-slate-700 py-2.5 text-sm font-semibold" onClick={() => entwarnungGeben(a.id)}>
                Entwarnung geben
              </button>
            )}
          </div>
        )
      })}

      {myAlarms.length === 0 && mySos.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center">
          <CheckCircle2 size={26} className="text-emerald-500 mx-auto mb-1.5" />
          <div className="text-sm font-medium text-slate-700">Keine aktiven Alarme</div>
          <div className="text-xs text-slate-400 mt-0.5">Sie werden bei einem Ereignis sofort benachrichtigt.</div>
        </div>
      )}

      {entwarnungen.map((a) => {
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        return (
          <div key={a.id} className="rounded-2xl border-2 border-emerald-500 bg-white p-4">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span className="flex-1">Entwarnung · {scenario?.title ?? 'Alarm'}</span>
              <span className="text-xs font-normal text-slate-400">{formatRelative(a.endedAt ?? a.triggeredAt)}</span>
            </div>
            <p className="text-sm text-slate-700 mt-2">Der Alarm ist beendet. Für die Rückkehr zum Normalbetrieb gelten eigene Schritte.</p>
            {scenario && (
              <button
                className="mt-3 w-full rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => onOpenScenario(scenario, a, 'entwarnung')}
              >
                Nächste Schritte <ArrowRight size={14} />
              </button>
            )}
          </div>
        )
      })}

      {mySos.length === 0 && (
        <>
          <HoldButton onTrigger={sos} hint="Zum Auslösen gedrückt halten" className="w-full">
            <Siren size={24} /> SOS
          </HoldButton>
          <div className="text-xs text-center text-slate-500">
            Alarmiert sofort Schulsanität und Hausdienst an Ihrem Standort – mit automatischer Eskalation.
          </div>
        </>
      )}

    </div>
  )
}

// ---------- Alarm auslösen: Ereignis wählen ----------

/**
 * Einstieg über den Knopf oben rechts: Welches Ereignis? Danach geht es direkt
 * in die Phase «Alarmieren» des gewählten Szenarios – Notruf zuerst, dann die
 * interne Alarmierung.
 */
function AlarmAuswahl({ onPick, onBack }: { onPick: (s: Scenario) => void; onBack: () => void }) {
  const { state } = useStore()
  const rang = { hoch: 0, mittel: 1, tief: 2 } as const
  const szenarien = [...activeScenarios(state.scenarios)].sort((a, b) => rang[a.priority] - rang[b.priority])

  return (
    <div>
      <button className="flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ChevronLeft size={16} /> Zurück
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Siren size={26} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 text-xl leading-tight">Alarm auslösen</h2>
          <div className="text-xs text-slate-400">Welches Ereignis liegt vor?</div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 mb-3 text-xs text-amber-900">
        Bei Lebensgefahr zuerst der Notruf – die passende Nummer steht im nächsten Schritt. Danach halten Sie den roten Knopf gedrückt, um intern zu alarmieren.
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {szenarien.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="rounded-2xl bg-white border border-slate-200 p-3.5 text-left active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <ScenarioIcon name={s.icon} size={22} className={s.priority === 'hoch' ? 'text-alarm-600' : 'text-slate-500'} />
              {s.silentDefault && <Badge color="violet">still</Badge>}
            </div>
            <div className="font-semibold text-sm text-slate-800 mt-2 leading-snug">{s.title}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{s.category}</div>
          </button>
        ))}
      </div>
      <div className="text-xs text-center text-slate-500 mt-4">
        Persönlicher Notfall ohne Szenario: SOS auf dem Start-Tab alarmiert Schulsanität und Hausdienst.
      </div>
    </div>
  )
}

// ---------- Szenarien ----------

function ScenarioListTab({ onOpen }: { onOpen: (s: Scenario) => void }) {
  const { state } = useStore()
  const [search, setSearch] = useState('')
  const filtered = activeScenarios(state.scenarios).filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={inputClass + ' pl-9'}
          placeholder="Szenario suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {filtered.map((s) => (
          <button
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 text-left active:scale-[0.98] transition"
            onClick={() => onOpen(s)}
          >
            <ScenarioIcon name={s.icon} size={22} className={s.priority === 'hoch' ? 'text-alarm-600' : 'text-slate-500'} />
            <div className="text-sm font-semibold text-slate-800 leading-tight mt-1.5">{s.title}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{s.category}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ScenarioView({
  scenario, onBack, startModus = 'entdecker', alarm = null, startPhase = null,
}: {
  scenario: Scenario
  onBack: () => void
  startModus?: ScenarioModus
  alarm?: Alarm | null
  /** Direkt in eine Phase springen, z. B. 0 = Alarmieren über den Knopf im Header */
  startPhase?: number | null
}) {
  const { state, dispatch } = useStore()
  const { frage, promptEl } = usePrompt()
  const [modus, setModus] = useState<ScenarioModus>(startModus)
  const [phase, setPhase] = useState<number | null>(startPhase)
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})
  const [checkedList, setCheckedList] = useState<Record<number, boolean>>({})
  const [notifiedUserIds, setNotifiedUserIds] = useState<string[]>([])

  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const [alarmLocationIds, setAlarmLocationIds] = useState<string[]>([me.locationId])
  const myLocation = state.locations.find((l) => l.id === me.locationId)
  const contacts = state.contacts.filter((c) => scenario.contactIds.includes(c.id))
  // Hinweise zum Notruf gehören in die Phase «Alarmieren» – deshalb stehen sie
  // nicht mehr in den Sofortmassnahmen.
  const callGuidance = scenario.callGuidance ?? []
  const responsibleGroups = state.groups.filter((g) => scenario.responsibleGroupIds.includes(g.id))
  const alarmGroupIds = responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.id) : ['gr-alle']
  const alarmRecipientCount = resolveRecipients(state, alarmGroupIds, alarmLocationIds).length
  const crisisGroups = state.groups.filter((g) => g.isCrisisTeam)
  const crisisMembers = state.users.filter((u) => u.id !== me.id && u.groupIds.some((g) => crisisGroups.some((cg) => cg.id === g)))

  const myScenarioAlarm = state.alarms.find(
    (a) => a.status === 'active' && a.scenarioId === scenario.id && a.triggeredByUserId === me.id && !a.message.startsWith('Info an'),
  )
  // Läuft für dieses Ereignis bereits ein Alarm von jemand anderem am selben
  // Standort? Dann ist eine zweite Auslösung meist überflüssig.
  const fremderAlarm = state.alarms.find(
    (a) =>
      a.status === 'active' && a.scenarioId === scenario.id && a.triggeredByUserId !== me.id &&
      !a.message.startsWith('Info an') && !a.message.startsWith('Krisenteam-Aufgebot') &&
      (a.locationIds.length === 0 || alarmLocationIds.length === 0 || a.locationIds.some((id) => alarmLocationIds.includes(id))),
  )
  const fremderAusloeser = fremderAlarm ? state.users.find((u) => u.id === fremderAlarm.triggeredByUserId) : undefined
  const myCrisisAlarm = state.alarms.find(
    (a) => a.status === 'active' && a.triggeredByUserId === me.id && a.message.startsWith('Krisenteam-Aufgebot'),
  )

  const PHASES = [
    { title: 'Alarmieren', icon: PhoneCall, hint: 'Notruf & interne Alarmierung' },
    { title: 'Sofortmassnahmen', icon: ListChecks, hint: `${scenario.instructions.length} Schritte` },
    { title: 'Informieren', icon: Megaphone, hint: 'Krisenteam aufbieten & benachrichtigen' },
    { title: 'Weitere Massnahmen', icon: ClipboardCheck, hint: 'Nachbearbeitung & Checkliste' },
  ]

  function triggerGroupAlarm() {
    const locationNames = alarmLocationIds
      .map((id) => state.locations.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join(', ')
    const alarm = createAlarm(state, {
      scenarioId: scenario.id,
      message: `${scenario.title} – Standort ${locationNames || 'alle Standorte'}. Ausgelöst von ${me.firstName} ${me.lastName}, bitte Handlungsanweisungen in der App befolgen.`,
      silent: scenario.silentDefault,
      requireAck: true,
      channels: scenario.defaultChannels.length > 0 ? scenario.defaultChannels : ['push', 'sms'],
      groupIds: alarmGroupIds,
      locationIds: alarmLocationIds,
      triggeredByUserId: me.id,
      triggeredVia: 'app',
      escalation: [{ afterMinutes: 5, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: false }],
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `Alarm aus Szenario «${scenario.title}» (App, ${locationNames}): ${me.firstName} ${me.lastName}` })
  }

  function triggerCrisisTeam() {
    const alarm = createAlarm(state, {
      scenarioId: scenario.id,
      message: `Krisenteam-Aufgebot (${scenario.title}) durch ${me.firstName} ${me.lastName} – bitte quittieren.`,
      silent: false,
      requireAck: true,
      channels: ['push', 'sms', 'voice'],
      groupIds: crisisGroups.map((g) => g.id),
      locationIds: [],
      triggeredByUserId: me.id,
      triggeredVia: 'app',
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `Krisenteam-Aufgebot aus Szenario «${scenario.title}»: ${me.firstName} ${me.lastName}` })
  }

  function notifyMember(userId: string) {
    const user = state.users.find((u) => u.id === userId)
    const alarm = createAlarm(state, {
      scenarioId: scenario.id,
      message: `Info an ${user?.firstName} ${user?.lastName}: ${scenario.title} – bitte bei ${me.firstName} ${me.lastName} melden.`,
      silent: false,
      requireAck: true,
      channels: ['push', 'sms'],
      groupIds: [],
      locationIds: [],
      triggeredByUserId: me.id,
      triggeredVia: 'app',
      recipientUserIds: [userId],
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `SMS & Push an ${user?.firstName} ${user?.lastName} (${scenario.title})` })
    setNotifiedUserIds((ids) => [...ids, userId])
  }

  function alarmStatus(alarm: NonNullable<typeof myScenarioAlarm>) {
    const delivered = alarm.deliveries.filter((d) => d.status === 'delivered').length
    const acked = [...new Set(alarm.deliveries.filter((d) => d.ack === 'acknowledged').map((d) => d.userId))].length
    return (
      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3.5 text-sm">
        <div className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 size={16} /> Alarm ausgelöst <span className="font-normal text-emerald-700">{formatRelative(alarm.triggeredAt)}</span>
        </div>
        <div className="text-emerald-700 mt-1">
          {delivered}/{alarm.deliveries.length} zugestellt · {acked} quittiert – Live-Status auf dem Start-Tab.
        </div>
        {(alarm.updates ?? []).some((u) => u.kind === 'fehlalarm') ? (
          <div className="text-xs text-emerald-700 mt-2">Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung.</div>
        ) : (
          <button
            className="mt-2 w-full rounded-xl border border-emerald-600 text-emerald-800 py-2 text-sm font-semibold"
            onClick={() => frage('Fehlalarm melden', FEHLALARM_TEXT, (text) => dispatch({ type: 'ALARM_UPDATE', alarmId: alarm.id, message: text, kind: 'fehlalarm' }), 'Melden')}
          >
            Fehlalarm melden
          </button>
        )}
      </div>
    )
  }

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
        <ScenarioIcon name={scenario.icon} size={26} />
      </div>
      <div className="min-w-0">
        <h2 className="font-bold text-slate-800 text-xl leading-tight">{scenario.title}</h2>
        {phase !== null && <div className="text-xs text-slate-400">Phase {phase + 1} von {PHASES.length} · {PHASES[phase].title}</div>}
      </div>
    </div>
  )

  // ---------- Nach der Entwarnung ----------
  if (modus === 'entwarnung') {
    const beendeterAlarm =
      (alarm && state.alarms.find((a) => a.id === alarm.id)) ??
      [...state.alarms]
        .filter((a) => a.status === 'ended' && a.scenarioId === scenario.id)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0] ??
      null
    return (
      <EntwarnungAnsicht
        scenario={scenario}
        alarm={beendeterAlarm}
        onBack={onBack}
        onSzenario={() => { setModus('entdecker'); setPhase(null) }}
      />
    )
  }

  // ---------- Empfängerweg ----------
  if (modus === 'empfaenger') {
    // Ohne übergebenen Alarm (Einstieg über die Szenarienliste) den passenden
    // aktiven Alarm suchen, falls es einen gibt
    // Immer den aktuellen Stand aus dem Zustand nehmen: Das übergebene Objekt
    // veraltet, sobald quittiert wird
    const aktiverAlarm =
      (alarm && state.alarms.find((a) => a.id === alarm.id)) ??
      state.alarms.find(
        (a) => a.status === 'active' && a.scenarioId === scenario.id && a.deliveries.some((d) => d.userId === me.id),
      ) ??
      null
    return (
      <EmpfaengerAnsicht
        scenario={scenario}
        alarm={aktiverAlarm}
        onBack={onBack}
        onEntdecker={() => { setModus('entdecker'); setPhase(null) }}
      />
    )
  }

  // ---------- Phasen-Übersicht ----------
  if (phase === null) {
    return (
      <div>
        <button className="flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
          <ChevronLeft size={16} /> Zurück
        </button>
        {header}
        <div className="space-y-2.5">
          {PHASES.map((p, i) => (
            <button
              key={p.title}
              className="w-full flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4 text-left active:scale-[0.99] transition"
              onClick={() => setPhase(i)}
            >
              <span className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-slate-800">{p.title}</span>
                <span className="block text-xs text-slate-400">{p.hint}</span>
              </span>
              <p.icon size={18} className="text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
        <button
          className="mt-4 w-full rounded-2xl bg-slate-800 text-white py-3 font-semibold"
          onClick={() => setPhase(0)}
        >
          Geführt starten – ich habe es entdeckt
        </button>
        {responseStepsOf(scenario).length > 0 && (
          <button
            className="mt-2 w-full rounded-2xl bg-white border border-slate-300 text-slate-700 py-3 font-semibold"
            onClick={() => setModus('empfaenger')}
          >
            Ich wurde alarmiert – was jetzt?
          </button>
        )}
      </div>
    )
  }

  // ---------- Einzelne Phase ----------
  return (
    <div>
      {promptEl}
      <button className="flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={() => setPhase(null)}>
        <ChevronLeft size={16} /> Übersicht
      </button>
      {header}

      {phase === 0 && (
        <div className="space-y-3">
          {callGuidance.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="text-sm font-semibold text-amber-900">Wann anrufen und was sagen</div>
              <ul className="space-y-1.5">
                {callGuidance.map((hinweis, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-900">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    <span>{hinweis}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {contacts.length > 0 && (
            <>
              <div className="text-sm font-semibold text-slate-700">Bei unmittelbarer Gefahr zuerst den Notruf wählen:</div>
              {contacts.map((c) => (
                <a key={c.id} href={`tel:${c.number}`} className="flex items-center gap-3 rounded-xl bg-alarm-600 text-white px-4 py-3 active:scale-[0.99] transition">
                  <Phone size={18} />
                  <span className="flex-1 font-semibold text-sm">{c.name} anrufen</span>
                  <span className="font-bold text-lg">{c.number}</span>
                </a>
              ))}
            </>
          )}
          <div className="text-sm font-semibold text-slate-700 pt-2">
            Interne Alarmierung {scenario.silentDefault && <Badge color="violet">still</Badge>}
          </div>
          <div className="text-xs font-medium text-slate-600">Betroffener Standort wählen:</div>
          <div className="flex flex-wrap gap-1.5">
            {state.locations.map((l) => {
              const selected = alarmLocationIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  disabled={!!myScenarioAlarm}
                  onClick={() =>
                    setAlarmLocationIds(
                      selected ? alarmLocationIds.filter((id) => id !== l.id) : [...alarmLocationIds, l.id],
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <MapPin size={11} className="inline -mt-0.5 mr-1" />
                  {l.name}
                </button>
              )
            })}
          </div>
          <div className="text-xs text-slate-500">
            Alarmiert {responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.name).join(', ') : 'alle Mitarbeitenden mit App'}
            {alarmLocationIds.length === 0 ? ' an allen Standorten' : ''} per{' '}
            {(scenario.defaultChannels.length > 0 ? scenario.defaultChannels : (['push', 'sms'] as Channel[])).map(kanalName).join(', ')} – mit Quittierung.{' '}
            <span className="font-semibold text-slate-700">{alarmRecipientCount} Empfänger:innen</span> werden benachrichtigt.
          </div>
          {!myScenarioAlarm && fremderAlarm && (
            <div className="rounded-xl border-2 border-violet-400 bg-violet-50 p-3.5 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-violet-800">
                <BellRing size={16} /> Für dieses Ereignis läuft bereits ein Alarm
              </div>
              <p className="text-violet-900">
                {fremderAusloeser ? `${fremderAusloeser.firstName} ${fremderAusloeser.lastName}` : 'Jemand'} hat {formatRelative(fremderAlarm.triggeredAt)} alarmiert.
                Wenn Sie trotzdem auslösen, entsteht kein zweiter Alarm: Ihre Meldung wird dem laufenden hinzugefügt, und neu gewählte Standorte werden zusätzlich alarmiert.
              </p>
              <button
                className="w-full rounded-xl bg-slate-800 text-white py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => setModus('empfaenger')}
              >
                Was jetzt zu tun ist <ArrowRight size={14} />
              </button>
            </div>
          )}
          {myScenarioAlarm ? (
            alarmStatus(myScenarioAlarm)
          ) : (
            <HoldButton
              onTrigger={triggerGroupAlarm}
              disabled={alarmRecipientCount === 0}
              hint="Zum Alarmieren gedrückt halten"
              className="w-full"
            >
              <Siren size={20} /> {fremderAlarm ? `Meldung zum laufenden Alarm ergänzen (${alarmRecipientCount})` : `${responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.name).join(' & ') : 'Alle'} alarmieren (${alarmRecipientCount})`}
            </HoldButton>
          )}
        </div>
      )}

      {phase === 1 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 mb-1">Schritte antippen, wenn erledigt:</div>
          {scenario.instructions.map((step, i) => (
            <button
              key={i}
              className="w-full flex gap-2.5 text-sm bg-white rounded-xl border border-slate-200 p-3 text-left"
              onClick={() => setCheckedSteps({ ...checkedSteps, [i]: !checkedSteps[i] })}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${checkedSteps[i] ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white'}`}>
                {checkedSteps[i] ? <Check size={14} /> : i + 1}
              </span>
              <span className={`pt-0.5 ${checkedSteps[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 2 && (
        <div className="space-y-3">
          {myCrisisAlarm ? (
            alarmStatus(myCrisisAlarm)
          ) : (
            <HoldButton onTrigger={triggerCrisisTeam} hint="Zum Aufbieten gedrückt halten" className="w-full">
              <Users size={20} /> Krisenteam aufbieten
            </HoldButton>
          )}
          <div className="text-xs text-slate-500">
            Aufgebot per Push, SMS und Sprachanruf mit Quittierung – oder einzelne Mitglieder direkt kontaktieren:
          </div>
          <div className="space-y-2">
            {crisisMembers.map((u) => {
              const groups = state.groups.filter((g) => g.isCrisisTeam && u.groupIds.includes(g.id))
              const notified = notifiedUserIds.includes(u.id)
              return (
                <div key={u.id} className="rounded-xl bg-white border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-slate-800">{u.firstName} {u.lastName}</div>
                  <div className="text-xs text-slate-400">{groups.map((g) => g.name).join(', ')}</div>
                  <div className="flex gap-2 mt-2">
                    <a
                      href={`tel:${u.phone.replace(/\s/g, '')}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-slate-700"
                    >
                      <Phone size={13} /> Anrufen
                    </a>
                    <button
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${notified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 text-white'}`}
                      disabled={notified}
                      onClick={() => notifyMember(u.id)}
                    >
                      {notified ? <><Check size={13} /> Gesendet</> : <><BellRing size={13} /> SMS & Push</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {phase === 3 && (
        <div className="space-y-4">
          {scenario.followUp.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Nach der Akutphase</div>
              <ul className="space-y-1.5">
                {scenario.followUp.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 bg-white rounded-xl border border-slate-200 p-3">
                    <span className="text-slate-400 shrink-0">–</span> {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Checkliste</div>
            {scenario.checklist.map((item, i) => (
              <label key={i} className="flex items-center gap-2.5 text-sm text-slate-700 bg-white rounded-xl border border-slate-200 p-3 mb-1.5">
                <input type="checkbox" checked={checkedList[i] ?? false} onChange={() => setCheckedList({ ...checkedList, [i]: !checkedList[i] })} />
                <span className={checkedList[i] ? 'line-through text-slate-400' : ''}>{item}</span>
              </label>
            ))}
          </div>

          {(scenario.legalBasis?.length ?? 0) > 0 && <LegalSection eintraege={scenario.legalBasis!} />}
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button
          className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
          onClick={() => setPhase(phase === 0 ? null : phase - 1)}
        >
          Zurück
        </button>
        <button
          className="flex-1 rounded-xl bg-slate-800 text-white py-2.5 text-sm font-semibold"
          onClick={() => (phase === PHASES.length - 1 ? setPhase(null) : setPhase(phase + 1))}
        >
          {phase === PHASES.length - 1 ? 'Abschliessen' : 'Weiter'}
        </button>
      </div>
    </div>
  )
}

// ---------- Alleinarbeit ----------

function LoneWorkTab() {
  const { state, dispatch } = useStore()
  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const [activity, setActivity] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [silent, setSilent] = useState(false)
  // Wer bei Ablauf alarmiert wird: Gruppen am eigenen Standort, dazu einzelne Personen
  const [alertGroupIds, setAlertGroupIds] = useState<string[]>(() =>
    LONE_WORK_DEFAULT_GROUPS.filter((id) => state.groups.some((g) => g.id === id)),
  )
  const [alertUserIds, setAlertUserIds] = useState<string[]>([])
  const [personenOffen, setPersonenOffen] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const mySessions = state.loneWorkSessions.filter((s) => s.userId === me.id)
  const running = mySessions.find((s) => s.status === 'running')
  // Timer abgelaufen, Alarm läuft noch: «mir geht es gut» beendet ihn
  const abgelaufenerAlarm = state.alarms.find((a) => a.status === 'active' && a.triggeredVia === 'timer' && a.triggeredByUserId === me.id)
  const waehlbareGruppen = state.groups.filter((g) => g.id !== 'gr-alle')
  const waehlbarePersonen = [...state.users].filter((u) => u.id !== me.id).sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
  const vorschau = alleinarbeitEmpfaenger(state, {
    id: '', userId: me.id, locationId: me.locationId, activity: '', startedAt: 0, durationMin, expiresAt: 0, silent, status: 'running',
    alertGroupIds, alertUserIds,
  })
  const anzahlEmpfaenger = vorschau.recipientUserIds
    ? vorschau.recipientUserIds.length
    : resolveRecipients(state, vorschau.groupIds, [me.locationId]).filter((u) => u.id !== me.id).length
  const toggleId = (liste: string[], id: string) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])
  const empfaengerText = (s: LoneWorkSession) => {
    const gruppen = (s.alertGroupIds?.length ? s.alertGroupIds : LONE_WORK_DEFAULT_GROUPS)
      .map((id) => state.groups.find((g) => g.id === id)?.name).filter(Boolean)
    const personen = (s.alertUserIds ?? []).map((id) => { const u = state.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : '' }).filter(Boolean)
    return [...gruppen, ...personen].join(', ')
  }

  function start() {
    const session: LoneWorkSession = {
      id: uid('lw'),
      userId: me.id,
      locationId: me.locationId,
      activity: activity || 'Alleinarbeit',
      startedAt: Date.now(),
      durationMin,
      expiresAt: Date.now() + durationMin * 60_000,
      silent,
      status: 'running',
      alertGroupIds,
      alertUserIds,
    }
    dispatch({ type: 'START_LONE_WORK', session })
    setActivity('')
  }

  if (running) {
    const remaining = running.expiresAt - now
    const critical = remaining < 5 * 60_000
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl border-2 bg-white p-5 text-center ${critical ? 'border-alarm-500' : 'border-slate-200'}`}>
          <div className="text-sm text-slate-500">{running.activity}</div>
          <div className={`text-5xl font-mono font-bold my-3 ${critical ? 'text-alarm-600' : 'text-slate-800'}`}>
            {formatDuration(remaining)}
          </div>
          <div className="text-xs text-slate-400 mb-4">
            {critical
              ? 'Bald läuft der Timer ab – Lebenszeichen geben!'
              : 'Läuft der Timer ab, wird automatisch alarmiert.'}
            <div className="mt-1">Alarmiert werden: {empfaengerText(running)}</div>
          </div>
          <button
            className="w-full rounded-xl bg-emerald-600 text-white py-3.5 font-semibold text-base active:scale-[0.99] transition"
            onClick={() => dispatch({ type: 'EXTEND_LONE_WORK', sessionId: running.id, minutes: running.durationMin })}
          >
            <Clock size={18} className="inline mr-1.5 -mt-0.5" /> Lebenszeichen (+{running.durationMin} Min.)
          </button>
          <button
            className="w-full rounded-xl bg-slate-800 text-white py-3 font-semibold text-sm mt-2"
            onClick={() => dispatch({ type: 'COMPLETE_LONE_WORK', sessionId: running.id })}
          >
            <CheckCircle2 size={16} className="inline mr-1.5 -mt-0.5" /> Arbeit sicher beendet
          </button>
        </div>
        {running.silent && <div className="text-xs text-center text-slate-400">Stille Alarmauslösung aktiviert.</div>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {abgelaufenerAlarm && (
        <div className="rounded-2xl border-2 border-alarm-500 bg-white p-4 alarm-pulse">
          <div className="flex items-center gap-2 font-bold text-alarm-700">
            <Siren size={18} className="animate-pulse" /> Timer abgelaufen – Alarm ausgelöst
            <span className="ml-auto text-xs font-normal text-slate-400">{formatRelative(abgelaufenerAlarm.triggeredAt)}</span>
          </div>
          <p className="text-sm text-slate-700 mt-2">
            Schulsanität und Hausdienst sind alarmiert. Wenn Ihnen nichts fehlt und Sie nur vergessen haben, den Timer zu verlängern, geben Sie hier Entwarnung.
          </p>
          <Rueckmeldestand alarm={abgelaufenerAlarm} />
          <button
            className="mt-3 w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold text-sm flex items-center justify-center gap-1.5"
            onClick={() => dispatch({ type: 'END_ALARM', alarmId: abgelaufenerAlarm.id, byUserId: me.id, note: 'Mir geht es gut – der Timer wurde nicht rechtzeitig verlängert.' })}
          >
            <CheckCircle2 size={16} /> Mir geht es gut – Entwarnung senden
          </button>
        </div>
      )}
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3"><Timer size={18} /> Alleinarbeit starten</h2>
        <input
          className={inputClass + ' mb-3'}
          placeholder="Tätigkeit (z. B. Abendrundgang, Wartung)"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />
        <div className="text-sm font-medium text-slate-600 mb-1">Timer: {durationMin} Minuten</div>
        <input type="range" min={1} max={120} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="w-full mb-3" />
        <div className="text-sm font-medium text-slate-600 mb-1">Bei Ablauf alarmieren</div>
        <div className="text-xs text-slate-400 mb-1.5">Gruppen an Ihrem Standort – antippen zum An- und Abwählen:</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {waehlbareGruppen.map((g) => {
            const an = alertGroupIds.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => setAlertGroupIds(toggleId(alertGroupIds, g.id))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${an ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-600'}`}
              >
                {g.name}
              </button>
            )
          })}
        </div>
        <button className="text-xs text-slate-500 underline underline-offset-2" onClick={() => setPersonenOffen(!personenOffen)}>
          {personenOffen ? 'Einzelne Personen ausblenden' : `Zusätzlich einzelne Personen wählen${alertUserIds.length ? ` (${alertUserIds.length} gewählt)` : ''}`}
        </button>
        {personenOffen && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {waehlbarePersonen.map((u) => (
              <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <input type="checkbox" checked={alertUserIds.includes(u.id)} onChange={() => setAlertUserIds(toggleId(alertUserIds, u.id))} />
                <span className="flex-1 text-slate-700">{u.firstName} {u.lastName}</span>
                <span className="text-xs text-slate-400">{state.locations.find((l) => l.id === u.locationId)?.name}</span>
              </label>
            ))}
          </div>
        )}
        <div className={`text-xs mt-2 mb-3 ${anzahlEmpfaenger === 0 ? 'text-alarm-600' : 'text-slate-500'}`}>
          <b>{anzahlEmpfaenger} Person{anzahlEmpfaenger === 1 ? '' : 'en'}</b> würden bei Ablauf alarmiert{anzahlEmpfaenger === 0 ? ' – bitte mindestens eine Gruppe oder Person wählen' : ''}.
        </div>
        <div className="mb-4">
          <Toggle checked={silent} onChange={setSilent} label="Stille Alarmauslösung" />
        </div>
        <button
          className="w-full rounded-xl bg-slate-800 text-white py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={start}
          disabled={anzahlEmpfaenger === 0}
        >
          <Play size={16} /> Timer starten
        </button>
        <div className="text-xs text-slate-400 mt-2">
          Melden Sie sich vor Ablauf zurück – sonst alarmiert das System automatisch die gewählten Personen.
        </div>
      </div>

      {mySessions.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Verlauf</h3>
          {mySessions.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 flex-1 truncate">{s.activity}</span>
              {s.status === 'completed' && <Badge color="green">beendet</Badge>}
              {s.status === 'alarm' && <Badge color="red"><ShieldAlert size={11} /> Alarm</Badge>}
              {s.status === 'running' && <Badge color="amber">läuft</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Empfängerweg ----------

/**
 * Was jemand tut, der den Alarm erhalten hat – und die Lage nicht selbst
 * entdeckt hat. Notruf und Auslösung sind bereits geschehen; hier steht die
 * eigene Aufgabe, dazu die Quittierung.
 */
/**
 * Nach der Entwarnung: Der Alarm ist beendet, aber der Normalbetrieb beginnt
 * nicht von selbst – Rückkehr, Zählung, Nachsorge.
 */
function EntwarnungAnsicht({
  scenario, alarm, onBack, onSzenario,
}: {
  scenario: Scenario
  alarm: Alarm | null
  onBack: () => void
  onSzenario: () => void
}) {
  const { state } = useStore()
  const [erledigt, setErledigt] = useState<Record<number, boolean>>({})
  const schritte = allClearStepsOf(scenario)
  const beendetDurch = alarm?.log
    .map((l) => l.message)
    .reverse()
    .find((m) => m.startsWith('Alarm beendet durch '))
    ?.replace(/^Alarm beendet durch /, '')
    .replace(/ – Entwarnung versendet\.$/, '')
  const orte = alarm
    ? alarm.locationIds.map((id) => state.locations.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
    : ''

  return (
    <div>
      <button className="flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ChevronLeft size={16} /> Zurück
      </button>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <ShieldCheck size={26} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 text-xl leading-tight">Entwarnung</h2>
          <div className="text-xs text-slate-400">{scenario.title}</div>
        </div>
      </div>

      {alarm ? (
        <div className="rounded-2xl border-2 border-emerald-500 bg-white p-4 mb-3">
          <p className="text-sm text-slate-700">{alarm.message}</p>
          <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span>Beendet {formatRelative(alarm.endedAt ?? alarm.triggeredAt)}{beendetDurch ? ` durch ${beendetDurch}` : ''}</span>
            {orte && <span className="flex items-center gap-1"><MapPin size={11} /> {orte}</span>}
          </div>
          {alarm.endNote && (
            <div className="mt-2 border-l-[3px] border-emerald-500 pl-2">
              <div className="text-[11px] font-bold text-emerald-700">Hinweis des Krisenstabs</div>
              <div className="text-sm text-slate-700">{alarm.endNote}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 mb-3 text-xs text-slate-500">
          Zu diesem Szenario ist kein beendeter Alarm bekannt. Das sind die Schritte für den Fall einer Entwarnung.
        </div>
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 mb-3 text-xs text-emerald-900">
        Der Alarm ist beendet. Der Normalbetrieb beginnt aber nicht von selbst – das gilt jetzt:
      </div>

      <div className="text-xs text-slate-400 mb-1">Schritte antippen, wenn erledigt:</div>
      <div className="space-y-2">
        {schritte.map((schritt, i) => (
          <button
            key={i}
            className="w-full flex gap-2.5 text-sm bg-white rounded-xl border border-slate-200 p-3 text-left"
            onClick={() => setErledigt({ ...erledigt, [i]: !erledigt[i] })}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${erledigt[i] ? 'bg-slate-300' : 'bg-emerald-600'}`}>
              {erledigt[i] ? <Check size={14} /> : i + 1}
            </span>
            <span className={`pt-0.5 ${erledigt[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{schritt}</span>
          </button>
        ))}
      </div>

      <button className="mt-5 w-full text-sm text-slate-500 underline underline-offset-2" onClick={onSzenario}>
        Vollständiges Szenario ansehen
      </button>
    </div>
  )
}

function EmpfaengerAnsicht({
  scenario, alarm, onBack, onEntdecker,
}: {
  scenario: Scenario
  alarm: Alarm | null
  onBack: () => void
  onEntdecker: () => void
}) {
  const { state, dispatch } = useStore()
  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const [erledigt, setErledigt] = useState<Record<number, boolean>>({})
  const [zeigeAndere, setZeigeAndere] = useState(false)
  // Nur die Schritte der eigenen Gruppen – die übrigen bleiben auf Wunsch einsehbar
  const { eigene, andere } = responseStepsFor(scenario, me.groupIds)
  const gruppenName = (ids?: string[]) =>
    (ids ?? []).map((id) => state.groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ')
  const meineGruppen = state.groups.filter((g) => me.groupIds.includes(g.id) && g.id !== 'gr-alle')
  const ausloeser = alarm ? state.users.find((u) => u.id === alarm.triggeredByUserId) : undefined
  const orte = alarm
    ? alarm.locationIds.map((id) => state.locations.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
    : ''
  const myAck = alarm?.deliveries.find((d) => d.userId === me.id)?.ack ?? 'none'

  return (
    <div>
      <button className="flex items-center gap-1 text-sm text-slate-500 mb-3" onClick={onBack}>
        <ChevronLeft size={16} /> Zurück
      </button>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <ScenarioIcon name={scenario.icon} size={26} />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 text-xl leading-tight">{scenario.title}</h2>
          <div className="text-xs text-slate-400">Sie wurden alarmiert</div>
        </div>
      </div>

      {alarm ? (
        <div className={`rounded-2xl border-2 p-4 bg-white mb-3 ${alarm.silent ? 'border-violet-400' : 'border-alarm-500'}`}>
          {alarm.drill && <div className="mb-1"><Badge color="amber">ÜBUNG – kein Ernstfall</Badge></div>}
          <p className="text-sm text-slate-700">{alarm.message}</p>
          <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {ausloeser && <span>Ausgelöst von {ausloeser.firstName} {ausloeser.lastName}</span>}
            <span>{formatRelative(alarm.triggeredAt)}</span>
            {orte && <span className="flex items-center gap-1"><MapPin size={11} /> {orte}</span>}
            {alarm.silent && <Badge color="violet">still</Badge>}
          </div>
          <Rueckmeldestand alarm={alarm} />
          <Lagemeldungen alarm={alarm} />
          {alarm.requireAck && myAck === 'none' && (
            <div className="flex gap-2 mt-3">
              <button
                className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: alarm.id, userId: me.id, ack: 'acknowledged' })}
              >
                <Check size={15} /> Ich komme
              </button>
              <button
                className="flex-1 bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
                onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: alarm.id, userId: me.id, ack: 'declined' })}
              >
                <X size={15} /> Nicht verfügbar
              </button>
            </div>
          )}
          {alarm.requireAck && myAck !== 'none' && (
            <div className="mt-2">
              {myAck === 'acknowledged'
                ? <Badge color="green"><CheckCircle2 size={12} /> quittiert – Sie nehmen teil</Badge>
                : <Badge>als nicht verfügbar gemeldet</Badge>}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 mb-3 text-xs text-slate-500">
          Zurzeit läuft kein Alarm zu diesem Szenario. Das ist der Ablauf für den Fall, dass Sie einen erhalten.
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 mb-3 text-xs text-amber-900">
        Kein Notruf, keine erneute Auslösung – das ist bereits geschehen. Hier steht, was <b>Sie</b> jetzt tun.
      </div>

      <div className="text-xs text-slate-400 mb-1 flex flex-wrap items-center gap-1">
        <span>Ihre Schritte{meineGruppen.length > 0 ? ' als' : ''}</span>
        {meineGruppen.map((g) => <Badge key={g.id}>{g.name}</Badge>)}
        <span>– antippen, wenn erledigt:</span>
      </div>
      <div className="space-y-2">
        {eigene.map((step, i) => (
          <button
            key={i}
            className="w-full flex gap-2.5 text-sm bg-white rounded-xl border border-slate-200 p-3 text-left"
            onClick={() => setErledigt({ ...erledigt, [i]: !erledigt[i] })}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${erledigt[i] ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
              {erledigt[i] ? <Check size={14} /> : i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={erledigt[i] ? 'text-slate-400 line-through' : 'text-slate-700'}>{step.text}</span>
              {step.groupIds && step.groupIds.length > 0 && (
                <span className="block text-[11px] text-amber-700 mt-0.5">{gruppenName(step.groupIds)}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {andere.length > 0 && (
        <div className="mt-3">
          <button
            className="text-xs text-slate-500 underline underline-offset-2"
            onClick={() => setZeigeAndere(!zeigeAndere)}
          >
            {zeigeAndere ? 'Schritte anderer Gruppen ausblenden' : `${andere.length} Schritt${andere.length > 1 ? 'e' : ''} anderer Gruppen anzeigen`}
          </button>
          {zeigeAndere && (
            <div className="space-y-2 mt-2">
              {andere.map((step, i) => (
                <div key={i} className="flex gap-2.5 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-300 p-3 text-slate-500">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs font-bold">·</span>
                  <span className="min-w-0 pt-0.5">
                    <span>{step.text}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{gruppenName(step.groupIds)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="mt-5 w-full text-sm text-slate-500 underline underline-offset-2" onClick={onEntdecker}>
        Vollständiges Szenario ansehen – für den Fall, dass Sie die Lage selbst entdecken
      </button>
    </div>
  )
}

// ---------- Notruf ----------

function ContactsTab() {
  const { state } = useStore()
  return (
    <div className="space-y-2.5">
      {state.contacts.map((c) => (
        <a
          key={c.id}
          href={`tel:${c.number}`}
          className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4 active:scale-[0.99] transition"
        >
          <div className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Phone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800">{c.name}</div>
            <div className="text-xs text-slate-400 truncate">{c.description}</div>
          </div>
          <span className="text-xl font-bold text-alarm-600">{c.number}</span>
        </a>
      ))}
      <div className="text-xs text-center text-slate-400 pt-1">Antippen ruft direkt an.</div>
    </div>
  )
}

// ---------- Profil ----------

/** Rechtsgrundlagen – eingeklappt, damit sie im Ernstfall nicht im Weg stehen */
function LegalSection({ eintraege }: { eintraege: string[] }) {
  const [offen, setOffen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3.5 py-3 text-sm font-semibold text-slate-700"
        onClick={() => setOffen((v) => !v)}
      >
        <Scale size={15} className="text-slate-400" />
        Rechtsgrundlagen
        <span className="ml-auto text-xs font-normal text-slate-400">{offen ? 'einklappen' : `${eintraege.length} Punkte`}</span>
      </button>
      {offen && (
        <div className="px-3.5 pb-3.5">
          <ul className="space-y-2">
            {eintraege.map((eintrag, i) => (
              <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                <span className="text-slate-400 shrink-0">§</span> {eintrag}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
            Orientierungshilfe, keine Rechtsberatung. Verbindlich sind die kantonalen Vorgaben und das
            Notfallkonzept der Trägerschaft.
          </p>
        </div>
      )}
    </div>
  )
}

function ProfileTab() {
  const { state, dispatch, logout } = useStore()
  const navigate = useNavigate()
  const me = state.users.find((u) => u.id === (state.previewUserId ?? state.currentUserId)) ?? state.users[0]
  const myLocation = state.locations.find((l) => l.id === me.locationId)
  const myGroups = state.groups.filter((g) => me.groupIds.includes(g.id))
  const isStaff = me.role === 'admin' || me.role === 'krisenstab'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg shrink-0">
            {me.firstName[0]}{me.lastName[0]}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">{me.firstName} {me.lastName}</div>
            <div className="text-xs text-slate-400">{me.email}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2"><MapPin size={13} className="text-slate-400" /> {myLocation?.name}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge color={me.role === 'admin' ? 'red' : me.role === 'krisenstab' ? 'violet' : 'slate'}>{me.role}</Badge>
            {myGroups.map((g) => <Badge key={g.id}>{g.name}</Badge>)}
          </div>
        </div>
      </div>

      {me.role === 'admin' && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Modus</div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['demo', 'live'] as const).map((m) => (
              <button
                key={m}
                onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition ${
                  state.mode === m
                    ? m === 'live'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-slate-900'
                    : 'text-slate-500'
                }`}
              >
                {m === 'demo' ? 'Demo' : 'Live'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {state.mode === 'demo'
              ? 'Beispieldaten, Zustellung wird simuliert.'
              : 'Eigener Datenbestand ohne Simulation. Beide Modi behalten ihre Daten.'}
          </p>
        </div>
      )}

      {isStaff && (
        <button
          className="w-full rounded-2xl bg-slate-800 text-white py-3 font-semibold flex items-center justify-center gap-2"
          onClick={() => navigate('/dashboard')}
        >
          <LayoutDashboard size={16} /> Zur Verwaltung wechseln
        </button>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-1.5">Als App auf dem iPhone installieren</div>
        <ol className="text-xs text-slate-500 space-y-1 list-decimal pl-4">
          <li>Diese Seite in Safari öffnen</li>
          <li>Teilen-Symbol antippen</li>
          <li>«Zum Home-Bildschirm» wählen</li>
        </ol>
        <div className="text-xs text-slate-400 mt-2">
          Die App startet dann vollbildig mit eigenem Symbol und funktioniert auch offline.
        </div>
      </div>

      <PasswordCard />

      {state.mode === 'demo' && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Demo: Ansicht als andere Person</div>
          <select
            className={inputClass}
            value={me.id}
            onChange={(e) => dispatch({ type: 'SET_CURRENT_USER', userId: e.target.value })}
          >
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="w-full rounded-2xl border border-slate-200 bg-white text-slate-600 py-3 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
        onClick={logout}
      >
        <LogOut size={16} /> Abmelden
      </button>
    </div>
  )
}

/** Eigenes Passwort ändern */
function PasswordCard() {
  const { changePassword } = useStore()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const problem = passwordProblem(next)
    if (problem) return setError(problem)
    if (next !== repeat) return setError('Die beiden neuen Passwörter stimmen nicht überein.')
    const ergebnis = await changePassword(current, next)
    if (!ergebnis.ok) return setError(ergebnis.error)
    setOpen(false)
    setCurrent(''); setNext(''); setRepeat(''); setError(null)
  }

  if (!open) {
    return (
      <button
        className="w-full rounded-2xl bg-white border border-slate-200 py-3 font-semibold text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 transition"
        onClick={() => setOpen(true)}
      >
        <KeyRound size={16} /> Passwort ändern
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2.5">
      <div className="text-sm font-semibold text-slate-700">Passwort ändern</div>
      <input type="password" autoComplete="current-password" className={inputClass} placeholder="Aktuelles Passwort"
        value={current} onChange={(e) => { setCurrent(e.target.value); setError(null) }} />
      <input type="password" autoComplete="new-password" className={inputClass}
        placeholder={`Neues Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen, mit Ziffer)`}
        value={next} onChange={(e) => { setNext(e.target.value); setError(null) }} />
      <input type="password" autoComplete="new-password" className={inputClass} placeholder="Neues Passwort wiederholen"
        value={repeat} onChange={(e) => { setRepeat(e.target.value); setError(null) }} />
      {error && <div className="text-xs text-alarm-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 rounded-xl bg-slate-100 text-slate-600 py-2.5 text-sm font-semibold" onClick={() => { setOpen(false); setError(null) }}>
          Abbrechen
        </button>
        <button className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}
