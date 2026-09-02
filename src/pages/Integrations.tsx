import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, KeyRound, Link2, Loader2, MessageSquare, Phone, PhoneCall, Plus, Radio, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { uid, useStore } from '../store'
import type { IntegrationSettings, Webhook } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, VORBEREITET, Vorbereitet, formatDateTime, inputClass } from '../components/ui'

export default function Integrations() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)

  function update(patch: Partial<IntegrationSettings>) {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, ...patch } })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Integrationen &amp; Optionen</h1>
        <p className="text-sm text-slate-500">Anbindung von Drittanwendungen, Kommunikationskanälen und Deployment-Optionen</p>
        <p className="text-xs text-slate-500 mt-2 flex items-center gap-2 flex-wrap">
          Angebunden sind Push-Mitteilungen, die interne Notfallnummer, ausgehende Webhooks, das SMS-Gateway,
          Microsoft Teams, Sprachanruf/Telefonkonferenz über Teams und der LoRaWAN-Endpunkt für Alarmknöpfe.
          {state.mode === 'demo' && ' Im Demo-Modus wird der Versand simuliert – die Einstellungen lassen sich trotzdem erfassen.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} /> SMS-Gateway</span>}>
          <SmsEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><PhoneCall size={16} /> Sprachanruf &amp; Telefonkonferenz (Microsoft Teams)</span>}>
          <TelefonieEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} /> Microsoft Teams: Kanalmeldungen</span>}>
          <TeamsEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><Radio size={16} /> LoRaWAN-Netz / Alarmknöpfe</span>}>
          <LorawanEinstellungen />
        </Card>

        <Card title="Notfallnummer &amp; Identität">
          <div className="space-y-4">
            <div>
              <Toggle checked={integ.hotline.enabled} onChange={(v) => update({ hotline: { ...integ.hotline, enabled: v } })} label="Interne Notfallnummer (Alarmauslösung per Anruf / Sprachnachricht)" />
              {integ.hotline.enabled && (
                <div className="mt-2 pl-11">
                  <Field label="Nummer – erscheint auf der Startseite der App">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-500 shrink-0" />
                      <input
                        className={inputClass}
                        type="tel"
                        value={integ.hotline.number}
                        onChange={(e) => update({ hotline: { ...integ.hotline, number: e.target.value } })}
                      />
                    </div>
                  </Field>
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Toggle checked={integ.sso.enabled} onChange={(v) => update({ sso: { ...integ.sso, enabled: v } })} label={`Single Sign-On (SSO) – ${VORBEREITET}`} />
              {integ.sso.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pl-11">
                  <Field label="Provider">
                    <input className={inputClass} value={integ.sso.provider} onChange={(e) => update({ sso: { ...integ.sso, provider: e.target.value } })} />
                  </Field>
                  <Field label="Entity-ID">
                    <input className={inputClass} value={integ.sso.entityId} onChange={(e) => update({ sso: { ...integ.sso, entityId: e.target.value } })} />
                  </Field>
                </div>
              )}
            </div>
            <div>
              <Toggle checked={integ.hrSync.enabled} onChange={(v) => update({ hrSync: { ...integ.hrSync, enabled: v, lastSync: v ? Date.now() : integ.hrSync.lastSync } })} label={`Automatische Synchronisation mit Personalsystem – ${VORBEREITET}`} />
              {integ.hrSync.enabled && (
                <div className="mt-2 pl-11 space-y-2">
                  <Field label="System">
                    <input className={inputClass} value={integ.hrSync.system} onChange={(e) => update({ hrSync: { ...integ.hrSync, system: e.target.value } })} />
                  </Field>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {integ.hrSync.lastSync && <span>Letzte Synchronisation: {formatDateTime(integ.hrSync.lastSync)}</span>}
                    <Button variant="secondary" onClick={() => update({ hrSync: { ...integ.hrSync, lastSync: Date.now() } })}>
                      <RefreshCw size={13} /> Jetzt synchronisieren
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <Toggle checked={integ.multiLanguage} onChange={(v) => update({ multiLanguage: v })} label={`Mehrsprachige App-Inhalte (DE/EN/FR/IT) – ${VORBEREITET}`} />
              <div>
                <Toggle checked={integ.geofencing} onChange={(v) => update({ geofencing: v })} label="Geofencing (Alarmierung nach Aufenthaltsort)" />
                {integ.geofencing && (
                  <p className="text-xs text-slate-400 pl-11 mt-1">
                    Die App meldet beim Betreten und Verlassen eines Standort-Geofences nur den Standort-Namen –
                    nie GPS-Koordinaten. Wer sich gerade an einem alarmierten Standort aufhält, wird zusätzlich
                    alarmiert; ohne aktuelle Ortsmeldung gilt der Profilstandort. Radius je Standort unter
                    «Standorte»; die Mitarbeitenden müssen der Standortfreigabe in der App zustimmen.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Link2 size={16} /> IP- / Webhook-Integration</span>}
          actions={<Button variant="secondary" onClick={() => setEditingWebhook({ id: uid('wh'), name: '', url: '', direction: 'inbound', active: true })}><Plus size={14} /> Webhook</Button>}
        >
          <div className="space-y-2">
            {integ.webhooks.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{w.name}</div>
                  <div className="text-xs text-slate-400 truncate">{w.url}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge color={w.direction === 'inbound' ? 'blue' : 'violet'}>{w.direction === 'inbound' ? 'eingehend' : 'ausgehend'}</Badge>
                    <Badge color={w.active ? 'green' : 'slate'}>{w.active ? 'aktiv' : 'inaktiv'}</Badge>
                    {w.direction === 'inbound' && <Vorbereitet />}
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setEditingWebhook(w)}>Bearbeiten</Button>
                <Button variant="ghost" onClick={() => dispatch({ type: 'DELETE_WEBHOOK', webhookId: w.id })}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Ausgehende Webhooks melden jede Auslösung an Drittsysteme und sind aktiv. Eingehende Webhooks von
            Brandmeldeanlagen sind {VORBEREITET}; Alarmknöpfe kommen bereits über den LoRaWAN-Endpunkt herein.
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} /> Deployment via Zugangscodes <Vorbereitet /></span>}>
          <p className="text-sm text-slate-500 mb-3">
            Gedacht für die Selbstinstallation ohne Geräteverwaltung. Die App kennt die Codes noch nicht – Mitarbeitende melden sich
            heute mit E-Mail-Adresse und Passwort an.
          </p>
          <div className="space-y-2">
            {integ.accessCodes.map((c) => (
              <div key={c.code} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm">
                <code className="font-mono font-semibold text-slate-800">{c.code}</code>
                <span className="text-xs text-slate-400 flex-1">
                  {state.locations.find((l) => l.id === c.locationId)?.name} · erstellt {formatDateTime(c.createdAt)}
                </span>
                <Badge>{c.used}× verwendet</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {state.locations.map((l) => (
              <Button key={l.id} variant="secondary" onClick={() => dispatch({ type: 'ADD_ACCESS_CODE', locationId: l.id })}>
                <Plus size={13} /> Code für {l.name}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {editingWebhook && <WebhookEditor webhook={editingWebhook} onClose={() => setEditingWebhook(null)} />}
    </div>
  )
}

// ---------- Bausteine ----------

type TestStatus = { laeuft?: boolean; ok?: boolean; text?: string } | null

function TestErgebnis({ status }: { status: TestStatus }) {
  if (!status) return null
  if (status.laeuft) return <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Test läuft …</span>
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${status.ok ? 'text-emerald-700' : 'text-alarm-600'}`}>
      {status.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {status.text}
    </span>
  )
}

/** Formular mit lokalem Entwurf: Zugangsdaten werden erst mit «Speichern» übertragen */
function useEntwurf<T>(wert: T): [T, (patch: Partial<T>) => void, boolean, () => void] {
  const [entwurf, setEntwurf] = useState<T>(wert)
  const [geaendert, setGeaendert] = useState(false)
  return [
    entwurf,
    (patch) => {
      setEntwurf((e) => ({ ...e, ...patch }))
      setGeaendert(true)
    },
    geaendert,
    () => setGeaendert(false),
  ]
}

function SmsEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const sms = integ.smsGateway
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(sms)
  const [test, setTest] = useState<TestStatus>(null)

  function speichern() {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, smsGateway: { ...entwurf, enabled: sms.enabled } } })
    gespeichert()
  }

  async function testen() {
    setTest({ laeuft: true })
    try {
      await api.smsTest()
      setTest({ ok: true, text: 'Test-SMS an die eigene Nummer versendet.' })
    } catch (fehler) {
      setTest({ ok: false, text: (fehler as Error).message })
    }
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={sms.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, smsGateway: { ...sms, enabled: v } } })}
        label="SMS bei Alarm, Lagemeldung und Entwarnung versenden"
      />
      {sms.enabled && (
        <div className="pl-11 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Anbieter">
              <select className={inputClass} value={entwurf.provider} onChange={(e) => patch({ provider: e.target.value })}>
                <option value="ecall">eCall (Schweiz)</option>
                <option value="aspsms">ASPSMS (Schweiz)</option>
                <option value="http">Eigenes HTTP-Gateway</option>
              </select>
            </Field>
            <Field label="Absenderkennung">
              <input className={inputClass} value={entwurf.senderId} onChange={(e) => patch({ senderId: e.target.value })} />
            </Field>
          </div>
          {entwurf.provider === 'http' ? (
            <Field label="URL-Vorlage – Platzhalter {to}, {text}, {from}">
              <input className={inputClass} placeholder="https://gateway.firma.ch/send?to={to}&text={text}&from={from}" value={entwurf.httpUrl} onChange={(e) => patch({ httpUrl: e.target.value })} />
            </Field>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={entwurf.provider === 'aspsms' ? 'Userkey' : 'Benutzername'}>
                <input className={inputClass} value={entwurf.username} onChange={(e) => patch({ username: e.target.value })} />
              </Field>
              <Field label="Passwort / API-Schlüssel">
                <input className={inputClass} type="password" value={entwurf.password} onChange={(e) => patch({ password: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
              </Field>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
            {state.mode === 'live' && <Button variant="secondary" onClick={testen} disabled={geaendert}>Test-SMS an mich</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-slate-400">
            Bisher versendet: {sms.sentCount ?? 0} SMS (rund CHF {(((sms.sentCount ?? 0) * 0.1)).toFixed(2)} bei CHF 0.10/SMS).
            Zustellstatus je Person erscheint in der Alarmzentrale.
            {geaendert && ' Zum Testen zuerst speichern.'}
          </p>
        </div>
      )}
    </div>
  )
}

function TelefonieEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const tel = integ.telephony
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(tel)
  const [test, setTest] = useState<TestStatus>(null)

  function speichern() {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, telephony: { ...entwurf, enabled: tel.enabled } } })
    gespeichert()
  }

  async function testen() {
    setTest({ laeuft: true })
    try {
      const r = await api.telephonyTest()
      setTest({ ok: true, text: r.hinweis ?? (r.joinUrl ? 'Verbindung steht – Test-Konferenz angelegt.' : 'Verbindung zu Microsoft steht.') })
    } catch (fehler) {
      setTest({ ok: false, text: (fehler as Error).message })
    }
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={tel.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, telephony: { ...tel, enabled: v } } })}
        label="Sprachanruf und Telefonkonferenz über Microsoft Teams"
      />
      {tel.enabled && (
        <div className="pl-11 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mandant (Tenant-ID)">
              <input className={inputClass} placeholder="00000000-0000-0000-0000-000000000000" value={entwurf.tenantId} onChange={(e) => patch({ tenantId: e.target.value })} />
            </Field>
            <Field label="Anwendungs-ID (Client-ID)">
              <input className={inputClass} value={entwurf.clientId} onChange={(e) => patch({ clientId: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Geheimnis (Client Secret)">
              <input className={inputClass} type="password" value={entwurf.clientSecret} onChange={(e) => patch({ clientSecret: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
            </Field>
            <Field label="Konferenz-Organisator (Teams-Konto)">
              <input className={inputClass} type="email" placeholder="krisenstab@firma.ch" value={entwurf.organizerEmail} onChange={(e) => patch({ organizerEmail: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
            {state.mode === 'live' && <Button variant="secondary" onClick={testen} disabled={geaendert}>Verbindung testen</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-slate-400">
            Beim Kanal «Sprachanruf» klingeln die Empfänger in Teams (Handy, Desktop, Web); beim Kanal «Telefonkonferenz»
            wird eine Teams-Besprechung eröffnet und der Beitrittslink per Push und in den Teams-Kanal verteilt.
            Voraussetzung: App-Registrierung in Entra ID mit den Anwendungsberechtigungen
            «OnlineMeetings.ReadWrite.All» (Konferenz) und «Calls.Initiate.All» (Anruf).
          </p>
        </div>
      )}
    </div>
  )
}

function TeamsEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const teams = integ.teams
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(teams)
  const [test, setTest] = useState<TestStatus>(null)

  function speichern() {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, teams: { ...entwurf, enabled: teams.enabled } } })
    gespeichert()
  }

  async function testen() {
    setTest({ laeuft: true })
    try {
      await api.teamsTest()
      setTest({ ok: true, text: 'Testkarte im Kanal veröffentlicht.' })
    } catch (fehler) {
      setTest({ ok: false, text: (fehler as Error).message })
    }
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={teams.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, teams: { ...teams, enabled: v } } })}
        label="Alarm, Lagemeldung und Entwarnung in einen Teams-Kanal melden"
      />
      {teams.enabled && (
        <div className="pl-11 space-y-3">
          <Field label="Mandant">
            <input className={inputClass} placeholder="firma.onmicrosoft.com" value={entwurf.tenant} onChange={(e) => patch({ tenant: e.target.value })} />
          </Field>
          <Field label="Kanal-Webhook-URL (Workflows «Bei Webhookanforderung» oder Incoming Webhook)">
            <input className={inputClass} type="password" value={entwurf.webhookUrl} onChange={(e) => patch({ webhookUrl: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
          </Field>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
            {state.mode === 'live' && <Button variant="secondary" onClick={testen} disabled={geaendert}>Testmeldung senden</Button>}
            <TestErgebnis status={test} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-700">Teil 1 – In Microsoft Teams (einmalig, ~3 Minuten)</div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Öffne in Teams den Kanal, in dem die Meldungen landen sollen (z. B. ein Kanal «Krisenstab» –
                am besten ein Kanal, den nur der Krisenstab sieht, denn dort erscheinen auch stille Alarme).
              </li>
              <li>Klicke neben dem Kanalnamen auf <b>«…» → Workflows</b>.</li>
              <li>
                Wähle die Vorlage <b>«Bei Empfang einer Webhookanforderung in einem Kanal posten»</b>
                {' '}(englisch: <i>Post to a channel when a webhook request is received</i>).
              </li>
              <li>Melde dich an, prüfe Team und Kanal, und klicke <b>«Workflow hinzufügen»</b>.</li>
              <li>
                Teams zeigt dir jetzt eine lange URL an (beginnt mit <code>https://prod-…logic.azure.com/workflows/…</code>{' '}
                oder ähnlich) – <b>sofort kopieren</b>, sie wird nur hier angezeigt.
              </li>
            </ol>
            <p>
              <b>Hinweis:</b> Die Vorlage läuft unter deinem Konto – nimm dafür idealerweise ein Funktionskonto
              (z. B. das Krisenstab-Konto), damit der Workflow nicht an deinem persönlichen Konto hängt. Der alte Weg
              über «Connectors → Incoming Webhook» funktioniert teils noch, wird von Microsoft aber abgeschaltet –
              nimm die Workflows-Variante.
            </p>
            <div className="font-semibold text-slate-700 pt-1">Teil 2 – Hier im Portal</div>
            <p>
              Die kopierte URL oben in das Feld <b>«Kanal-Webhook-URL»</b> einsetzen (der Mandant ist rein informativ),
              dann <b>Speichern</b> und <b>«Testmeldung senden»</b> – im Kanal sollte innert Sekunden die Karte
              «Testmeldung SOBE Notfall» erscheinen. Die URL gilt als Geheimnis und wird maskiert gespeichert.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function LorawanEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const lorawan = integ.lorawan
  const [info, setInfo] = useState<{ url: string; token: string | null } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState<string | null>(null)

  useEffect(() => {
    if (state.mode !== 'live' || !lorawan.enabled) return
    api.lorawanInfo().then((i) => setInfo({ url: i.url, token: i.token })).catch((f: Error) => setFehler(f.message))
  }, [state.mode, lorawan.enabled])

  async function neuesToken() {
    setFehler(null)
    try {
      const { token } = await api.lorawanNewToken()
      setInfo((i) => (i ? { ...i, token } : i))
    } catch (f) {
      setFehler((f as Error).message)
    }
  }

  function kopieren(wert: string, was: string) {
    navigator.clipboard?.writeText(wert).then(() => {
      setKopiert(was)
      setTimeout(() => setKopiert(null), 2000)
    })
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={lorawan.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, lorawan: { ...lorawan, enabled: v } } })}
        label="Uplink-Endpunkt für LoRaWAN- und GSM-Alarmknöpfe"
      />
      {lorawan.enabled && (
        <div className="pl-11 space-y-3">
          <Field label="Netzserver">
            <select
              className={inputClass}
              value={lorawan.provider}
              onChange={(e) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, lorawan: { ...lorawan, provider: e.target.value } } })}
            >
              <option value="ttn">The Things Network / The Things Stack</option>
              <option value="chirpstack">ChirpStack</option>
              <option value="generic">Generisch (eigene Bridge, GSM-Knöpfe)</option>
            </select>
          </Field>
          {state.mode === 'live' ? (
            <div className="space-y-2 text-sm">
              {info && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-24 shrink-0">Endpunkt</span>
                    <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 min-w-0 truncate">{info.url}</code>
                    <Button variant="ghost" onClick={() => kopieren(info.url, 'url')} aria-label="Endpunkt kopieren"><Copy size={13} /></Button>
                    {kopiert === 'url' && <span className="text-xs text-emerald-700">kopiert</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-24 shrink-0">Token</span>
                    <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 min-w-0 truncate">{info.token ?? '– noch keines erzeugt –'}</code>
                    {info.token && <Button variant="ghost" onClick={() => kopieren(info.token!, 'token')} aria-label="Token kopieren"><Copy size={13} /></Button>}
                    {kopiert === 'token' && <span className="text-xs text-emerald-700">kopiert</span>}
                  </div>
                  <Button variant="secondary" onClick={neuesToken}><RefreshCw size={13} /> {info.token ? 'Neues Token erzeugen (altes verfällt)' : 'Token erzeugen'}</Button>
                </>
              )}
              {fehler && <div className="text-xs text-alarm-600">{fehler}</div>}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Endpunkt-Adresse und Zugangstoken zeigt der Alarmserver im Live-Modus an.</p>
          )}
          <p className="text-xs text-slate-400">
            Im Netzserver einen Webhook auf den Endpunkt einrichten (Kopfzeile «Authorization: Bearer &lt;Token&gt;»).
            Der Server versteht TTN v3, ChirpStack v4 und generisches JSON. Statusmeldungen aktualisieren Batterie und
            «letztes Signal» der unter «Alarmknöpfe» registrierten Geräte (Zuordnung über die Seriennummer/DevEUI);
            ein Knopfdruck löst den dort hinterlegten stillen Alarm aus.
          </p>
        </div>
      )}
    </div>
  )
}

function WebhookEditor({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [draft, setDraft] = useState<Webhook>({ ...webhook })

  return (
    <Modal title={webhook.name ? `Webhook: ${webhook.name}` : 'Neuer Webhook'} onClose={onClose}>
      <Field label="Name">
        <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field>
      <Field label="URL / Endpunkt">
        <input className={inputClass} value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
      </Field>
      <Field label="Richtung">
        <select className={inputClass} value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as Webhook['direction'] })}>
          <option value="inbound">Eingehend (löst Alarm aus)</option>
          <option value="outbound">Ausgehend (meldet Ereignisse)</option>
        </select>
      </Field>
      {draft.direction === 'inbound' && (
        <Field label="Auszulösendes Szenario">
          <select className={inputClass} value={draft.scenarioId ?? ''} onChange={(e) => setDraft({ ...draft, scenarioId: e.target.value || undefined })}>
            <option value="">–</option>
            {state.scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </Field>
      )}
      <div className="mb-4">
        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Aktiv" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button onClick={() => { dispatch({ type: 'UPSERT_WEBHOOK', webhook: draft }); onClose() }} disabled={!draft.name.trim() || !draft.url.trim()}>
          Speichern
        </Button>
      </div>
    </Modal>
  )
}
