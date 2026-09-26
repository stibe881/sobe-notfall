import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, CheckCircle2, ChevronDown, ChevronRight, FileText, MapPin, Megaphone, Send, Siren, XCircle } from 'lucide-react'
import { useStore } from '../store'
import type { Alarm, Delivery } from '../types'
import { Badge, Button, Card, formatDateTime, formatRelative, formatTime, inputClass, kanalName, usePrompt } from '../components/ui'
import { ScenarioIcon } from '../components/ScenarioIcon'
import { ereignisbericht } from '../lib/ereignisbericht'
import { berichtDateiname, berichtHtml } from '../lib/berichtseite'
import { logoUrl } from '../lib/api'
import { IndoorKarte } from '../components/IndoorKarte'

/** Logo für den Ereignisbericht als data:-URI – schlägt der Abruf fehl, bleibt der Bericht ohne Logo statt ganz zu scheitern */
async function logoAlsDataUrl(version: string): Promise<string | undefined> {
  try {
    const antwort = await fetch(logoUrl(version))
    if (!antwort.ok) return undefined
    const blob = await antwort.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export default function AlarmMonitor() {
  const { state } = useStore()
  const active = state.alarms.filter((a) => a.status === 'active')
  const ended = state.alarms.filter((a) => a.status === 'ended')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Alarmzentrale</h1>
        <p className="text-sm text-muted">Live-Monitoring aller Alarme: Zustellstatus, Quittierungen und Eskalationen in Echtzeit</p>
      </div>

      {!state.integrations.smsGateway.enabled && !state.integrations.telephony.enabled && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <strong>Hinweis:</strong> SMS und Sprachanrufe sind noch nicht angebunden – Alarme gehen per Push und an
          ausgehende Webhooks, aber nicht per SMS/Anruf. Gateways unter{' '}
          <Link to="/integrationen" className="underline font-medium">Einstellungen &amp; Konfiguration</Link> anbinden.
        </div>
      )}

      {active.length === 0 && ended.length === 0 && (
        <Card>
          <div className="text-center py-10">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
            <div className="font-medium text-slate-700">Keine Alarme – Lage ruhig</div>
            <p className="text-sm text-faint mt-1">Ausgelöste Alarme erscheinen hier in Echtzeit mit Zustellstatus und Journal.</p>
            <Link
              to="/alarm"
              className="inline-flex items-center gap-2 mt-4 rounded-xl bg-alarm-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-alarm-700 transition"
            >
              <Siren size={15} /> Test-Alarm auslösen
            </Link>
          </div>
        </Card>
      )}

      {active.length === 0 && ended.length > 0 && (
        <div className="text-sm text-muted bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" /> Keine aktiven Alarme – Lage ruhig.
        </div>
      )}

      {active.map((a) => <AlarmCard key={a.id} alarm={a} />)}

      {ended.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-faint mb-3">Beendete Alarme</h2>
          <div className="space-y-4">
            {ended.slice(0, 10).map((a) => <AlarmCard key={a.id} alarm={a} collapsed />)}
          </div>
        </div>
      )}
    </div>
  )
}

const QUELLE: Record<string, string> = {
  beacons: 'Bluetooth-Beacons der Access Points',
  wlan: 'WLAN der Access Points',
  system: 'Ortung des Telefons',
}

/**
 * Wo im Gebäude die auslösende Person ist (Indoor-Ortung über Aruba Meridian).
 * Die App führt die Position nach, solange der Alarm läuft – die Karte folgt.
 */
function IndoorAbschnitt({ alarm }: { alarm: Alarm }) {
  const { state } = useStore()
  const indoor = alarm.indoor!
  const karte = state.integrations.meridian.karten.find((k) => k.mapId === indoor.mapId)
  const standort = karte?.locationId ? state.locations.find((l) => l.id === karte.locationId) : undefined
  const person = state.users.find((u) => u.id === alarm.triggeredByUserId)
  const ort = karte?.name || `Karte ${indoor.mapId}`
  return (
    <div className="border-t border-slate-100 px-5 py-3 space-y-2">
      <div className="flex items-start gap-2 text-sm">
        <MapPin size={16} className="text-brand-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-slate-800">
            Position im Gebäude: {ort}
            {standort ? <span className="text-muted font-normal"> · {standort.name}</span> : null}
          </div>
          <div className="text-xs text-muted">
            {alarm.status === 'active' ? `ermittelt ${formatRelative(indoor.ermitteltAt)}` : `zuletzt ${formatDateTime(indoor.ermitteltAt)}`}
            {indoor.genauigkeitM !== undefined ? ` · ±${Math.max(1, Math.round(indoor.genauigkeitM))} m` : ''}
            {indoor.quelle && QUELLE[indoor.quelle] ? ` · ${QUELLE[indoor.quelle]}` : ''}
          </div>
        </div>
      </div>
      {state.integrations.meridian.enabled && (
        <IndoorKarte position={indoor} titel={person ? `${person.firstName} ${person.lastName}` : 'Auslösende Person'} />
      )}
    </div>
  )
}

