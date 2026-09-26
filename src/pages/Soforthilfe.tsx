import { useState } from 'react'
import { BellRing, LifeBuoy, Plus } from 'lucide-react'
import { resolveRecipients, uid, useStore } from '../store'
import type { AlarmPlan, EscalationLevel } from '../types'
import { Button, Card, Toggle, VORBEREITET } from '../components/ui'
import { AuswahlChip } from '../components/Wizard'
import { Ablauf, KanalWahl, StufenEditor } from './AlarmPlans'

/** Szenario, mit dem der Soforthilfe-Knopf fest verdrahtet ist */
const SOS_SCENARIO_ID = 'sc-sos'

/** Bisherige, fest im Code verdrahtete Standardwerte – gelten, solange kein eigener Plan gespeichert ist */
function sosVorgabe(): AlarmPlan {
  return {
    id: uid('pl'),
    name: 'SOS-Hilferuf (Soforthilfe-Knopf)',
    scenarioId: SOS_SCENARIO_ID,
    locationIds: [],
    groupIds: ['gr-ersthelfer', 'gr-sicherheit'],
    channels: ['push', 'sms', 'voice'],
    requireAck: true,
    escalation: [{ afterMinutes: 3, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
  }
}

/**
 * Eigener Menüpunkt für den Soforthilfe-Knopf (SOS): Vorher liess sich das
 * nur über Umweg «Szenarien → SOS – Hilferuf → verknüpfter Alarmplan» finden
 * und bearbeiten – zu versteckt für eine derart sicherheitsrelevante
 * Einstellung. Der Standort ist bewusst nicht editierbar: Der Knopf meldet
 * immer den Standort der auslösenden Person, ein Filter darauf wäre irreführend.
 */
export default function Soforthilfe() {
  const { state, dispatch } = useStore()
  const gespeicherterPlan = state.plans.find((p) => p.scenarioId === SOS_SCENARIO_ID)
  const [draft, setDraft] = useState<AlarmPlan>(() => (gespeicherterPlan ? { ...gespeicherterPlan } : sosVorgabe()))
  const [geaendert, setGeaendert] = useState(false)

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const erreicht = resolveRecipients(state, draft.groupIds, []).length

  function aendern(patch: Partial<AlarmPlan>) {
    setDraft((d) => ({ ...d, ...patch }))
    setGeaendert(true)
  }

  function updateEscalation(i: number, patch: Partial<EscalationLevel>) {
    aendern({ escalation: draft.escalation.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  function speichern() {
    dispatch({ type: 'UPSERT_PLAN', plan: draft })
    setGeaendert(false)
  }

  function zuruecksetzen() {
    setDraft(gespeicherterPlan ? { ...gespeicherterPlan } : sosVorgabe())
    setGeaendert(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <LifeBuoy size={22} className="text-alarm-500" /> Soforthilfe-Knopf
        </h1>
        <p className="text-sm text-muted mt-1">
          Wer benachrichtigt wird, wenn jemand in der App oder der App-Vorschau den Soforthilfe-Knopf (SOS)
          hält – unabhängig davon, wie eine Alarmauslösung über ein Szenario konfiguriert ist.
        </p>
      </div>

      {!gespeicherterPlan && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Noch kein eigener Alarmplan hinterlegt – unten stehen die bisherigen Standardwerte. Erst mit
          «Speichern» wird daraus ein eigener, im Portal sichtbarer Alarmplan.
        </p>
      )}

      <Card>
        <h4 className="font-semibold text-slate-700 text-sm mb-1">Wer wird sofort alarmiert</h4>
        <p className="text-xs text-muted mb-3">
          Ohne Auswahl gilt: alle Gruppen. Aktuell erreicht der Knopf{' '}
          <b className={erreicht === 0 ? 'text-alarm-600' : 'text-slate-700'}>{erreicht} {erreicht === 1 ? 'Person' : 'Personen'}</b>{' '}
          am Standort der auslösenden Person – der Standort wird automatisch übernommen und lässt sich hier nicht zusätzlich einschränken.
        </p>
        <div className="flex flex-wrap gap-2">
          {state.groups.map((g) => (
            <AuswahlChip key={g.id} aktiv={draft.groupIds.includes(g.id)} onClick={() => aendern({ groupIds: toggle(draft.groupIds, g.id) })}>
              {g.name}
            </AuswahlChip>
          ))}
        </div>
      </Card>

      <Card>
        <h4 className="font-semibold text-slate-700 text-sm mb-3">Worüber alarmiert wird</h4>
        <KanalWahl gewaehlt={draft.channels} onToggle={(c) => aendern({ channels: toggle(draft.channels, c) })} />
        <div className="flex flex-wrap gap-5 mt-4">
          <Toggle checked={draft.requireAck} onChange={(v) => aendern({ requireAck: v })} label="Quittierung verlangen" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-slate-700 text-sm">Wenn niemand quittiert</h4>
          <Button
            variant="secondary"
            onClick={() => aendern({ escalation: [...draft.escalation, { afterMinutes: 5, channels: ['voice'], groupIds: [], notifyEmergencyServices: false }] })}
          >
            <Plus size={14} /> Stufe
          </Button>
        </div>
        <p className="text-xs text-muted mb-3">
          Eine Stufe zündet nur, solange <b>niemand</b> quittiert hat. Eine einzige Quittierung hält den
          ganzen Ablauf an.
        </p>
        {draft.escalation.length === 0 ? (
          <p className="text-sm text-faint rounded-xl border border-dashed border-slate-200 p-4 text-center">
            Keine Eskalation – bleibt eine Quittierung aus, passiert nichts weiter.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.escalation.map((esc, i) => (
              <StufenEditor
                key={i}
                stufe={esc}
                nummer={i + 1}
                onAendern={(patch) => updateEscalation(i, patch)}
                onLoeschen={() => aendern({ escalation: draft.escalation.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <BellRing size={15} className="text-faint" />
          <h4 className="font-semibold text-slate-700 text-sm">So läuft der Alarm ab</h4>
        </div>
        <Ablauf plan={draft} />
      </Card>

      <p className="text-xs text-faint">
        Änderungen wirken sofort für die App-Vorschau im Webportal. In der installierten mobilen App
        braucht es dafür einen neuen App-Build über «Aktualisierung» – bis dahin gelten dort weiterhin die
        zuletzt installierten Werte.
      </p>

      <div className="flex justify-end gap-2">
        {geaendert && <Button variant="secondary" onClick={zuruecksetzen}>Verwerfen</Button>}
        <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
      </div>
    </div>
  )
}
