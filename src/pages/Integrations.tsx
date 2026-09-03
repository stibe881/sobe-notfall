import { useEffect, useState, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { Building2, CheckCircle2, Copy, KeyRound, Link2, Loader2, MapPin, MessageSquare, Phone, PhoneCall, Plus, QrCode, Radio, RefreshCw, ServerCog, Smartphone, Trash2, Users, XCircle } from 'lucide-react'
import { api, logoUrl, serverUrl, type RedundanzConfig, type RedundanzStatus } from '../lib/api'
import { uid, useStore } from '../store'
import type { IntegrationSettings, Webhook } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, VORBEREITET, Vorbereitet, formatDateTime, inputClass } from '../components/ui'

/**
 * Die Themenbereiche der Seite – in der Reihenfolge, in der man einen neuen
 * Kunden einrichtet: Wer sind wir? Wie kommt die App zu den Leuten? Über
 * welche Kanäle wird alarmiert? Wer darf sich anmelden? Was ist angebunden?
 * Und zuletzt der Betrieb.
 */
const BEREICHE = [
  { id: 'int-organisation', titel: 'Organisation', hinweis: 'Name, Auftritt und interne Notfallnummer – erscheint in Portal und App.' },
  { id: 'int-app', titel: 'App der Mitarbeitenden', hinweis: 'Wie die App (iOS und Android) zu den Mitarbeitenden kommt und was sie auf dem Gerät darf.' },
  { id: 'int-kanaele', titel: 'Alarmierungskanäle', hinweis: 'Push-Mitteilungen sind immer aktiv – hier kommen SMS, Teams und Telefonie dazu.' },
  { id: 'int-anmeldung', titel: 'Anmeldung & Benutzer', hinweis: 'Woher die Konten kommen und wie sich alle anmelden.' },
  { id: 'int-systeme', titel: 'Drittsysteme & Alarmknöpfe', hinweis: 'Physische Alarmknöpfe und Schnittstellen zu anderen Systemen.' },
  { id: 'int-betrieb', titel: 'Betrieb & Ausfallsicherheit', hinweis: 'Ein zweiter Alarmserver übernimmt, wenn dieser ausfällt.' },
] as const

/** Ein Themenbereich: Zwischentitel mit Kurzbeschreibung, darunter die Karten */
function Bereich({ id, children }: { id: (typeof BEREICHE)[number]['id']; children: ReactNode }) {
  const bereich = BEREICHE.find((b) => b.id === id)!
  return (
    <section id={id} className="scroll-mt-4">
      <div className="mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{bereich.titel}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{bereich.hinweis}</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-start">{children}</div>
    </section>
  )
}

