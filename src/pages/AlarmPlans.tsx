import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BellRing, Check, ClipboardList, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { resolveRecipients, uid, useStore } from '../store'
import type { AlarmPlan, Channel, EscalationLevel, IntegrationSettings } from '../types'
import { CHANNEL_LABELS } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, inputClass, useConfirm, VORBEREITET, Vorbereitet } from '../components/ui'
import { AuswahlChip, Wizard } from '../components/Wizard'
import { ScenarioIcon } from '../components/ScenarioIcon'
import { KANAL_KURZ, kanalHinweis, kanalZustand } from '../lib/kanaele'

const ALL_CHANNELS: Channel[] = ['push', 'sms', 'email', 'voice', 'conference', 'tts', 'teams']

/** Abzeichen eines Kanals – die Farbe sagt, ob darüber wirklich zugestellt wird */
function KanalBadge({ kanal, integ }: { kanal: Channel; integ: IntegrationSettings | undefined }) {
  const zustand = kanalZustand(kanal, integ)
  return (
    <span
      title={kanalHinweis(kanal, integ)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        zustand === 'aktiv'
          ? 'bg-emerald-50 text-emerald-700'
          : zustand === 'nicht eingerichtet'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-muted'
      }`}
    >
      {KANAL_KURZ[kanal]}
      {zustand !== 'aktiv' && <AlertTriangle size={11} />}
    </span>
  )
}

/**
 * Der Ablauf eines Plans als Zeitachse: zuoberst die Erstalarmierung, darunter
 * jede Eskalationsstufe mit ihrer Frist. Vorher standen dieselben Angaben als
 * graue Textzeilen untereinander – wer wann dazukommt, musste man sich
 * zusammenlesen.
 */
export function Ablauf({ plan }: { plan: AlarmPlan }) {
  const { state } = useStore()
  const integ = state.integrations
  const name = (id: string) => state.groups.find((g) => g.id === id)?.name ?? id

  const stufen = [
    {
      frist: 'Sofort',
      gruppen: plan.groupIds.length ? plan.groupIds.map(name) : ['alle Gruppen'],
      kanaele: plan.channels,
      blaulicht: false,
    },
    ...plan.escalation.map((e) => ({
      frist: `nach ${e.afterMinutes} Min.`,
      gruppen: e.groupIds.length ? e.groupIds.map(name) : ['alle Gruppen'],
      kanaele: e.channels,
      blaulicht: e.notifyEmergencyServices,
    })),
  ]

  return (
    <ol className="mt-3 space-y-0">
      {stufen.map((s, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center shrink-0 pt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-alarm-500' : 'bg-slate-300'}`} />
            {i < stufen.length - 1 && <span className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          <div className={`min-w-0 flex-1 ${i < stufen.length - 1 ? 'pb-3' : ''}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs font-semibold text-slate-700 tabular-nums">{s.frist}</span>
              <span className="text-sm text-slate-600 min-w-0">
                {i > 0 && <span className="text-faint">zusätzlich </span>}
                {s.gruppen.join(', ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {s.kanaele.map((c) => <KanalBadge key={c} kanal={c} integ={integ} />)}
              {s.blaulicht && (
                <span className="text-xs text-faint" title="Das System alarmiert keine Einsatzleitzentrale – der Notruf wird von Hand gewählt.">
                  Blaulicht vorgemerkt
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function AlarmPlans() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<AlarmPlan | null>(null)
  const [wizardOffen, setWizardOffen] = useState(false)
  const [suche, setSuche] = useState('')
  const { ask, confirmEl } = useConfirm()

  /** Sucht über Name, Szenario, Gruppen und Standorte */
  const plaene = useMemo(() => {
    const begriffe = suche.toLowerCase().split(/\s+/).filter(Boolean)
    if (begriffe.length === 0) return state.plans
    return state.plans.filter((p) => {
      const szenario = state.scenarios.find((s) => s.id === p.scenarioId)?.title ?? ''
      const gruppen = p.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name ?? '').join(' ')
      const orte = p.locationIds.map((l) => state.locations.find((x) => x.id === l)?.name ?? '').join(' ')
      const heuhaufen = `${p.name} ${szenario} ${gruppen} ${orte}`.toLowerCase()
      return begriffe.every((b) => heuhaufen.includes(b))
    })
  }, [state.plans, state.scenarios, state.groups, state.locations, suche])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alarmpläne</h1>
          <p className="text-sm text-muted">
            Wer bei welchem Ereignis alarmiert wird – und wer dazukommt, wenn niemand quittiert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className={inputClass + ' pl-9 w-56'}
              placeholder="Plan suchen…"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>
          <Button onClick={() => setWizardOffen(true)}><Plus size={16} /> Neuer Alarmplan</Button>
        </div>
      </div>

      {state.plans.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <ClipboardList size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-muted mb-4">
              Noch kein Alarmplan. Der Assistent führt in fünf Schritten durch die Einrichtung.
            </p>
            <Button onClick={() => setWizardOffen(true)}><Plus size={16} /> Ersten Alarmplan erstellen</Button>
          </div>
        </Card>
      )}

      {state.plans.length > 0 && plaene.length === 0 && (
        <p className="text-sm text-faint">Kein Alarmplan passt zu dieser Suche.</p>
      )}

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        {plaene.map((p) => {
          const scenario = state.scenarios.find((s) => s.id === p.scenarioId)
          const erreicht = resolveRecipients(state, p.groupIds, p.locationIds).length
          const orte = p.locationIds.map((l) => state.locations.find((x) => x.id === l)?.name).filter(Boolean)
          return (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted">
                    {scenario ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ScenarioIcon name={scenario.icon} size={14} className="text-faint" /> {scenario.title}
                      </span>
                    ) : (
                      <span className="text-faint">ohne festes Szenario</span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={13} className="text-faint" />
                      {erreicht} {erreicht === 1 ? 'Person' : 'Personen'} sofort
                    </span>
                    <span className="text-faint">{orte.length ? orte.join(', ') : 'alle Standorte'}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" onClick={() => setEditing(p)} title="Bearbeiten"><Pencil size={14} /></Button>
                  <Button
                    variant="ghost"
                    title="Löschen"
                    onClick={() => ask(`Alarmplan «${p.name}» löschen?`, () => dispatch({ type: 'DELETE_PLAN', planId: p.id }))}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <Ablauf plan={p} />

              {(p.requireAck || p.respectOperatingHours) && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                  {p.requireAck && <Badge color="violet">Quittierung erforderlich</Badge>}
                  {p.respectOperatingHours && <Badge color="amber">nur Betriebszeiten ({VORBEREITET})</Badge>}
                </div>
              )}
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

/** Kanalwahl als Chips samt Hinweis, worüber heute nichts hinausgeht */
export function KanalWahl({ gewaehlt, onToggle }: { gewaehlt: Channel[]; onToggle: (c: Channel) => void }) {
  const { state } = useStore()
  const integ = state.integrations
  const stumm = gewaehlt.filter((c) => kanalZustand(c, integ) !== 'aktiv')
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ALL_CHANNELS.map((c) => (
          <AuswahlChip key={c} aktiv={gewaehlt.includes(c)} onClick={() => onToggle(c)}>
            <span title={kanalHinweis(c, integ)}>{CHANNEL_LABELS[c]}</span>
          </AuswahlChip>
        ))}
      </div>
      {stumm.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2 flex items-start gap-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            Über {stumm.map((c) => KANAL_KURZ[c]).join(', ')} geht heute nichts hinaus.{' '}
            {stumm.some((c) => c !== 'email' && c !== 'tts') && (
              <>Einrichten unter <Link to="/integrationen" className="underline">Einstellungen &amp; Konfiguration</Link>. </>
            )}
            Der Plan lässt sich trotzdem speichern – die Wahl gilt, sobald der Kanal angebunden ist.
          </span>
        </p>
      )}
    </>
  )
}

/**
 * Die zwei Arten einer Eskalationsstufe zur Wahl.
 *
 * Als Kärtchen mit Erklärung statt als Häkchen: Die Entscheidung ist
 * folgenreich – sie bestimmt, ob der Krisenstab im Ernstfall überhaupt
 * aufgeboten wird – und lässt sich nicht aus einer Beschriftung erraten.
 */
function ArtWahl({ aktiv, onClick, titel, text }: { aktiv: boolean; onClick: () => void; titel: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={`text-left rounded-lg border p-3 transition ${
        aktiv ? 'bg-brand-50 border-brand-600 ring-1 ring-brand-600' : 'bg-white border-slate-300 hover:border-brand-400'
      }`}
    >
      <div className={`text-sm font-semibold flex items-center gap-1.5 ${aktiv ? 'text-brand-700' : 'text-slate-700'}`}>
        {aktiv && <Check size={14} />}
        {titel}
      </div>
      <div className="text-xs text-muted mt-1 leading-snug">{text}</div>
    </button>
  )
}

/** Eine Eskalationsstufe im Editor */
export function StufenEditor({
  stufe, nummer, onAendern, onLoeschen,
}: { stufe: EscalationLevel; nummer: number; onAendern: (patch: Partial<EscalationLevel>) => void; onLoeschen: () => void }) {
  const { state } = useStore()
  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold shrink-0">
          {nummer}
        </span>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          zündet nach
          <input
            type="number" min={1} className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
            value={stufe.afterMinutes}
            onChange={(e) => onAendern({ afterMinutes: Math.max(1, Number(e.target.value)) })}
          />
          Minuten
        </label>
        <Button variant="ghost" className="ml-auto" onClick={onLoeschen} title="Stufe entfernen"><Trash2 size={14} /></Button>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-muted mb-1.5">Zusätzlich alarmieren</div>
        <div className="flex flex-wrap gap-2">
          {state.groups.map((g) => (
            <AuswahlChip key={g.id} aktiv={stufe.groupIds.includes(g.id)} onClick={() => onAendern({ groupIds: toggle(stufe.groupIds, g.id) })}>
              {g.name}
            </AuswahlChip>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-muted mb-1.5">Über diese Kanäle</div>
        <KanalWahl gewaehlt={stufe.channels} onToggle={(c) => onAendern({ channels: toggle(stufe.channels, c) })} />
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-muted mb-1.5">Wann diese Stufe zündet</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <ArtWahl
            aktiv={!stufe.nurWennUnbeantwortet}
            onClick={() => onAendern({ nurWennUnbeantwortet: false })}
            titel="Planmässig"
            text="Zündet nach der Frist, auch wenn schon jemand zugesagt hat. Für Lagen, in denen diese Gruppe ohnehin gebraucht wird – Evakuationsteam bei Brand, Krisenstab bei einer Vermisstensuche."
          />
          <ArtWahl
            aktiv={!!stufe.nurWennUnbeantwortet}
            onClick={() => onAendern({ nurWennUnbeantwortet: true })}
            titel="Nur ohne Zusage"
            text="Entfällt, sobald jemand zugesagt hat. Für Lagen, die mit einer Zusage erledigt sind – meldet sich die Schulsanität, muss der Sicherheitsdienst nicht auch ausrücken."
          />
        </div>
      </div>

      <label className="flex flex-wrap items-center gap-2 mt-3 text-sm text-slate-600">
        <input
          type="checkbox" checked={stufe.notifyEmergencyServices}
          onChange={(e) => onAendern({ notifyEmergencyServices: e.target.checked })}
        />
        Blaulichtorganisationen vormerken <Vorbereitet />
      </label>
      {stufe.notifyEmergencyServices && (
        <p className="text-xs text-muted mt-1.5 pl-6">
          Das System alarmiert keine Einsatzleitzentrale – dafür gibt es keine Schnittstelle. Der Vermerk
          erscheint im Alarmjournal mit dem Hinweis, den Notruf von Hand zu wählen.
        </p>
      )}
    </div>
  )
}

/** Bestehenden Plan bearbeiten – dieselben Schritte wie im Assistenten, nur alle auf einmal */
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
  const [draft, setDraft] = useState<AlarmPlan>(() => JSON.parse(JSON.stringify(plan)) as AlarmPlan)

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const erreicht = resolveRecipients(state, draft.groupIds, draft.locationIds).length

  function updateEscalation(i: number, patch: Partial<EscalationLevel>) {
    setDraft({ ...draft, escalation: draft.escalation.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  return (
    <Modal title={plan.name ? `Alarmplan: ${plan.name}` : 'Neuer Alarmplan'} onClose={onClose} wide>
      <div className="space-y-6">
        <section>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name des Alarmplans">
              <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Verknüpftes Szenario">
              <select className={inputClass} value={draft.scenarioId ?? ''} onChange={(e) => setDraft({ ...draft, scenarioId: e.target.value || undefined })}>
                <option value="">ohne festes Szenario</option>
                {state.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h4 className="font-semibold text-slate-700 text-sm mb-1">Wer wird sofort alarmiert</h4>
          <p className="text-xs text-muted mb-3">
            Ohne Auswahl gilt: alle Gruppen, alle Standorte. Aktuell erreicht der Plan{' '}
            <b className={erreicht === 0 ? 'text-alarm-600' : 'text-slate-700'}>{erreicht} {erreicht === 1 ? 'Person' : 'Personen'}</b>.
          </p>
          <div className="text-xs font-medium text-muted mb-1.5">Zielgruppen</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {state.groups.map((g) => (
              <AuswahlChip key={g.id} aktiv={draft.groupIds.includes(g.id)} onClick={() => setDraft({ ...draft, groupIds: toggle(draft.groupIds, g.id) })}>
                {g.name}
              </AuswahlChip>
            ))}
          </div>
          <div className="text-xs font-medium text-muted mb-1.5">Standorte</div>
          <div className="flex flex-wrap gap-2">
            {state.locations.map((l) => (
              <AuswahlChip key={l.id} aktiv={draft.locationIds.includes(l.id)} onClick={() => setDraft({ ...draft, locationIds: toggle(draft.locationIds, l.id) })}>
                {l.name}
              </AuswahlChip>
            ))}
          </div>
        </section>

        <section>
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Worüber alarmiert wird</h4>
          <KanalWahl gewaehlt={draft.channels} onToggle={(c) => setDraft({ ...draft, channels: toggle(draft.channels, c) })} />
          <div className="flex flex-wrap gap-5 mt-4">
            <Toggle checked={draft.requireAck} onChange={(v) => setDraft({ ...draft, requireAck: v })} label="Quittierung verlangen" />
            <Toggle
              checked={draft.respectOperatingHours}
              onChange={(v) => setDraft({ ...draft, respectOperatingHours: v })}
              label={`Nur während Betriebszeiten – ${VORBEREITET}`}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-slate-700 text-sm">Wenn niemand quittiert</h4>
            <Button
              variant="secondary"
              onClick={() => setDraft({ ...draft, escalation: [...draft.escalation, { afterMinutes: 5, channels: ['voice'], groupIds: [], notifyEmergencyServices: false }] })}
            >
              <Plus size={14} /> Stufe
            </Button>
          </div>
          <p className="text-xs text-muted mb-3">
            Eine Stufe zündet nur, solange <b>niemand</b> quittiert hat. Eine einzige Quittierung hält den
            ganzen Plan an.
          </p>
          {draft.escalation.length === 0 ? (
            <p className="text-sm text-faint rounded-xl border border-dashed border-slate-200 p-4 text-center">
              Keine Eskalation – es bleibt bei dieser einen Alarmierung.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.escalation.map((esc, i) => (
                <StufenEditor
                  key={i}
                  stufe={esc}
                  nummer={i + 1}
                  onAendern={(patch) => updateEscalation(i, patch)}
                  onLoeschen={() => setDraft({ ...draft, escalation: draft.escalation.filter((_, j) => j !== i) })}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BellRing size={15} className="text-faint" />
            <h4 className="font-semibold text-slate-700 text-sm">So läuft der Plan ab</h4>
          </div>
          <Ablauf plan={draft} />
        </section>
      </div>

      <div className="flex justify-end gap-2 mt-6">
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
                    <ClipboardList size={20} className="text-faint mb-1.5" />
                    <div className="text-sm font-medium text-slate-700">Ohne festes Szenario</div>
                    <div className="text-[11px] text-faint">freier Plan</div>
                  </button>
                  {state.scenarios.map((s) => (
                    <button
                      key={s.id} type="button" onClick={() => szenarioWaehlen(s.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        draft.scenarioId === s.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <ScenarioIcon name={s.icon} size={20} className={`mb-1.5 ${draft.scenarioId === s.id ? 'text-brand-600' : 'text-faint'}`} />
                      <div className="text-sm font-medium text-slate-700 leading-tight">{s.title}</div>
                      <div className="text-[11px] text-faint mt-0.5">{s.category}</div>
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
          titel: 'Empfänger:innen',
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
                <KanalWahl gewaehlt={draft.channels} onToggle={(c) => setDraft({ ...draft, channels: toggleIn(draft.channels, c) })} />
              </Field>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <Toggle checked={draft.requireAck} onChange={(v) => setDraft({ ...draft, requireAck: v })} label="Aufgebot mit Quittierfunktion" />
                  <p className="text-xs text-muted mt-1 ml-11">
                    Empfänger:innen bestätigen den Erhalt. Ob eine Zusage die nächste Stufe abwendet, entscheiden Sie je Stufe unten.
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
                <p className="text-sm text-faint border border-dashed border-slate-300 rounded-xl px-4 py-6 text-center mb-3">
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
                  <div className="text-xs text-faint mb-1">Zusätzliche Gruppen</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {state.groups.map((g) => (
                      <AuswahlChip key={g.id} aktiv={esc.groupIds.includes(g.id)} onClick={() => updateEscalation(i, { groupIds: toggleIn(esc.groupIds, g.id) })}>
                        {g.name}
                      </AuswahlChip>
                    ))}
                  </div>
                  <div className="text-xs text-faint mb-1">Kanäle dieser Stufe</div>
                  <div className="mb-2">
                    <KanalWahl gewaehlt={esc.channels} onToggle={(c) => updateEscalation(i, { channels: toggleIn(esc.channels, c) })} />
                  </div>
                  <label className="flex flex-wrap items-center gap-1.5">
                    <input type="checkbox" checked={esc.notifyEmergencyServices} onChange={(e) => updateEscalation(i, { notifyEmergencyServices: e.target.checked })} />
                    Blaulichtorganisationen vormerken <Vorbereitet />
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
                  <div className="text-sm text-muted">{szenario ? `Szenario: ${szenario.title}` : 'ohne festes Szenario'}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {draft.requireAck && <Badge color="violet">Quittierung</Badge>}
                    {draft.respectOperatingHours && <Badge color="amber">nur Betriebszeiten</Badge>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 space-y-1">
                <div>Zielgruppen: {draft.groupIds.map((g) => state.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || 'alle'}</div>
                <div>Standorte: {draft.locationIds.map((l) => state.locations.find((x) => x.id === l)?.name).filter(Boolean).join(', ') || 'alle'}</div>
              </div>
              <div className="mt-3 rounded-xl bg-white border border-brand-100 px-3 py-2">
                <Ablauf plan={draft} />
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
