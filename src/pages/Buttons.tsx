import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BatteryLow, BatteryMedium, BatteryFull, MapPin, Pencil, Plus, Radio, Trash2, Zap } from 'lucide-react'
import { createAlarm, uid, useStore } from '../store'
import type { AlarmButton } from '../types'
import { Badge, Button, Card, Field, Modal, formatDateTime, inputClass, useConfirm, Vorbereitet } from '../components/ui'

export default function Buttons() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<AlarmButton | null>(null)
  const { ask, confirmEl } = useConfirm()
  const lorawanAktiv = state.integrations.lorawan.enabled

  function newButton(): AlarmButton {
    return {
      id: uid('btn'), name: '', type: 'lorawan', serial: `LW-${Math.floor(1000 + Math.random() * 9000)}-X${Math.floor(Math.random() * 10)}`,
      batteryPct: 100, lastSeen: Date.now(), messageTemplate: 'Alarmknopf ausgelöst – bitte Lage prüfen.',
      targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }
  }

  function testFire(button: AlarmButton) {
    const alarm = createAlarm(state, {
      scenarioId: button.scenarioId ?? 'sc-gewalt',
      message: `${button.messageTemplate} (Knopf: ${button.name}, ${button.serial}${button.gps ? `, GPS ${button.gps.lat.toFixed(4)}/${button.gps.lng.toFixed(4)}` : ''})`,
      silent: true,
      requireAck: true,
      channels: ['push', 'sms'],
      groupIds: button.targetGroupIds,
      locationIds: button.locationId ? [button.locationId] : [],
      triggeredByUserId: button.assignedUserId ?? state.currentUserId,
      triggeredVia: 'button',
      escalation: [
        { afterMinutes: button.escalateToEmergencyServicesAfterMin, channels: ['voice', 'sms'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true },
      ],
    })
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `Alarmknopf ausgelöst: ${button.name} (${button.type.toUpperCase()}) – stille Alarmierung mit Standortübertragung` })
    navigate('/monitor')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Physische Alarmknöpfe {!lorawanAktiv && <Vorbereitet />}
          </h1>
          <p className="text-sm text-slate-500">
            LoRaWAN- und GSM-Notfallknöpfe – app-unabhängig, diskret, mit Standortübertragung und automatischer Eskalation.
            {lorawanAktiv
              ? ' Der Uplink-Endpunkt ist aktiv: Ein Knopfdruck löst den hier hinterlegten stillen Alarm aus, Statusmeldungen aktualisieren Batterie und «letztes Signal».'
              : ' Der Uplink-Endpunkt ist unter Integrationen noch nicht aktiviert – die Einträge hier dienen der Planung, ein Knopfdruck löst noch keinen Alarm aus.'}
          </p>
        </div>
        <Button onClick={() => setEditing(newButton())}><Plus size={16} /> Knopf registrieren</Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.buttons.map((b) => {
          const location = state.locations.find((l) => l.id === b.locationId)
          const assignee = state.users.find((u) => u.id === b.assignedUserId)
          const BatteryIcon = b.batteryPct < 20 ? BatteryLow : b.batteryPct < 60 ? BatteryMedium : BatteryFull
          return (
            <Card key={b.id}>
              <div className="flex items-start gap-3">
                <Radio size={28} className="text-slate-400 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{b.name}</div>
                  <div className="text-xs text-slate-400">{b.serial}</div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <Badge color={b.type === 'lorawan' ? 'blue' : 'violet'}>{b.type === 'lorawan' ? 'LoRaWAN' : 'GSM + GPS'}</Badge>
                    <Badge color={b.batteryPct < 20 ? 'red' : 'green'}>
                      <BatteryIcon size={12} /> {b.batteryPct} %
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 space-y-1">
                <div>Standort: {location?.name ?? 'mobil'}</div>
                {assignee && <div>Zugewiesen: {assignee.firstName} {assignee.lastName}</div>}
                {b.gps && <div className="flex items-center gap-1"><MapPin size={12} /> GPS: {b.gps.lat.toFixed(4)}, {b.gps.lng.toFixed(4)}</div>}
                <div>Letztes Signal: {formatDateTime(b.lastSeen)}</div>
                <div>Eskalation an Blaulicht nach {b.escalateToEmergencyServicesAfterMin} Min. ohne Reaktion</div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="danger" onClick={() => ask(`Alarmknopf «${b.name}» jetzt testweise auslösen?`, () => testFire(b), 'Auslösen')}><Zap size={14} /> Auslösen (Test)</Button>
                <Button variant="ghost" onClick={() => setEditing(b)}><Pencil size={14} /></Button>
                <Button variant="ghost" onClick={() => ask(`Alarmknopf «${b.name}» entfernen?`, () => dispatch({ type: 'DELETE_BUTTON', buttonId: b.id }), 'Entfernen')}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {confirmEl}
      {editing && <ButtonEditor button={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ButtonEditor({ button, onClose }: { button: AlarmButton; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<AlarmButton>({ ...button })

  return (
    <Modal title={button.name ? `Alarmknopf: ${button.name}` : 'Alarmknopf registrieren'} onClose={onClose}>
      <Field label="Bezeichnung">
        <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Typ">
          <select className={inputClass} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AlarmButton['type'] })}>
            <option value="lorawan">LoRaWAN (Batterie &gt; 4 Jahre)</option>
            <option value="gsm">GSM mit GPS-Tracking</option>
          </select>
        </Field>
        <Field label="Seriennummer">
          <input className={inputClass} value={draft.serial} onChange={(e) => setDraft({ ...draft, serial: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Standort">
          <select className={inputClass} value={draft.locationId ?? ''} onChange={(e) => setDraft({ ...draft, locationId: e.target.value || undefined })}>
            <option value="">Mobil / kein fester Standort</option>
            {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Zugewiesene Person">
          <select className={inputClass} value={draft.assignedUserId ?? ''} onChange={(e) => setDraft({ ...draft, assignedUserId: e.target.value || undefined })}>
            <option value="">–</option>
            {state.users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Individuelle Alarmnachricht">
        <textarea className={inputClass} rows={2} value={draft.messageTemplate} onChange={(e) => setDraft({ ...draft, messageTemplate: e.target.value })} />
      </Field>
      <Field label="Ausgelöstes Szenario">
        <select className={inputClass} value={draft.scenarioId ?? 'sc-gewalt'} onChange={(e) => setDraft({ ...draft, scenarioId: e.target.value })}>
          {state.scenarios.filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </Field>
      <Field label="Alarmierte Personengruppen">
        <div className="space-y-1">
          {state.groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.targetGroupIds.includes(g.id)}
                onChange={() =>
                  setDraft({
                    ...draft,
                    targetGroupIds: draft.targetGroupIds.includes(g.id)
                      ? draft.targetGroupIds.filter((id) => id !== g.id)
                      : [...draft.targetGroupIds, g.id],
                  })
                }
              />
              {g.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label={`Eskalation an Blaulichtorganisationen nach ${draft.escalateToEmergencyServicesAfterMin} Min. ohne Reaktion`}>
        <input
          type="range" min={1} max={30} className="w-full"
          value={draft.escalateToEmergencyServicesAfterMin}
          onChange={(e) => setDraft({ ...draft, escalateToEmergencyServicesAfterMin: Number(e.target.value) })}
        />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={() => { dispatch({ type: 'UPSERT_BUTTON', button: draft }); onClose() }} disabled={!draft.name.trim()}>
          Speichern
        </Button>
      </div>
    </Modal>
  )
}