function AlarmCard({ alarm, collapsed = false }: { alarm: Alarm; collapsed?: boolean }) {
  const { state, dispatch } = useStore()
  const { frage, promptEl } = usePrompt()
  const [open, setOpen] = useState(!collapsed)
  const [lage, setLage] = useState('')
  const updates = [...(alarm.updates ?? [])].reverse()
  function beenden() {
    frage(
      'Entwarnung geben',
      'Der Alarm wird beendet und alle Empfänger:innen erhalten die Entwarnung als Mitteilung. Hinweis für die Empfänger:innen (optional):',
      (text) => dispatch({ type: 'END_ALARM', alarmId: alarm.id, byUserId: state.currentUserId, note: text }),
      'Entwarnung senden',
      'z. B. Rückkehr ab 10:30 über den Haupteingang',
    )
  }
  /**
   * Ereignisbericht sichern.
   *
   * Nach einem Todesfall, einem Kindesschutzfall oder einem Unfall braucht
   * die Schulleitung ein Dokument für Schulkommission, Kanton, Versicherung
   * und Eltern. Der Bericht entsteht aus dem Journal, das ohnehin geführt
   * wird – als einzelne HTML-Datei, die sich ablegen, weitergeben und in
   * fünf Jahren noch öffnen lässt. Aus dem Browser wird daraus mit
   * «Drucken» ein PDF.
   */
  async function bericht() {
    const daten = ereignisbericht(alarm, state)
    // Logo eingebettet als data:-URI, damit der Bericht wie vorgesehen eine
    // einzelne, in sich geschlossene Datei ohne Fremdbezüge bleibt – ein
    // gescheiterter Abruf (Logo gelöscht, Netz weg) lässt den Bericht trotzdem
    // entstehen, nur ohne Logo, statt die Ablage ganz zu verhindern.
    const logoVersion = state.integrations?.organization?.logoVersion
    const logoDataUrl = logoVersion ? await logoAlsDataUrl(logoVersion) : undefined
    const html = berichtHtml(daten, state.integrations?.organization?.name ?? 'SOBE Notfall', Date.now(), logoDataUrl)
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = berichtDateiname(daten)
    a.click()
    // Der Browser braucht den Verweis noch einen Augenblick
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function lagemeldung() {
    const text = lage.trim()
    if (!text) return
    dispatch({ type: 'ALARM_UPDATE', alarmId: alarm.id, message: text, kind: 'lage' })
    setLage('')
  }
  const scenario = state.scenarios.find((s) => s.id === alarm.scenarioId)
  const triggeredBy = state.users.find((u) => u.id === alarm.triggeredByUserId)

  const userIds = [...new Set(alarm.deliveries.map((d) => d.userId))]
  const delivered = alarm.deliveries.filter((d) => d.status === 'delivered').length
  const failed = alarm.deliveries.filter((d) => d.status === 'failed').length
  const acked = userIds.filter((u) => alarm.deliveries.some((d) => d.userId === u && d.ack === 'acknowledged')).length

  return (
    <div className={`bg-white rounded-xl border shadow-sm ${alarm.status === 'active' ? (alarm.drill ? 'border-amber-400' : 'border-alarm-500') : 'border-slate-200'}`}>
      {promptEl}
      <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} className="text-faint" /> : <ChevronRight size={16} className="text-faint" />}
        <ScenarioIcon
          name={scenario?.icon ?? ''}
          size={26}
          className={alarm.status === 'active' ? 'text-alarm-600 shrink-0' : 'text-faint shrink-0'}
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
            {scenario?.title}
            {alarm.drill && <Badge color="amber">ÜBUNG</Badge>}
            {alarm.silent && <Badge color="violet">stiller Alarm</Badge>}
            {updates.some((u) => u.kind === 'fehlalarm') && <Badge color="amber">Fehlalarm gemeldet</Badge>}
            {alarm.requireAck && <Badge color="blue">mit Quittierung</Badge>}
            {alarm.escalationStage > 0 && <Badge color="amber">Eskalationsstufe {alarm.escalationStage}</Badge>}
            <Badge color={alarm.status === 'active' ? 'red' : 'slate'}>{alarm.status === 'active' ? 'AKTIV' : 'beendet'}</Badge>
          </div>
          <div className="text-sm text-muted truncate">{alarm.message}</div>
          <div className="text-xs text-faint mt-0.5" title={formatDateTime(alarm.triggeredAt)}>
            {alarm.status === 'active' ? formatRelative(alarm.triggeredAt) : formatDateTime(alarm.triggeredAt)} · ausgelöst von{' '}
            {triggeredBy?.firstName} {triggeredBy?.lastName} via {alarm.triggeredVia}
          </div>
        </div>
        <div className="text-right text-sm shrink-0">
          <div className="text-slate-700 font-medium">{delivered}/{alarm.deliveries.length} zugestellt</div>
          {alarm.requireAck && <div className="text-xs text-muted">{acked}/{userIds.length} quittiert</div>}
          {failed > 0 && <div className="text-xs text-alarm-600">{failed} fehlgeschlagen</div>}
        </div>
        {alarm.status === 'active' ? (
          <Button variant="secondary" onClick={(e) => { e.stopPropagation(); beenden() }}>
            <BellOff size={14} /> Beenden
          </Button>
        ) : (
          <Button variant="ghost" onClick={(e) => { e.stopPropagation(); bericht() }} title="Ereignisbericht als Datei sichern">
            <FileText size={14} /> Bericht
          </Button>
        )}
      </div>

      {open && alarm.indoor && <IndoorAbschnitt alarm={alarm} />}

      {(alarm.status === 'active' || updates.length > 0 || alarm.endNote) && (
        <div className="border-t border-slate-100 px-5 py-3 space-y-2">
          {alarm.endNote && (
            <div className="text-sm border-l-[3px] border-emerald-500 pl-2">
              <span className="text-[11px] font-bold text-emerald-700">Entwarnung</span>
              <div className="text-slate-700">{alarm.endNote}</div>
            </div>
          )}
          {updates.map((u, i) => {
            const von = u.byUserId ? state.users.find((x) => x.id === u.byUserId) : undefined
            return (
              <div key={i} className={`text-sm border-l-[3px] pl-2 ${u.kind === 'fehlalarm' ? 'border-amber-500' : u.kind === 'standort' ? 'border-brand-600' : 'border-violet-500'}`}>
                <span className={`text-[11px] font-bold ${u.kind === 'fehlalarm' ? 'text-amber-700' : u.kind === 'standort' ? 'text-brand-700' : 'text-violet-700'}`}>
                  {u.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : u.kind === 'meldung' ? 'Weitere Meldung' : u.kind === 'standort' ? 'Position im Gebäude' : 'Lagemeldung'} · {formatTime(u.ts)}
                  {von ? ` · ${von.firstName} ${von.lastName}` : ''}
                </span>
                <div className="text-slate-700">{u.message}</div>
              </div>
            )
          })}
          {alarm.status === 'active' && (
            <div className="flex gap-2 items-start pt-1">
              <Megaphone size={16} className="text-violet-600 mt-2.5 shrink-0" />
              <input
                className={inputClass}
                placeholder="Lagemeldung an alle Empfänger:innen – z. B. «Sammelplatz Ost gesperrt, bitte Nord»"
                value={lage}
                onChange={(e) => setLage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') lagemeldung() }}
              />
              <Button onClick={lagemeldung} disabled={!lage.trim()}><Send size={14} /> Senden</Button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 grid lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-2">Empfänger:innen &amp; Zustellstatus</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {userIds.map((userId) => {
                const user = state.users.find((u) => u.id === userId)
                const rows = alarm.deliveries.filter((d) => d.userId === userId)
                const ack = rows.find((d) => d.ack !== 'none')?.ack ?? 'none'
                return (
                  <div key={userId} className="rounded-lg border border-slate-100 p-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{user ? `${user.firstName} ${user.lastName}` : userId}</span>
                      <span className="text-xs text-faint">{user?.phone}</span>
                      <span className="ml-auto">
                        {alarm.requireAck && ack === 'acknowledged' && <Badge color="green"><CheckCircle2 size={12} /> quittiert</Badge>}
                        {alarm.requireAck && ack === 'declined' && <Badge color="red"><XCircle size={12} /> abgelehnt</Badge>}
                        {alarm.requireAck && ack === 'none' && <Badge color="amber">ausstehend</Badge>}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {rows.map((d) => <DeliveryChip key={d.id} d={d} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-600 mb-2">Alarmjournal</h4>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {alarm.log.map((entry, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="text-xs text-faint whitespace-nowrap mt-0.5">{formatTime(entry.ts)}</span>
                  <span className="text-slate-700">{entry.message}</span>
                </div>
              ))}
            </div>
            {alarm.escalation.length > alarm.escalationStage && alarm.status === 'active' && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
                Nächste Eskalation: Stufe {alarm.escalationStage + 1} nach {alarm.escalation[alarm.escalationStage].afterMinutes} Min.
                {alarm.requireAck && ' (entfällt, wenn alle quittieren)'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DeliveryChip({ d }: { d: Delivery }) {
  const colors: Record<Delivery['status'], string> = {
    pending: 'bg-slate-100 text-muted',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
  }
  const labels: Record<Delivery['status'], string> = {
    pending: 'wird gesendet…',
    sent: 'gesendet',
    delivered: 'zugestellt',
    failed: 'fehlgeschlagen',
  }
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded ${colors[d.status]}`}>
      {kanalName(d.channel)}: {d.channel === 'push' ? labels[d.status] : 'kein Versand'}
    </span>
  )
}
