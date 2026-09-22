import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Play, Search, ShieldAlert } from 'lucide-react'
import { alleinarbeitEmpfaenger, resolveRecipients, uid, useStore } from '../store'
import { LONE_WORK_DEFAULT_GROUPS, type LoneWorkSession } from '../types'
import { Badge, Button, Card, EmptyState, Field, Toggle, formatDateTime, formatDuration, inputClass } from '../components/ui'

export default function LoneWorker() {
  const { state, dispatch } = useStore()
  const [userId, setUserId] = useState(state.currentUserId)
  const [locationId, setLocationId] = useState(state.locations[0]?.id ?? '')
  const [activity, setActivity] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [silent, setSilent] = useState(false)
  const [alertGroupIds, setAlertGroupIds] = useState<string[]>(() =>
    LONE_WORK_DEFAULT_GROUPS.filter((id) => state.groups.some((g) => g.id === id)),
  )
  const [alertUserIds, setAlertUserIds] = useState<string[]>([])
  const [personenSuche, setPersonenSuche] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const running = state.loneWorkSessions.filter((s) => s.status === 'running')
  const past = state.loneWorkSessions.filter((s) => s.status !== 'running')
  const toggleId = (liste: string[], id: string) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])
  const vorschau = alleinarbeitEmpfaenger(state, {
    id: '', userId, locationId, activity: '', startedAt: 0, durationMin, expiresAt: 0, silent, status: 'running', alertGroupIds, alertUserIds,
  })
  const anzahlEmpfaenger = vorschau.recipientUserIds
    ? vorschau.recipientUserIds.length
    : resolveRecipients(state, vorschau.groupIds, [locationId]).filter((u) => u.id !== userId).length

  /**
   * Auswahlliste der Einzelpersonen. Gesucht wird über Name, E-Mail-Adresse und
   * Standort; mehrere Wörter werden mit UND verknüpft. Bereits gewählte Personen
   * bleiben immer sichtbar – sonst verschwände die Auswahl beim Tippen aus dem
   * Blick, obwohl sie weiterhin alarmiert würden.
   */
  const auswahlPersonen = useMemo(() => {
    const begriffe = personenSuche.toLowerCase().split(/\s+/).filter(Boolean)
    return state.users
      .filter((u) => u.id !== userId)
      .filter((u) => {
        if (alertUserIds.includes(u.id) || begriffe.length === 0) return true
        const standort = state.locations.find((l) => l.id === u.locationId)?.name ?? ''
        const heuhaufen = `${u.firstName} ${u.lastName} ${u.email} ${standort}`.toLowerCase()
        return begriffe.every((b) => heuhaufen.includes(b))
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
  }, [state.users, state.locations, userId, alertUserIds, personenSuche])

  function start() {
    const session: LoneWorkSession = {
      id: uid('lw'),
      userId,
      locationId,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Alleinarbeiterschutz</h1>
        <p className="text-sm text-slate-500">
          Timer-Funktion mit automatischer Alarmauslösung: Meldet sich die Person nicht rechtzeitig zurück, alarmiert der Server
          automatisch Ersthelfer und Sicherheitsdienst – auf Wunsch still und unauffällig.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><Play size={16} /> Überwachung starten</span>}>
          <Field label="Person">
            <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </Field>
          <Field label="Standort">
            <select className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Tätigkeit">
            <input className={inputClass} placeholder="z. B. Wartung Heizzentrale, Nachtrundgang" value={activity} onChange={(e) => setActivity(e.target.value)} />
          </Field>
          <Field label={`Timer-Intervall: ${durationMin} Minuten`}>
            <input type="range" min={1} max={120} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-slate-400">Vor Ablauf muss ein Lebenszeichen gegeben werden, sonst wird automatisch alarmiert.</div>
          </Field>
          <Field label="Bei Ablauf alarmieren – Gruppen am Standort">
            <div className="grid sm:grid-cols-2 gap-1">
              {state.groups.filter((g) => g.id !== 'gr-alle').map((g) => (
                <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" checked={alertGroupIds.includes(g.id)} onChange={() => setAlertGroupIds(toggleId(alertGroupIds, g.id))} />
                  {g.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Zusätzlich einzelne Personen (unabhängig von Gruppe und Standort)">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inputClass + ' pl-9'}
                placeholder="Person suchen – Name, E-Mail oder Standort…"
                value={personenSuche}
                onChange={(e) => setPersonenSuche(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {auswahlPersonen.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={alertUserIds.includes(u.id)} onChange={() => setAlertUserIds(toggleId(alertUserIds, u.id))} />
                  <span className="flex-1">{u.firstName} {u.lastName}</span>
                  <span className="text-xs text-slate-400">{state.locations.find((l) => l.id === u.locationId)?.name}</span>
                </label>
              ))}
              {auswahlPersonen.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">Keine Person gefunden.</div>
              )}
            </div>
            <div className={`text-xs mt-1.5 ${anzahlEmpfaenger === 0 ? 'text-alarm-600' : 'text-slate-500'}`}>
              <b>{anzahlEmpfaenger} Person{anzahlEmpfaenger === 1 ? '' : 'en'}</b> würden bei Ablauf alarmiert{anzahlEmpfaenger === 0 ? ' – bitte mindestens eine Gruppe oder Person wählen' : ''}.
            </div>
          </Field>
          <div className="mb-4">
            <Toggle checked={silent} onChange={setSilent} label="Stille Alarmauslösung (unauffälliger Schutz)" />
          </div>
          <Button onClick={start} disabled={anzahlEmpfaenger === 0}><Play size={16} /> Timer starten</Button>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Clock size={16} /> Laufende Überwachungen</span>}>
          {running.length === 0 && <EmptyState>Keine aktive Alleinarbeit.</EmptyState>}
          <div className="space-y-3">
            {running.map((s) => <RunningSession key={s.id} session={s} now={now} />)}
          </div>
        </Card>
      </div>

      {past.length > 0 && (
        <Card title="Verlauf">
          <div className="space-y-1.5">
            {past.slice(0, 15).map((s) => {
              const user = state.users.find((u) => u.id === s.userId)
              return (
                <div key={s.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400">{formatDateTime(s.startedAt)}</span>
                  <span className="text-slate-700 flex-1">{user?.firstName} {user?.lastName} · {s.activity}</span>
                  {s.status === 'completed'
                    ? <Badge color="green"><CheckCircle2 size={12} /> sicher beendet</Badge>
                    : <Badge color="red"><ShieldAlert size={12} /> Alarm ausgelöst</Badge>}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function RunningSession({ session, now }: { session: LoneWorkSession; now: number }) {
  const { state, dispatch } = useStore()
  const user = state.users.find((u) => u.id === session.userId)
  const location = state.locations.find((l) => l.id === session.locationId)
  const remaining = session.expiresAt - now
  const critical = remaining < 5 * 60_000

  return (
    <div className={`rounded-lg border p-3 ${critical ? 'border-alarm-500 bg-alarm-50' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="font-medium text-slate-800 text-sm">
            {user?.firstName} {user?.lastName}
            {session.silent && <Badge color="violet">still</Badge>}
          </div>
          <div className="text-xs text-slate-500">{session.activity} · {location?.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Alarmiert bei Ablauf: {[
              ...(session.alertGroupIds?.length ? session.alertGroupIds : LONE_WORK_DEFAULT_GROUPS).map((id) => state.groups.find((g) => g.id === id)?.name),
              ...(session.alertUserIds ?? []).map((id) => { const u = state.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : '' }),
            ].filter(Boolean).join(', ')}
          </div>
        </div>
        <div className={`text-2xl font-mono font-bold ${critical ? 'text-alarm-600' : 'text-slate-800'}`}>
          {formatDuration(remaining)}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" onClick={() => dispatch({ type: 'EXTEND_LONE_WORK', sessionId: session.id, minutes: session.durationMin })}>
          Lebenszeichen (+{session.durationMin} Min.)
        </Button>
        <Button variant="secondary" onClick={() => dispatch({ type: 'COMPLETE_LONE_WORK', sessionId: session.id })}>
          <CheckCircle2 size={14} /> Sicher beendet
        </Button>
      </div>
    </div>
  )
}
