import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BatteryLow, BatteryMedium, BatteryFull, Copy, MapPin, Pencil, Plus, Radio, Trash2, Zap, PlugZap, Check } from 'lucide-react'
import { createAlarm, uid, useStore } from '../store'
import { api } from '../lib/api'
import { HALTEZEIT, haltezeitBefehl } from '../lib/geraetebefehle'
import type { AlarmButton } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, formatDateTime, inputClass, useConfirm } from '../components/ui'

/**
 * Haltezeit der Alarmtaste.
 *
 * Die Zeit steckt im Gerät, nicht im Alarmserver – und der Alarmserver kann sie
 * nicht setzen: Das Gateway steht im Haus hinter dem Router, er beim Hoster.
 * Alle Verbindungen gehen von innen nach aussen, ein Rückweg besteht nicht.
 *
 * Was das Portal abnehmen kann, ist die Rechnerei: Es bildet den fertigen
 * Funkbefehl, der im Gateway nur noch einzufügen ist. Der Wert wird bewusst
 * **nicht gespeichert** – das Portal weiss nicht, ob der Befehl je ankam, und
 * eine gespeicherte Zahl sähe aus wie eine Tatsache.
 */
function Haltezeitrechner({ geraetetyp }: { geraetetyp?: string }) {
  const grenzen = geraetetyp ? HALTEZEIT[geraetetyp] : undefined
  const [wert, setWert] = useState<number>(grenzen?.werk ?? 0)
  const [kopiert, setKopiert] = useState(false)
  useEffect(() => { setWert(grenzen?.werk ?? 0) }, [geraetetyp])
  if (!grenzen) return null
  const befehl = haltezeitBefehl(geraetetyp, wert)
  if (!befehl) return null

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600 mb-1">Haltezeit der Alarmtaste</div>
      <p className="text-xs text-slate-500 mb-2.5">
        Wie lange gedrückt werden muss, entscheidet das Gerät. Der Alarmserver kann es nicht
        einstellen – er erreicht das Gateway nicht. Hier entsteht der Funkbefehl dafür.
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <Field label={grenzen.einheit} className="w-32">
          <input
            type="number" className={inputClass}
            min={grenzen.min} max={grenzen.max} step={grenzen.schritt}
            value={wert}
            onChange={(e) => setWert(Number(e.target.value))}
          />
        </Field>
        <div className="flex items-center gap-2 pb-1">
          <code className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5">{befehl.downlink}</code>
          <Button
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(befehl.downlink).then(() => {
                setKopiert(true)
                setTimeout(() => setKopiert(false), 2000)
              })
            }}
            aria-label="Befehl kopieren"
          ><Copy size={13} /></Button>
          {kopiert && <span className="text-xs text-emerald-700">kopiert</span>}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Im Gateway beim Gerät auf <span className="font-medium">Downlink</span>, FPort <code>1</code>,
        den Befehl bei <span className="font-medium">HEX Bytes</span> einfügen und senden.
        <b> Er erreicht das Gerät erst nach dessen nächstem Uplink</b> – danach einmal die Taste drücken.
        Über Kabel geht auch <code>{befehl.at}</code>.
      </p>
      {grenzen.vorbehalt && <p className="text-xs text-amber-700 mt-1">{grenzen.vorbehalt}</p>}
    </div>
  )
}

