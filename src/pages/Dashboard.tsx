import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, BellRing, Radio, Server, ShieldCheck, Siren, Smartphone, Timer, Users } from 'lucide-react'
import { useStore } from '../store'
import { Badge, Button, Card, VORBEREITET, formatRelative } from '../components/ui'
import { ScenarioIcon } from '../components/ScenarioIcon'
import { api, type Bereitschaft } from '../lib/api'

/** Sicherung gilt als aktuell, wenn sie jünger als zwei Tage ist */
const SICHERUNG_FRIST_MS = 2 * 24 * 3600_000

export default function Dashboard() {
  const { state } = useStore()
  const activeAlarms = state.alarms.filter((a) => a.status === 'active')
  const runningLoneWork = state.loneWorkSessions.filter((s) => s.status === 'running')
  const lowBattery = state.buttons.filter((b) => b.batteryPct < 20)

  const stats = [
    { label: 'Aktive Alarme', value: activeAlarms.length, icon: Siren, to: '/monitor', highlight: activeAlarms.length > 0 },
    { label: 'Benutzer', value: state.users.length, icon: Users, to: '/benutzer' },
    { label: 'Laufende Alleinarbeit', value: runningLoneWork.length, icon: Timer, to: '/alleinarbeit' },
    { label: 'Alarmknöpfe online', value: state.buttons.length, icon: Radio, to: '/alarmknoepfe' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Lageübersicht Notfall- und Krisenmanagement</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/alarm"
            className="inline-flex items-center gap-2 rounded-xl bg-alarm-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-alarm-700 transition shadow-sm"
          >
            <Siren size={16} /> Alarm auslösen
          </Link>
          <Link
            to="/alleinarbeit"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
          >
            <Timer size={16} /> Alleinarbeit starten
          </Link>
          <a
            href="#/app"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
          >
            <Smartphone size={16} /> App-Vorschau
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <div className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow transition ${s.highlight ? 'border-alarm-500' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{s.label}</span>
                <s.icon size={18} className={s.highlight ? 'text-alarm-600' : 'text-slate-400'} />
              </div>
              <div className={`text-3xl font-bold mt-2 ${s.highlight ? 'text-alarm-600' : 'text-slate-800'}`}>{s.value}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><Server size={16} /> Alarmserver-Status</span>}>
          <ul className="space-y-2.5 text-sm">
            <StatusRow label="Alarmserver" ok detail={state.mode === 'live' ? 'Hetzner-Hosting' : 'Demo – lokal im Browser'} />
            <StatusRow label="Push-Dienst (Critical Alerts)" ok detail="iOS über Expo – Stand unter Bereitschaft" />
            <StatusRow label="Interne Notfallnummer" ok={state.integrations.hotline.enabled} detail={state.integrations.hotline.number} />
            <StatusRow label="SMS-Gateway" ok={state.integrations.smsGateway.enabled} detail={state.integrations.smsGateway.enabled ? state.integrations.smsGateway.provider : undefined} />
            <StatusRow label="Sprachanrufe / Telefonkonferenz" ok={state.integrations.telephony.enabled} detail={state.integrations.telephony.enabled ? 'über Microsoft Teams' : undefined} />
            <StatusRow label="Microsoft Teams" ok={state.integrations.teams.enabled} detail={state.integrations.teams.tenant || undefined} />
            <StatusRow label="LoRaWAN-Netz / Alarmknöpfe" ok={state.integrations.lorawan.enabled} detail={`${state.buttons.length} Knöpfe erfasst`} />
          </ul>
          {lowBattery.length > 0 && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> {lowBattery.length} Alarmknopf/-knöpfe mit niedrigem Batteriestand
            </div>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Activity size={16} /> Letzte Ereignisse</span>}>
          {state.audit.slice(0, 8).map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 text-sm">
              <span className="text-xs text-slate-400 whitespace-nowrap mt-0.5 w-20 shrink-0">{formatRelative(e.ts)}</span>
              <span className="text-slate-700">{e.message}</span>
            </div>
          ))}
          <Link to="/protokoll" className="inline-flex items-center gap-1 mt-3 text-sm text-slate-500 hover:text-slate-800 underline">
            Vollständiges Protokoll <ArrowRight size={13} />
          </Link>
        </Card>
      </div>

      <BereitschaftKarte />

      {activeAlarms.length > 0 && (
        <Card title={<span className="flex items-center gap-2 text-alarm-600"><BellRing size={16} /> Aktive Alarme</span>}>
          {activeAlarms.map((a) => {
            const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
            return (
              <Link key={a.id} to="/monitor" className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 text-sm hover:bg-slate-50 rounded px-2">
                <ScenarioIcon name={scenario?.icon ?? ''} size={22} className="text-alarm-600 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{scenario?.title}</div>
                  <div className="text-slate-500 text-xs">{a.message}</div>
                </div>
                {a.silent && <Badge color="violet">still</Badge>}
                <Badge color="red">aktiv</Badge>
              </Link>
            )
          })}
        </Card>
      )}
    </div>
  )
}

/**
 * Bereitschaft: Erreicht ein Alarm die Leute überhaupt? Geräte pro Standort,
 * Critical-Alert-Berechtigung, Alter der Sicherung, Push-Dienst, Testmeldung.
 */