export default function Integrations() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Integrationen &amp; Optionen</h1>
        <p className="text-sm text-slate-500">
          Von der Organisation über die App und die Alarmierungskanäle bis zur Ausfallsicherheit – geordnet nach
          der Reihenfolge der Einrichtung.
          {state.mode === 'demo' && ' Im Demo-Modus wird der Versand simuliert – die Einstellungen lassen sich trotzdem erfassen.'}
        </p>
        {/* Schnellnavigation: springt zum Bereich, ohne die Adresse (Hash-Routing) zu verändern */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              onClick={() => document.getElementById(b.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 transition"
            >
              {b.titel}
            </button>
          ))}
        </div>
      </div>

      <Bereich id="int-organisation">
        <Card title={<span className="flex items-center gap-2"><Building2 size={16} /> Organisation &amp; Auftritt</span>}>
          <OrganisationEinstellungen />
        </Card>
      </Bereich>

      <Bereich id="int-app">
        <Card title={<span className="flex items-center gap-2"><Smartphone size={16} /> App-Verbindung</span>}>
          <AppVerbindung />
        </Card>

        <Card title={<span className="flex items-center gap-2"><MapPin size={16} /> Geofencing</span>}>
          <GeofencingEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} /> Deployment via Zugangscodes <Vorbereitet /></span>}>
          <p className="text-sm text-slate-500 mb-3">
            Gedacht für die Selbstinstallation ohne Geräteverwaltung. Die App kennt die Codes noch nicht – Mitarbeitende
            verbinden sich heute über den QR-Code und melden sich mit E-Mail-Adresse und Passwort an.
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
      </Bereich>

      <Bereich id="int-kanaele">
        <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} /> SMS-Gateway</span>}>
          <SmsEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><MessageSquare size={16} /> Microsoft Teams: Kanalmeldungen</span>}>
          <TeamsEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><PhoneCall size={16} /> Sprachanruf &amp; Telefonkonferenz (Microsoft Teams)</span>}>
          <TelefonieEinstellungen />
        </Card>
      </Bereich>

      <Bereich id="int-anmeldung">
        <Card title={<span className="flex items-center gap-2"><KeyRound size={16} /> Single Sign-On (Microsoft Entra ID)</span>}>
          <SsoEinstellungen />
        </Card>

        <Card title={<span className="flex items-center gap-2"><Users size={16} /> Personalsystem</span>}>
          <PersonalsystemEinstellungen />
        </Card>
      </Bereich>

      <Bereich id="int-systeme">
        <Card title={<span className="flex items-center gap-2"><Radio size={16} /> LoRaWAN-Netz / Alarmknöpfe</span>}>
          <LorawanEinstellungen />
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
      </Bereich>

      <Bereich id="int-betrieb">
        <Card title={<span className="flex items-center gap-2"><ServerCog size={16} /> Redundanz – zweiter Alarmserver</span>}>
          <RedundanzEinstellungen />
        </Card>
      </Bereich>

      {editingWebhook && <WebhookEditor webhook={editingWebhook} onClose={() => setEditingWebhook(null)} />}
    </div>
  )
}

// ---------- Bausteine ----------