export default function Buttons() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<AlarmButton | null>(null)
  const { ask, confirmEl } = useConfirm()
  const lorawanAktiv = state.integrations.lorawan.enabled
  const istAdmin = state.users.find((u) => u.id === state.currentUserId)?.role === 'admin'

  /** Endpunkt direkt von hier einschalten – wer Knöpfe erfasst, will ihn auch scharf stellen */
  function aktiviereUplink() {
    dispatch({
      type: 'UPDATE_INTEGRATIONS',
      integrations: { ...state.integrations, lorawan: { ...state.integrations.lorawan, enabled: true } },
    })
  }

  function newButton(): AlarmButton {
    return {
      // Weder Seriennummer noch Signal erfinden: Eine vorgegebene Nummer
      // verleitet dazu, sie durch die aufgedruckte statt durch die DevEUI zu
      // ersetzen, und ein gesetztes «letztes Signal» liesse einen Knopf
      // lebendig aussehen, von dem noch nie etwas angekommen ist.
      id: uid('btn'), name: '', type: 'lorawan', serial: '',
      batteryPct: 100, lastSeen: 0, messageTemplate: 'Alarmknopf ausgelöst – bitte Lage prüfen.',
      targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }
  }

  function testFire(button: AlarmButton) {
    const alarm = createAlarm(state, {
      scenarioId: button.scenarioId ?? 'sc-gewalt',
      message: `${button.messageTemplate} (Knopf: ${button.name}, ${button.serial}${button.gps ? `, GPS ${button.gps.lat.toFixed(4)}/${button.gps.lng.toFixed(4)}` : ''})`,
      silent: button.silent ?? false,
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
    dispatch({ type: 'TRIGGER_ALARM', alarm, audit: `Alarmknopf ausgelöst: ${button.name} (${button.type.toUpperCase()}) – ${alarm.silent ? 'stille' : 'laute'} Alarmierung` })
    navigate('/monitor')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Physische Alarmknöpfe
            {lorawanAktiv && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-medium">
                <Check size={12} /> Uplink aktiv
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500">
            LoRaWAN- und GSM-Notfallknöpfe – app-unabhängig, diskret, mit Standortübertragung und automatischer Eskalation.
            {lorawanAktiv && ' Ein Knopfdruck löst den hier hinterlegten stillen Alarm aus; Statusmeldungen aktualisieren Batterie und «letztes Signal».'}
          </p>
        </div>
        <Button onClick={() => setEditing(newButton())}><Plus size={16} /> Knopf registrieren</Button>
      </div>

      {!lorawanAktiv && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <PlugZap size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-amber-900 text-sm">Uplink-Endpunkt ist ausgeschaltet</div>
            <p className="text-sm text-amber-800 mt-0.5">
              Geräte können Sie hier trotzdem erfassen und vorbereiten. Damit ein Knopfdruck aber wirklich
              einen Alarm auslöst, muss der Endpunkt eingeschaltet sein – danach tragen Sie die angezeigte
              Adresse und das Zugangstoken im Netzserver ein.
            </p>
          </div>
          {istAdmin ? (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button onClick={aktiviereUplink}><PlugZap size={14} /> Jetzt aktivieren</Button>
              <Button variant="secondary" onClick={() => navigate('/integrationen')}>Zu den Einstellungen</Button>
            </div>
          ) : (
            <span className="text-xs text-amber-700 shrink-0">Einschalten kann das die Administration.</span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.buttons.map((b) => {
          const location = state.locations.find((l) => l.id === b.locationId)
          const assignee = state.users.find((u) => u.id === b.assignedUserId)
          const schwelleBatterie = state.integrations?.lorawan?.batterieWarnungProzent ?? 20
          const BatteryIcon = b.batteryPct < schwelleBatterie ? BatteryLow : b.batteryPct < 60 ? BatteryMedium : BatteryFull
          // Der Server überwacht dasselbe und meldet es der Administration –
          // hier steht es dort, wo man den Knopf ohnehin verwaltet
          const stundenStill = (Date.now() - b.lastSeen) / 3600_000
          const stummSeit = b.lastSeen > 0 && stundenStill > (state.integrations?.lorawan?.stilleWarnungStunden ?? 36)
          // Ohne je empfangenes Signal ist der Batteriestand nicht bekannt –
          // «100 %» wäre eine Behauptung, die niemand geprüft hat
          const nieGemeldet = b.lastSeen === 0
          const batterieSchwach = !nieGemeldet && b.batteryPct < schwelleBatterie
          return (
            <Card key={b.id} className={stummSeit || batterieSchwach ? 'border-amber-300' : ''}>
              <div className="flex items-start gap-3">
                <Radio size={28} className="text-slate-400 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{b.name}</div>
                  <div className="text-xs text-slate-400">{b.serial}</div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <Badge color={b.type === 'lorawan' ? 'blue' : 'violet'}>{b.type === 'lorawan' ? 'LoRaWAN' : 'Mobilfunk'}</Badge>
                    <Badge color={nieGemeldet ? 'slate' : batterieSchwach ? 'red' : 'green'}>
                      <BatteryIcon size={12} /> {nieGemeldet ? 'unbekannt' : `${b.batteryPct} %`}
                    </Badge>
                    {b.silent && <Badge color="violet">still</Badge>}
                    {nieGemeldet && <Badge color="amber">noch nie gemeldet</Badge>}
                    {stummSeit && <Badge color="amber">ohne Signal</Badge>}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 space-y-1">
                <div>Standort: {location?.name ?? 'mobil'}</div>
                {assignee && <div>Zugewiesen: {assignee.firstName} {assignee.lastName}</div>}
                {b.gps && <div className="flex items-center gap-1"><MapPin size={12} /> GPS: {b.gps.lat.toFixed(4)}, {b.gps.lng.toFixed(4)}</div>}
                <div className={stummSeit ? 'text-amber-700 font-medium' : ''}>
                  Letztes Signal: {b.lastSeen > 0 ? formatDateTime(b.lastSeen) : 'noch keines empfangen'}
                  {stummSeit && ' – Knopf prüfen'}
                </div>
                <div>Krisenstab aufbieten nach {b.escalateToEmergencyServicesAfterMin} Min. ohne Quittierung</div>
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
  // Welche Modelle der Alarmserver selbst übersetzen kann, weiss nur er
  const [typen, setTypen] = useState<{ id: string; name: string; hinweis: string }[]>([
    { id: 'auto', name: 'Netzserver übersetzt (Standard)', hinweis: '' },
  ])
  useEffect(() => {
    api.lorawanGeraetetypen().then((a) => setTypen(a.typen)).catch(() => {})
  }, [])

  return (
    <Modal title={button.name ? `Alarmknopf: ${button.name}` : 'Alarmknopf registrieren'} onClose={onClose}>
      <Field label="Bezeichnung">
        <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Funkweg">
          <select className={inputClass} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AlarmButton['type'] })}>
            <option value="lorawan">LoRaWAN – über das eigene Gateway</option>
            <option value="gsm">Mobilfunk – mit eigener SIM-Karte</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Nur zur Unterscheidung in der Liste. Batterielaufzeit und GPS hängen am Gerät,
            nicht am Funkweg – ein LoRaWAN-Ortungsgerät hält Tage, ein einfacher Knopf Jahre.
          </p>
        </Field>
        <Field label="DevEUI / Seriennummer">
          <input
            className={inputClass}
            placeholder="z. B. A840410000000F07"
            value={draft.serial}
            onChange={(e) => setDraft({ ...draft, serial: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">
            Bei LoRaWAN die <b>DevEUI</b> aus dem Netzserver – nicht die aufs Gehäuse gedruckte
            Seriennummer. Nur über die DevEUI findet der Alarmserver den Knopf.
          </p>
        </Field>
      </div>
      <Field label="Modell">
        <select
          className={inputClass}
          value={draft.geraetetyp ?? 'auto'}
          onChange={(e) => setDraft({ ...draft, geraetetyp: e.target.value })}
        >
          {typen.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {typen.find((t) => t.id === (draft.geraetetyp ?? 'auto'))?.hinweis}
        </p>
      </Field>
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
      <Haltezeitrechner geraetetyp={draft.geraetetyp} />
      <div className="mt-4">
        <Toggle
          checked={draft.silent ?? false}
          onChange={(v) => setDraft({ ...draft, silent: v })}
          label="Still alarmieren"
        />
        <p className="text-xs text-slate-500 mt-1 pl-11">
          {draft.silent
            ? 'Die Mitteilung kommt ohne Ton und ohne Vibration an. Richtig, wenn Aufsehen selbst gefährlich wäre – wer gerade unterrichtet oder das Telefon in der Tasche hat, bemerkt den Alarm aber nicht.'
            : 'Die Mitteilung gibt Ton, auch wenn das Telefon stummgeschaltet ist. Das ist für einen Notfallknopf die Regel: Die Alarmierten sind meist woanders, und ein unbemerkter Alarm hilft niemandem.'}
        </p>
      </div>
      <Field label={`Krisenstab aufbieten nach ${draft.escalateToEmergencyServicesAfterMin} Min. ohne Quittierung`}>
        <input
          type="range" min={1} max={30} className="w-full"
          value={draft.escalateToEmergencyServicesAfterMin}
          onChange={(e) => setDraft({ ...draft, escalateToEmergencyServicesAfterMin: Number(e.target.value) })}
        />
        <p className="text-xs text-slate-500 mt-1">
          Quittiert niemand innerhalb dieser Zeit, wird der Krisenstab per Sprachanruf und SMS
          aufgeboten. Blaulichtorganisationen alarmiert das System nicht selbst – dafür sind die
          Notrufnummern unter «Notfallkontakte» hinterlegt.
        </p>
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