function BereitschaftKarte() {
  const { state } = useStore()
  const [daten, setDaten] = useState<Bereitschaft | null>(null)
  const [fehler, setFehler] = useState('')
  const [sende, setSende] = useState(false)
  const [rueckmeldung, setRueckmeldung] = useState('')
  const live = state.mode === 'live'

  const laden = useCallback(() => {
    if (!live) return
    api.bereitschaft().then(setDaten).catch((f: Error) => setFehler(f.message))
  }, [live])
  useEffect(() => {
    laden()
    const t = setInterval(laden, 60_000)
    return () => clearInterval(t)
  }, [laden])

  async function testpush() {
    setSende(true)
    try {
      const r = await api.testpush()
      setRueckmeldung(r.geraete > 0 ? `Testmeldung an ${r.geraete} Gerät(e) gesendet – bitte auf dem Telefon prüfen.` : 'Kein Gerät für Ihr Konto registriert – bitte in der App anmelden.')
      laden()
    } catch (f) {
      setRueckmeldung((f as Error).message)
    } finally {
      setSende(false)
    }
  }

  const gesamt = daten ? daten.standorte.reduce((s, x) => s + x.personen, 0) : state.users.length
  const mitGeraet = daten ? daten.standorte.reduce((s, x) => s + x.mitGeraet, 0) : 0
  const sicherungAlt = daten?.letzteSicherung ? Date.now() - daten.letzteSicherung.ts > SICHERUNG_FRIST_MS : true
  const titel = (
    <span className="flex items-center gap-2"><ShieldCheck size={16} /> Bereitschaft</span>
  )

  if (!live) {
    return (
      <Card title={titel}>
        <p className="text-sm text-slate-500">
          Im Demo-Modus gibt es keine registrierten Geräte. Im Live-Betrieb zeigt diese Kachel pro Standort, wie viele Personen ein
          Gerät mit der App haben, wer Critical Alerts erlaubt hat, wann die letzte Sicherung lief und ob der Push-Dienst erreichbar ist.
        </p>
      </Card>
    )
  }

  return (
    <Card title={titel} actions={<Button variant="secondary" onClick={testpush} disabled={sende}><Smartphone size={14} /> Testmeldung an mein Telefon</Button>}>
      {fehler && <div className="text-sm text-alarm-600 mb-2">{fehler}</div>}
      {rueckmeldung && <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2.5 mb-3">{rueckmeldung}</div>}
      {daten && (
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Geräte mit App pro Standort</div>
            <ul className="space-y-2 text-sm">
              {daten.standorte.map((s) => {
                const anteil = s.personen ? s.mitGeraet / s.personen : 0
                return (
                  <li key={s.id}>
                    <div className="flex justify-between">
                      <span className="text-slate-700">{s.name}</span>
                      <span className={anteil < 0.5 ? 'text-alarm-600 font-semibold' : 'text-slate-600'}>
                        {s.mitGeraet}/{s.personen}{s.critical > 0 ? ` · ${s.critical} mit Critical Alerts` : ''}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full ${anteil < 0.5 ? 'bg-alarm-500' : 'bg-emerald-500'}`} style={{ width: `${anteil * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="text-xs text-slate-500 mt-2">
              {mitGeraet} von {gesamt} Personen erreichbar per Push. {daten.ohneGeraet.length > 0 && (
                <>Ohne Gerät: {daten.ohneGeraet.slice(0, 6).map((p) => p.name).join(', ')}{daten.ohneGeraet.length > 6 ? ` und ${daten.ohneGeraet.length - 6} weitere` : ''}.</>
              )}
            </div>
          </div>
          <ul className="space-y-2.5 text-sm">
            <StatusRow
              label="Push-Dienst"
              ok={daten.pushDienst?.ok ?? false}
              detail={daten.pushDienst ? `geprüft ${formatRelative(daten.pushDienst.geprueft)}` : 'noch nicht geprüft'}
            />
            <StatusRow
              label="Sicherung"
              ok={!sicherungAlt}
              detail={daten.letzteSicherung ? `${daten.letzteSicherung.datei} · ${formatRelative(daten.letzteSicherung.ts)}` : 'keine Sicherung gefunden'}
            />
            <StatusRow
              label="Wöchentliche Testmeldung"
              ok={Boolean(daten.letzterTestpush && Date.now() - daten.letzterTestpush < 8 * 24 * 3600_000)}
              detail={daten.letzterTestpush ? formatRelative(daten.letzterTestpush) : 'noch nie – folgt werktags am Vormittag'}
            />
            <StatusRow label="Registrierte Geräte" ok={daten.tokensGesamt > 0} detail={`${daten.tokensGesamt}`} />
          </ul>
        </div>
      )}
    </Card>
  )
}

function StatusRow({ label, ok = false, vorbereitet = false, detail }: { label: string; ok?: boolean; vorbereitet?: boolean; detail?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : vorbereitet ? 'bg-slate-200' : 'bg-slate-300'}`} />
      <span className={`flex-1 ${vorbereitet ? 'text-slate-500' : 'text-slate-700'}`}>{label}</span>
      <span className="text-xs text-slate-400">{detail}</span>
      {vorbereitet
        ? <Badge color="slate">{VORBEREITET}</Badge>
        : <Badge color={ok ? 'green' : 'slate'}>{ok ? 'online' : 'inaktiv'}</Badge>}
    </li>
  )
}