/** Name und Auftritt der Organisation – erscheint in Portal, App und als SMS-Absender */
function OrganisationEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const org = integ.organization ?? { name: '', shortName: '' }
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(org)

  function update(patchInteg: Partial<IntegrationSettings>) {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, ...patchInteg } })
  }

  function speichern() {
    const farbe = (entwurf.color ?? '').trim()
    dispatch({
      type: 'UPDATE_INTEGRATIONS',
      integrations: {
        ...integ,
        organization: {
          ...org,
          name: entwurf.name.trim(),
          shortName: entwurf.shortName.trim().slice(0, 11),
          color: /^#[0-9a-fA-F]{6}$/.test(farbe) ? farbe : undefined,
        },
      },
    })
    gespeichert()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name der Organisation">
          <input className={inputClass} placeholder="Muster AG" value={entwurf.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="Kurzname (max. 11 Zeichen, für SMS-Absender)">
          <input className={inputClass} maxLength={11} placeholder="MUSTER" value={entwurf.shortName} onChange={(e) => patch({ shortName: e.target.value })} />
        </Field>
      </div>
      <Field label="Akzentfarbe – färbt Navigation, Knöpfe und Akzente in Portal und App">
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-12 rounded border border-slate-300 bg-white p-0.5 cursor-pointer"
            value={/^#[0-9a-fA-F]{6}$/.test(entwurf.color ?? '') ? entwurf.color! : '#1c504b'}
            onChange={(e) => patch({ color: e.target.value })}
            aria-label="Akzentfarbe wählen"
          />
          <input
            className={`${inputClass} max-w-[130px] font-mono`}
            placeholder="#1c504b"
            value={entwurf.color ?? ''}
            onChange={(e) => patch({ color: e.target.value })}
          />
          {entwurf.color && (
            <Button variant="ghost" onClick={() => patch({ color: undefined })}>Standardfarbe</Button>
          )}
        </div>
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
      </div>
      <p className="text-xs text-slate-400">
        Name, Farbe und Logo erscheinen auf der Anmeldemaske des Portals und in der App (iOS und Android),
        sobald sie mit diesem Alarmserver verbunden ist – die App selbst bleibt für alle Kunden dieselbe.
        Das Alarmrot bleibt aus Sicherheitsgründen bei allen Kunden gleich.
      </p>

      <LogoEinstellungen />

      <div className="pt-3 border-t border-slate-100">
        <Toggle
          checked={integ.hotline.enabled}
          onChange={(v) => update({ hotline: { ...integ.hotline, enabled: v } })}
          label="Interne Notfallnummer (Alarmauslösung per Anruf / Sprachnachricht)"
        />
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

      <div className="pt-3 border-t border-slate-100">
        <Toggle
          checked={integ.multiLanguage}
          onChange={(v) => update({ multiLanguage: v })}
          label={`Mehrsprachige App-Inhalte (DE/EN/FR/IT) – ${VORBEREITET}`}
        />
      </div>
    </div>
  )
}

/** Kundenlogo: hochladen, Vorschau, entfernen – liegt auf dem Alarmserver */
function LogoEinstellungen() {
  const { state, refresh } = useStore()
  const logoVersion = state.integrations.organization?.logoVersion
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  if (state.mode !== 'live') {
    return (
      <p className="text-xs text-slate-400 pt-3 border-t border-slate-100">
        Das Kundenlogo wird auf dem Alarmserver hinterlegt – im Live-Modus verfügbar.
      </p>
    )
  }

  function hochladen(datei: File) {
    setFehler(null)
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(datei.type)) {
      setFehler('Bitte ein Bild als PNG, JPEG, SVG oder WebP wählen.')
      return
    }
    const leser = new FileReader()
    leser.onload = async () => {
      const dataUrl = String(leser.result ?? '')
      if (dataUrl.length > 400_000) {
        setFehler('Das Logo ist zu gross – bitte höchstens rund 300 KB (am besten als SVG oder verkleinertes PNG).')
        return
      }
      setLaedt(true)
      try {
        await api.uploadLogo(dataUrl)
        refresh()
      } catch (f) {
        setFehler((f as Error).message)
      } finally {
        setLaedt(false)
      }
    }
    leser.readAsDataURL(datei)
  }

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="text-xs text-slate-500 font-medium">Kundenlogo</div>
      <div className="flex items-center gap-3 flex-wrap">
        {logoVersion ? (
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2">
            <img src={logoUrl(logoVersion)} alt="Kundenlogo" className="h-10 w-auto max-w-[180px] object-contain" />
          </span>
        ) : (
          <span className="text-xs text-slate-400">Noch kein Logo hinterlegt.</span>
        )}
        <label className="inline-flex">
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) hochladen(f); e.target.value = '' }}
          />
          <span className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition">
            {laedt ? 'Lädt …' : logoVersion ? 'Logo ersetzen' : 'Logo hochladen'}
          </span>
        </label>
        {logoVersion && (
          <Button variant="ghost" onClick={() => { setFehler(null); api.deleteLogo().then(refresh).catch((f: Error) => setFehler(f.message)) }}>
            <Trash2 size={13} /> Entfernen
          </Button>
        )}
      </div>
      {fehler && <p className="text-xs text-alarm-600">{fehler}</p>}
      <p className="text-xs text-slate-400">
        PNG, JPEG, SVG oder WebP, max. ~300 KB – am besten ein Logo mit transparentem Hintergrund.
        Es erscheint hell hinterlegt auf der Anmeldemaske, in der Portal-Sidebar und in der App.
      </p>
    </div>
  )
}

/** Geofencing: Alarmierung nach dem gemeldeten Aufenthaltsort */
function GeofencingEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations

  return (
    <div className="space-y-3">
      <Toggle
        checked={integ.geofencing}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, geofencing: v } })}
        label="Alarmierung nach Aufenthaltsort"
      />
      <p className={`text-xs pl-11 ${integ.geofencing ? 'text-slate-500' : 'text-slate-400'}`}>
        Die App meldet beim Betreten und Verlassen eines Standort-Geofences nur den Standort-Namen –
        nie GPS-Koordinaten. Wer sich gerade an einem alarmierten Standort aufhält, wird zusätzlich
        alarmiert; ohne aktuelle Ortsmeldung gilt der Profilstandort. Radius je Standort unter
        «Standorte»; die Mitarbeitenden müssen der Standortfreigabe in der App zustimmen.
      </p>
    </div>
  )
}

/** Benutzer aus dem Personalsystem übernehmen – vorbereitet */
function PersonalsystemEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations

  function update(patch: Partial<IntegrationSettings>) {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, ...patch } })
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={integ.hrSync.enabled}
        onChange={(v) => update({ hrSync: { ...integ.hrSync, enabled: v, lastSync: v ? Date.now() : integ.hrSync.lastSync } })}
        label={`Automatische Synchronisation mit dem Personalsystem – ${VORBEREITET}`}
      />
      {integ.hrSync.enabled && (
        <div className="pl-11 space-y-2">
          <Field label="System">
            <input className={inputClass} value={integ.hrSync.system} onChange={(e) => update({ hrSync: { ...integ.hrSync, system: e.target.value } })} />
          </Field>
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {integ.hrSync.lastSync && <span>Letzte Synchronisation: {formatDateTime(integ.hrSync.lastSync)}</span>}
            <Button variant="secondary" onClick={() => update({ hrSync: { ...integ.hrSync, lastSync: Date.now() } })}>
              <RefreshCw size={13} /> Jetzt synchronisieren
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Bis dahin werden Benutzer von Hand oder per CSV-Import unter «Benutzer» gepflegt.
      </p>
    </div>
  )
}

/**
 * Redundanz: Dieser Server und ein Partnerserver sichern sich gegenseitig ab.
 * Konfiguration gilt pro Instanz – auf beiden Servern einrichten (gespiegelte
 * Rollen, gleiches Geheimnis).
 */
function RedundanzEinstellungen() {
  const { state } = useStore()
  const [daten, setDaten] = useState<{ config: RedundanzConfig; status: RedundanzStatus; peerErreichbar: boolean | null } | null>(null)
  const [entwurf, setEntwurf] = useState<RedundanzConfig | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState(false)

  const laden = () => {
    api.redundanz()
      .then((d) => { setDaten(d); setEntwurf(d.config); setFehler(null) })
      .catch((f: Error) => setFehler(f.message))
  }
  useEffect(() => {
    if (state.mode !== 'live') return
    laden()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode])

  if (state.mode !== 'live') {
    return <p className="text-sm text-slate-500">Die Redundanz wird auf dem Alarmserver eingerichtet – im Live-Modus verfügbar.</p>
  }
  if (fehler && !daten) return <p className="text-sm text-alarm-600">{fehler}</p>
  if (!daten || !entwurf) return <p className="text-sm text-slate-500">Lade Konfiguration …</p>

  async function speichern() {
    setFehler(null)
    setMeldung(null)
    try {
      const { config } = await api.saveRedundanz(entwurf!)
      setDaten((d) => (d ? { ...d, config } : d))
      setEntwurf(config)
      setMeldung('Gespeichert. Dieselbe Einrichtung mit vertauschten Rollen auf dem Partnerserver vornehmen.')
      laden()
    } catch (f) {
      setFehler((f as Error).message)
    }
  }

  async function neuerSchluessel() {
    setFehler(null)
    try {
      const { secret } = await api.redundanzNeuerSchluessel()
      setEntwurf((e) => (e ? { ...e, secret } : e))
      setMeldung('Neues Geheimnis erzeugt und gespeichert – jetzt auf dem Partnerserver eintragen.')
    } catch (f) {
      setFehler((f as Error).message)
    }
  }

  const status = daten.status
  return (
    <div className="space-y-3">
      <Toggle
        checked={entwurf.enabled}
        onChange={(v) => setEntwurf({ ...entwurf, enabled: v })}
        label="Zweiten Alarmserver anbinden (Ausfallsicherheit)"
      />
      {entwurf.enabled && (
        <div className="pl-11 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rolle dieses Servers">
              <select className={inputClass} value={entwurf.role} onChange={(e) => setEntwurf({ ...entwurf, role: e.target.value as RedundanzConfig['role'] })}>
                <option value="primary">Hauptserver (führt die Daten)</option>
                <option value="standby">Standby (spiegelt, übernimmt bei Ausfall)</option>
              </select>
            </Field>
            <Field label="Adresse des Partnerservers">
              <input className={inputClass} placeholder="https://notfall2.firma.ch" value={entwurf.peerUrl} onChange={(e) => setEntwurf({ ...entwurf, peerUrl: e.target.value })} />
            </Field>
          </div>
          <Field label="Gemeinsames Geheimnis (auf beiden Servern identisch)">
            <div className="flex items-center gap-2">
              <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 flex-1 min-w-0 truncate">
                {entwurf.secret || '– wird beim Speichern erzeugt –'}
              </code>
              {entwurf.secret && (
                <Button
                  variant="ghost"
                  onClick={() => { navigator.clipboard?.writeText(entwurf.secret); setKopiert(true); setTimeout(() => setKopiert(false), 2000) }}
                  aria-label="Geheimnis kopieren"
                >
                  <Copy size={13} />
                </Button>
              )}
              {kopiert && <span className="text-xs text-emerald-700">kopiert</span>}
            </div>
          </Field>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern}>Speichern</Button>
            <Button variant="secondary" onClick={neuerSchluessel}><RefreshCw size={13} /> Neues Geheimnis</Button>
            <Button variant="ghost" onClick={laden}><RefreshCw size={13} /> Status aktualisieren</Button>
          </div>
          {(fehler || meldung) && (
            <p className={`text-xs ${fehler ? 'text-alarm-600' : 'text-emerald-700'}`}>{fehler ?? meldung}</p>
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Partner:</span>
              {daten.peerErreichbar === null ? 'unbekannt' : daten.peerErreichbar
                ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> erreichbar</span>
                : <span className="text-alarm-600 inline-flex items-center gap-1"><XCircle size={12} /> nicht erreichbar</span>}
            </div>
            {daten.config.role === 'standby' && (
              <>
                <div>
                  <span className="font-semibold">Letzter Abgleich:</span>{' '}
                  {status.lastSyncAt ? `${formatDateTime(status.lastSyncAt)} – ${status.lastSyncOk ? 'erfolgreich' : `fehlgeschlagen (${status.lastSyncError})`}` : 'noch keiner'}
                </div>
                {status.failoverAktiv && (
                  <div className="text-alarm-600 font-semibold">
                    Failover aktiv: Der Hauptserver ist nicht erreichbar – dieser Server verarbeitet die Alarme.
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Der Standby holt sich alle {entwurf.intervalS} Sekunden den vollständigen Datenbestand des Hauptservers –
            inklusive Konten, Sitzungen und Push-Registrierungen, damit angemeldete Geräte beim Ausweichen angemeldet
            bleiben. <b>Achtung:</b> Beim Einrichten als Standby wird der dortige Datenbestand vollständig durch den
            des Hauptservers ersetzt. Fällt der Hauptserver länger als 90 Sekunden aus, übernimmt der Standby; danach
            meldet er dort erfasste Alarme an den Hauptserver zurück. Auf dem Partnerserver dieselbe Einrichtung mit
            vertauschten Rollen und demselben Geheimnis vornehmen.
          </p>
        </div>
      )}
    </div>
  )
}

/** Verbindungs-Link samt QR-Code, mit dem sich die iOS-App diesem Server zuordnet */
function AppVerbindung() {
  const { state } = useStore()
  const [fallback, setFallback] = useState<string>('')
  const [kopiert, setKopiert] = useState(false)

  useEffect(() => {
    if (state.mode !== 'live') return
    // Ausweichadresse aus der Redundanz-Konfiguration übernehmen, falls vorhanden
    api.redundanz().then((d) => { if (d.config.enabled && d.config.peerUrl) setFallback(d.config.peerUrl) }).catch(() => {})
  }, [state.mode])

  if (state.mode !== 'live') {
    return <p className="text-sm text-slate-500">Den Verbindungs-QR-Code zeigt der Alarmserver im Live-Modus an.</p>
  }

  const orgName = state.integrations.organization?.name ?? ''
  const link =
    `sobenotfall://verbinden?server=${encodeURIComponent(serverUrl())}` +
    (fallback ? `&fallback=${encodeURIComponent(fallback)}` : '') +
    (orgName ? `&name=${encodeURIComponent(orgName)}` : '')

  const qr = qrcode(0, 'M')
  qr.addData(link)
  qr.make()
  const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Mitarbeitende scannen diesen Code mit der Kamera ihres iPhones oder Android-Telefons: Die
        SOBE-Notfall-App übernimmt die Serveradresse{fallback ? ' samt Ausweichserver' : ''} automatisch –
        niemand muss eine Adresse eintippen.
      </p>
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="w-40 h-40 shrink-0 rounded-lg border border-slate-200 bg-white p-2 [&_svg]:w-full [&_svg]:h-full"
          role="img"
          aria-label="QR-Code für die App-Verbindung"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex-1 min-w-[200px] space-y-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <QrCode size={13} className="shrink-0" />
            <code className="bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 min-w-0 truncate">{link}</code>
            <Button
              variant="ghost"
              onClick={() => { navigator.clipboard?.writeText(link); setKopiert(true); setTimeout(() => setKopiert(false), 2000) }}
              aria-label="Verbindungs-Link kopieren"
            >
              <Copy size={13} />
            </Button>
            {kopiert && <span className="text-emerald-700">kopiert</span>}
          </div>
          <p>
            Der Link lässt sich auch per E-Mail oder MDM verteilen; Antippen auf dem iPhone öffnet die App und
            übernimmt die Adresse. Voraussetzung: Die App ist installiert. Anmelden müssen sich die
            Mitarbeitenden anschliessend wie gewohnt mit ihrem Konto.
          </p>
        </div>
      </div>
    </div>
  )
}

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

function SsoEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const sso = integ.sso
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(sso)
  const [test, setTest] = useState<TestStatus>(null)

  function speichern() {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, sso: { ...entwurf, enabled: sso.enabled } } })
    gespeichert()
  }

  async function testen() {
    setTest({ laeuft: true })
    try {
      await api.ssoTest()
      setTest({ ok: true, text: 'Verbindung steht – Mandant, Anwendungs-ID und Geheimnis stimmen.' })
    } catch (fehler) {
      setTest({ ok: false, text: (fehler as Error).message })
    }
  }

  const callbackUrl = `${serverUrl()}/api/auth/sso/callback`

  return (
    <div className="space-y-3">
      <Toggle
        checked={sso.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, sso: { ...sso, enabled: v } } })}
        label="Anmeldung mit dem Microsoft-Konto im Portal und in der App"
      />
      {sso.enabled && (
        <div className="pl-11 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mandant (Tenant-ID)">
              <input className={inputClass} placeholder="00000000-0000-0000-0000-000000000000" value={entwurf.tenantId} onChange={(e) => patch({ tenantId: e.target.value })} />
            </Field>
            <Field label="Anwendungs-ID (Client-ID)">
              <input className={inputClass} value={entwurf.clientId} onChange={(e) => patch({ clientId: e.target.value })} />
            </Field>
          </div>
          <Field label="Geheimnis (Client Secret)">
            <input className={inputClass} type="password" value={entwurf.clientSecret} onChange={(e) => patch({ clientSecret: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Entra-Gruppe für Administration (Objekt-ID, optional)">
              <input className={inputClass} value={entwurf.adminGroupId} onChange={(e) => patch({ adminGroupId: e.target.value })} />
            </Field>
            <Field label="Entra-Gruppe für Krisenstab (Objekt-ID, optional)">
              <input className={inputClass} value={entwurf.krisenstabGroupId} onChange={(e) => patch({ krisenstabGroupId: e.target.value })} />
            </Field>
          </div>
          <Toggle
            checked={entwurf.autoCreate}
            onChange={(v) => patch({ autoCreate: v })}
            label="Unbekannte Microsoft-Konten beim ersten Login automatisch als Mitarbeitende anlegen"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
            {state.mode === 'live' && <Button variant="secondary" onClick={testen} disabled={geaendert}>Verbindung testen</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-slate-400">
            In der App-Registrierung als Umleitungs-URI (Typ «Web») hinterlegen:{' '}
            <code className="bg-slate-50 border border-slate-200 rounded px-1">{callbackUrl}</code>.
            Benötigte delegierte Berechtigungen: openid, profile, email (mit Administratorzustimmung); für die
            Rollen aus Gruppen zusätzlich unter «Tokenkonfiguration» den Gruppenanspruch (groups claim) hinzufügen.
            Die Passwort-Anmeldung bleibt als Rückfall bestehen – sind die Gruppenfelder leer, verändert SSO keine Rollen.
          </p>
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
