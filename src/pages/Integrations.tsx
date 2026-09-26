import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import qrcode from 'qrcode-generator'
import {
  Building2, CheckCircle2, ChevronDown, Copy, KeyRound, Link2, Loader2, LocateFixed, MapPin, MessageSquare, Phone, PhoneCall,
  Plus, QrCode, Radio, RefreshCw, Search, ServerCog, ShieldCheck, Smartphone, Trash2, Users, XCircle, type LucideIcon,
} from 'lucide-react'
import { api, logoUrl, serverUrl, type RedundanzConfig, type RedundanzStatus } from '../lib/api'
import { uid, useStore } from '../store'
import type { IntegrationSettings, MeridianKarte, Webhook } from '../types'
import { Badge, Button, Card, Field, Modal, Toggle, VORBEREITET, Vorbereitet, formatDateTime, inputClass } from '../components/ui'
import { useSprungziel } from '../lib/sprungziel'
import { ladeMeridianSdk, vergissMeridianZugang } from '../components/IndoorKarte'

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
  { id: 'int-anmeldung', titel: 'Anmeldung & Konten', hinweis: 'Woher die Konten kommen und wie sich alle anmelden.' },
  { id: 'int-systeme', titel: 'Drittsysteme & Alarmknöpfe', hinweis: 'Physische Alarmknöpfe und Schnittstellen zu anderen Systemen.' },
  { id: 'int-datenschutz', titel: 'Datenschutz & Aufbewahrung', hinweis: 'Wie lange Alarme und das Ereignisprotokoll aufbewahrt werden, bevor sie automatisch gelöscht werden.' },
  { id: 'int-betrieb', titel: 'Betrieb & Ausfallsicherheit', hinweis: 'Ein zweiter Alarmserver übernimmt, wenn dieser ausfällt.' },
] as const

type BereichId = (typeof BEREICHE)[number]['id']

/**
 * Zustand einer Einstellung in einem Wort.
 *
 * «aktiv» und «inaktiv» sind Schalter, die man kennen muss, bevor man einen
 * Alarm auslöst – ein ausgeschaltetes SMS-Gateway heisst: es geht keine SMS
 * raus. «info» ist für Karten ohne Schalter, «vorbereitet» für das, was im
 * Portal steht, aber noch nichts bewirkt.
 */
type StatusArt = 'aktiv' | 'inaktiv' | 'vorbereitet' | 'info'
interface KartenStatus { art: StatusArt; text: string }

const STATUS_PUNKT: Record<StatusArt, string> = {
  aktiv: 'bg-emerald-500',
  inaktiv: 'bg-slate-300',
  vorbereitet: 'bg-amber-400',
  info: 'bg-slate-400',
}

interface KartenDefinition {
  id: string
  bereich: BereichId
  titel: string
  icon: LucideIcon
  /** Zusätzliche Wörter für die Suche, die nicht im Titel stehen */
  suchbegriffe: string
  status: KartenStatus
  inhalt: ReactNode
  aktionen?: ReactNode
}

export default function Integrations() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [bereich, setBereich] = useState<BereichId | 'alle'>(BEREICHE[0].id)
  const [offen, setOffen] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  const { hash } = useLocation()
  // Verlinkung aus dem Alarmserver-Status des Dashboards: zur Karte scrollen
  useSprungziel()

  const karten: KartenDefinition[] = [
    {
      id: 'int-organisation-auftritt',
      bereich: 'int-organisation',
      titel: 'Organisation & Auftritt',
      icon: Building2,
      suchbegriffe: 'name logo farbe kurzname notfallnummer hotline branding',
      status: integ.organization?.name
        ? { art: 'info', text: integ.organization.name }
        : { art: 'inaktiv', text: 'Name und Auftritt noch nicht erfasst' },
      inhalt: <OrganisationEinstellungen />,
    },
    {
      id: 'int-app-verbindung',
      bereich: 'int-app',
      titel: 'App-Verbindung',
      icon: Smartphone,
      suchbegriffe: 'qr code link serveradresse installieren verteilen',
      status: { art: 'info', text: 'QR-Code und Link, mit dem sich die App verbindet' },
      inhalt: <AppVerbindung />,
    },
    {
      id: 'int-geofencing',
      bereich: 'int-app',
      titel: 'Geofencing',
      icon: MapPin,
      suchbegriffe: 'standort aufenthaltsort gps radius',
      status: integ.geofencing
        ? { art: 'aktiv', text: 'Alarmiert wird nach dem gemeldeten Aufenthaltsort' }
        : { art: 'inaktiv', text: 'Aus – alarmiert wird nach dem Standort im Profil' },
      inhalt: <GeofencingEinstellungen />,
    },
    {
      id: 'int-indoor',
      bereich: 'int-app',
      titel: 'Indoor-Ortung (Aruba Meridian)',
      icon: LocateFixed,
      suchbegriffe: 'beacon bluetooth access point aruba meridian raum stockwerk grundriss innen',
      status: integ.meridian.enabled
        ? { art: 'aktiv', text: `Position im Gebäude wird mit Alarmen übermittelt · ${integ.meridian.karten.length} Stockwerke benannt` }
        : { art: 'inaktiv', text: 'Aus – Alarme nennen nur den Standort' },
      inhalt: <IndoorEinstellungen />,
    },
    {
      id: 'int-zugangscodes',
      bereich: 'int-app',
      titel: 'Deployment via Zugangscodes',
      icon: KeyRound,
      suchbegriffe: 'selbstinstallation code registrierung',
      status: { art: 'vorbereitet', text: `${integ.accessCodes.length} Codes erfasst – die App kennt sie noch nicht` },
      inhalt: <ZugangscodeEinstellungen />,
    },
    {
      id: 'int-sms',
      bereich: 'int-kanaele',
      titel: 'SMS-Gateway',
      icon: MessageSquare,
      suchbegriffe: 'ecall aspsms twilio sms textmeldung absender gateway sprachanruf',
      status: integ.smsGateway.enabled
        ? { art: 'aktiv', text: `${integ.smsGateway.provider}${integ.smsGateway.sentCount ? ` · ${integ.smsGateway.sentCount} versendet` : ''}` }
        : { art: 'inaktiv', text: 'Kein Gateway – der Kanal «SMS» wird nicht zugestellt' },
      inhalt: <SmsEinstellungen />,
    },
    {
      id: 'int-teams',
      bereich: 'int-kanaele',
      titel: 'Microsoft Teams: Kanalmeldungen',
      icon: MessageSquare,
      suchbegriffe: 'teams webhook kanal microsoft karte',
      status: integ.teams.enabled
        ? { art: 'aktiv', text: integ.teams.tenant || 'Kanalmeldungen eingerichtet' }
        : { art: 'inaktiv', text: 'Keine Meldungen in einen Teams-Kanal' },
      inhalt: <TeamsEinstellungen />,
    },
    {
      id: 'int-telefonie',
      bereich: 'int-kanaele',
      titel: 'Sprachanruf & Telefonkonferenz',
      icon: PhoneCall,
      suchbegriffe: 'anruf voice konferenz teams telefon graph',
      status: integ.telephony.enabled
        ? { art: 'aktiv', text: 'über Microsoft Teams' }
        : { art: 'inaktiv', text: 'Keine Sprachanrufe, keine Krisenkonferenz' },
      inhalt: <TelefonieEinstellungen />,
    },
    {
      id: 'int-sso',
      bereich: 'int-anmeldung',
      titel: 'Single Sign-On (Microsoft Entra ID)',
      icon: KeyRound,
      suchbegriffe: 'sso entra azure anmeldung microsoft konto',
      status: integ.sso.enabled
        ? { art: 'aktiv', text: 'Anmeldung mit dem Microsoft-Konto' }
        : { art: 'inaktiv', text: 'Anmeldung mit E-Mail-Adresse und Passwort' },
      inhalt: <SsoEinstellungen />,
    },
    {
      id: 'int-personalsystem',
      bereich: 'int-anmeldung',
      titel: 'Personalsystem',
      icon: Users,
      suchbegriffe: 'hr abgleich import konten synchronisation',
      status: integ.hrSync.enabled
        ? { art: 'vorbereitet', text: integ.hrSync.system || 'Abgleich vorgemerkt' }
        : { art: 'inaktiv', text: 'Konten werden von Hand oder per CSV gepflegt' },
      inhalt: <PersonalsystemEinstellungen />,
    },
    {
      id: 'int-lorawan',
      bereich: 'int-systeme',
      titel: 'LoRaWAN-Netz / Alarmknöpfe',
      icon: Radio,
      suchbegriffe: 'knopf button uplink ttn chirpstack token endpunkt armband',
      status: integ.lorawan.enabled
        ? { art: 'aktiv', text: `${integ.lorawan.provider} · ${state.buttons.length} Knöpfe erfasst` }
        : { art: 'inaktiv', text: 'Uplink-Endpunkt aus – ein Knopfdruck löst nichts aus' },
      inhalt: <LorawanEinstellungen />,
    },
    {
      id: 'int-webhooks',
      bereich: 'int-systeme',
      titel: 'IP- / Webhook-Integration',
      icon: Link2,
      suchbegriffe: 'schnittstelle brandmeldeanlage leitstelle ausgehend eingehend',
      status: integ.webhooks.some((w) => w.active)
        ? { art: 'aktiv', text: `${integ.webhooks.filter((w) => w.active).length} von ${integ.webhooks.length} aktiv` }
        : { art: 'inaktiv', text: integ.webhooks.length ? 'Keiner aktiv' : 'Keine Schnittstelle eingerichtet' },
      inhalt: <WebhookEinstellungen onBearbeiten={setEditingWebhook} />,
      aktionen: (
        <Button
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); setEditingWebhook({ id: uid('wh'), name: '', url: '', direction: 'inbound', active: true }) }}
        >
          <Plus size={14} /> Webhook
        </Button>
      ),
    },
    {
      id: 'int-aufbewahrung',
      bereich: 'int-datenschutz',
      titel: 'Aufbewahrungsfristen',
      icon: ShieldCheck,
      suchbegriffe: 'datenschutz nDSG löschen retention aufbewahrung audit protokoll DSGVO',
      status: integ.retention.alarmeTage || integ.retention.uebungenTage || integ.retention.auditTage
        ? { art: 'aktiv', text: 'Automatische Löschung eingerichtet' }
        : { art: 'inaktiv', text: 'Noch keine Frist festgelegt – nichts wird automatisch gelöscht' },
      inhalt: <AufbewahrungEinstellungen />,
    },
    {
      id: 'int-redundanz',
      bereich: 'int-betrieb',
      titel: 'Redundanz – zweiter Alarmserver',
      icon: ServerCog,
      suchbegriffe: 'standby failover replikation ausfall spiegel',
      status: { art: 'info', text: 'Übernimmt, wenn dieser Server ausfällt' },
      inhalt: <RedundanzEinstellungen />,
    },
  ]

  /**
   * Ein Link aus dem Dashboard zeigt auf eine einzelne Karte. Sie kann in
   * einem Bereich liegen, der gerade nicht gewählt ist – dann wird auf ihn
   * umgeschaltet und die Karte geöffnet, sonst liefe der Sprung ins Leere.
   */
  useEffect(() => {
    const ziel = karten.find((k) => k.id === hash.slice(1))
    if (!ziel) return
    setBereich(ziel.bereich)
    setOffen(ziel.id)
    setSuche('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  const begriffe = suche.toLowerCase().split(/\s+/).filter(Boolean)
  const sichtbar = useMemo(
    () =>
      karten.filter((k) => {
        if (begriffe.length > 0) {
          const heuhaufen = `${k.titel} ${k.suchbegriffe} ${k.status.text}`.toLowerCase()
          return begriffe.every((b) => heuhaufen.includes(b))
        }
        return bereich === 'alle' || k.bereich === bereich
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bereich, suche, integ, state.buttons.length],
  )

  const aktiv = karten.filter((k) => k.status.art === 'aktiv').length
  const offeneBereiche = suche ? 'alle' : bereich
  const bereichInfo = BEREICHE.find((b) => b.id === offeneBereiche)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Einstellungen &amp; Konfiguration</h1>
          <p className="text-sm text-muted">
            Alles, was das System mit der Aussenwelt verbindet – {aktiv} von {karten.length} Bereichen sind aktiv.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className={inputClass + ' pl-9'}
            placeholder="Einstellung suchen – z. B. SMS, Knopf, Teams…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[15rem_1fr] gap-6 items-start">
        {/* Bereichswahl: links als Liste, auf schmalen Fenstern oben als Zeile */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-4 pb-1 lg:pb-0">
          {BEREICHE.map((b) => {
            const eigene = karten.filter((k) => k.bereich === b.id)
            const eigeneAktiv = eigene.filter((k) => k.status.art === 'aktiv').length
            const gewaehlt = !suche && bereich === b.id
            return (
              <button
                key={b.id}
                onClick={() => { setSuche(''); setBereich(b.id) }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap lg:whitespace-normal transition ${
                  gewaehlt ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex-1">{b.titel}</span>
                <span className={`text-xs tabular-nums ${gewaehlt ? 'text-slate-300' : 'text-faint'}`}>
                  {eigeneAktiv}/{eigene.length}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 min-w-0">
          {suche ? (
            <p className="text-sm text-muted">
              {sichtbar.length === 0
                ? 'Keine Einstellung gefunden.'
                : `${sichtbar.length} Einstellung${sichtbar.length === 1 ? '' : 'en'} gefunden`}
            </p>
          ) : (
            bereichInfo && <p className="text-sm text-muted">{bereichInfo.hinweis}</p>
          )}

          {sichtbar.map((k) => (
            <EinstellungsKarte
              key={k.id}
              karte={k}
              offen={offen === k.id}
              onUmschalten={() => setOffen(offen === k.id ? null : k.id)}
            />
          ))}
        </div>
      </div>

      {editingWebhook && <WebhookEditor webhook={editingWebhook} onClose={() => setEditingWebhook(null)} />}
    </div>
  )
}

/**
 * Eine Einstellung als zugeklappte Zeile: Titel, Zustand im Klartext und ein
 * farbiger Punkt. Aufgeklappt wird nur, was gerade bearbeitet wird – vorher
 * standen alle zwölf Formulare gleichzeitig offen, und man musste jedes lesen,
 * um zu sehen, was überhaupt eingeschaltet ist.
 */
function EinstellungsKarte({ karte, offen, onUmschalten }: { karte: KartenDefinition; offen: boolean; onUmschalten: () => void }) {
  const Icon = karte.icon
  return (
    <div id={karte.id} className="bg-white rounded-xl border border-slate-200 shadow-sm scroll-mt-4 overflow-hidden">
      <div className="flex items-center gap-2 pr-3">
        <button
          onClick={onUmschalten}
          aria-expanded={offen}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left min-w-0 hover:bg-slate-50 transition"
        >
          <Icon size={17} className="text-faint shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{karte.titel}</span>
              {karte.status.art === 'vorbereitet' && <Vorbereitet />}
            </span>
            <span className="block text-xs text-muted truncate mt-0.5">{karte.status.text}</span>
          </span>
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_PUNKT[karte.status.art]}`} aria-hidden />
          <span className="text-xs text-faint w-14 text-right shrink-0 hidden sm:inline">
            {karte.status.art === 'aktiv' ? 'aktiv' : karte.status.art === 'inaktiv' ? 'inaktiv' : ''}
          </span>
          <ChevronDown size={16} className={`text-faint shrink-0 transition ${offen ? 'rotate-180' : ''}`} />
        </button>
        {offen && karte.aktionen}
      </div>
      {offen && <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-slate-100">{karte.inhalt}</div>}
    </div>
  )
}

/** Codes für die Selbstinstallation – je Standort einer */
function ZugangscodeEinstellungen() {
  const { state, dispatch } = useStore()
  return (
    <>
      <p className="text-sm text-muted mb-3">
        Gedacht für die Selbstinstallation ohne Geräteverwaltung. Die App kennt die Codes noch nicht – Mitarbeitende
        verbinden sich heute über den QR-Code und melden sich mit E-Mail-Adresse und Passwort an.
      </p>
      <div className="space-y-2">
        {state.integrations.accessCodes.map((c) => (
          <div key={c.code} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm">
            <code className="font-mono font-semibold text-slate-800">{c.code}</code>
            <span className="text-xs text-faint flex-1">
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
    </>
  )
}

/** Schnittstellen zu Drittsystemen – ein- und ausgehend */
function WebhookEinstellungen({ onBearbeiten }: { onBearbeiten: (w: Webhook) => void }) {
  const { state, dispatch } = useStore()
  const webhooks = state.integrations.webhooks
  return (
    <>
      <div className="space-y-2">
        {webhooks.length === 0 && <p className="text-sm text-faint">Noch keine Schnittstelle eingerichtet.</p>}
        {webhooks.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800">{w.name}</div>
              <div className="text-xs text-faint truncate">{w.url}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge color={w.direction === 'inbound' ? 'blue' : 'violet'}>{w.direction === 'inbound' ? 'eingehend' : 'ausgehend'}</Badge>
                <Badge color={w.active ? 'green' : 'slate'}>{w.active ? 'aktiv' : 'inaktiv'}</Badge>
                {w.direction === 'inbound' && <Vorbereitet />}
              </div>
            </div>
            <Button variant="ghost" onClick={() => onBearbeiten(w)}>Bearbeiten</Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'DELETE_WEBHOOK', webhookId: w.id })}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
      <div className="text-xs text-faint mt-3">
        Ausgehende Webhooks melden jede Auslösung an Drittsysteme und sind aktiv. Eingehende Webhooks von
        Brandmeldeanlagen sind {VORBEREITET}; Alarmknöpfe kommen bereits über den LoRaWAN-Endpunkt herein.
      </div>
    </>
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
          // «??» statt «||»: Ein geleertes Feld bleibt ein leerer Eintrag und
          // wird nicht zu «nie gesetzt» – sonst käme die Vorgabe zurück.
          appName: entwurf.appName?.trim() ?? undefined,
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
      <Field label="Anwendungsname – steht neben dem Logo in Portal, App und Anmeldemaske">
        <input
          className={inputClass} placeholder="SOBE Notfall"
          value={entwurf.appName ?? ''} onChange={(e) => patch({ appName: e.target.value })}
        />
        <p className="text-xs text-muted mt-1">
          Leer lassen, wenn neben dem Logo kein Text stehen soll. Ohne Logo bleibt dann
          nur das Symbol – prüfen Sie in dem Fall die Anmeldemaske.
        </p>
      </Field>
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
      <p className="text-xs text-faint">
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
            <Field label="Nummer – reine Konfiguration, wird nirgends in Portal oder App angezeigt">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted shrink-0" />
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
  const { state, dispatch, refresh } = useStore()
  const organisation = state.integrations.organization
  const logoVersion = organisation?.logoVersion
  const platte = Boolean(organisation?.logoPlatte)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

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
      <div className="text-xs text-muted font-medium">Kundenlogo</div>
      <div className="flex items-center gap-3 flex-wrap">
        {logoVersion ? (
          // Zwei Vorschauen: Das Logo erscheint auf hellem Grund (Kacheln im
          // Portal) und auf dunklem (Anmeldemaske, Sidebar, App-Kopfzeile).
          // Nur nebeneinander lässt sich beurteilen, ob es beides verträgt.
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 ${platte ? '' : 'bg-white'}`}>
              <img src={logoUrl(logoVersion)} alt="Kundenlogo auf hellem Grund" className="h-10 w-auto max-w-[180px] object-contain" />
            </span>
            <span className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 p-2">
              <span className={platte ? 'inline-flex items-center rounded bg-white p-1.5' : 'inline-flex'}>
                <img src={logoUrl(logoVersion)} alt="Kundenlogo auf dunklem Grund" className="h-10 w-auto max-w-[180px] object-contain" />
              </span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-faint">Noch kein Logo hinterlegt.</span>
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
      {logoVersion && organisation && (
        <div className="pt-1">
          <Toggle
            checked={platte}
            onChange={(v) => dispatch({
              type: 'UPDATE_INTEGRATIONS',
              integrations: { ...state.integrations, organization: { ...organisation, logoPlatte: v } },
            })}
            label="Auf heller Fläche zeigen"
          />
          <p className="text-xs text-muted mt-1 pl-11">
            {platte
              ? 'Das Logo liegt auf einem weissen Feld. Nötig für dunkle Logos – sie wären auf der dunklen Anmeldemaske sonst unsichtbar.'
              : 'Das Logo erscheint so, wie Sie es hochgeladen haben – ein transparenter Hintergrund bleibt transparent. Prüfen Sie an der rechten Vorschau, ob es auf dunklem Grund noch zu erkennen ist.'}
          </p>
        </div>
      )}
      <p className="text-xs text-faint">
        PNG, JPEG, SVG oder WebP, max. ~300 KB – am besten ein Logo mit transparentem Hintergrund.
        Es erscheint auf der Anmeldemaske, in der Portal-Sidebar und in der App; diese drei
        Flächen sind dunkel.
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
      <p className={`text-xs pl-11 ${integ.geofencing ? 'text-muted' : 'text-faint'}`}>
        Die App meldet beim Betreten und Verlassen eines Standort-Geofences nur den Standort-Namen –
        nie GPS-Koordinaten. Wer sich gerade an einem alarmierten Standort aufhält, wird zusätzlich
        alarmiert; ohne aktuelle Ortsmeldung gilt der Profilstandort. Radius je Standort unter
        «Standorte»; die Mitarbeitenden müssen der Standortfreigabe in der App zustimmen.
      </p>
    </div>
  )
}

/**
 * Automatische Löschung alter Alarme und Audit-Einträge. 0/leer heisst
 * «unbegrenzt» – bis hier bewusst eine Zahl eingetragen wird, ändert sich am
 * bisherigen Verhalten nichts.
 */
function AufbewahrungEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const r = integ.retention

  function update(patch: Partial<typeof r>) {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, retention: { ...r, ...patch } } })
  }

  const feld = (
    label: string, hinweis: string, wert: number, setzen: (n: number) => void,
  ) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="number" min={0} className={inputClass + ' w-28'}
          value={wert || ''}
          placeholder="unbegrenzt"
          onChange={(e) => setzen(Math.max(0, Math.trunc(Number(e.target.value)) || 0))}
        />
        <span className="text-xs text-muted">Tage</span>
      </div>
      <p className="text-xs text-faint mt-1">{hinweis}</p>
    </Field>
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted rounded-xl bg-slate-50 border border-slate-200 p-3">
        Das Datenschutzrecht verlangt, Personendaten nicht länger aufzubewahren als nötig – ein Feld
        leer zu lassen bedeutet aber nicht «löschen», sondern «noch keine Frist festgelegt». Für echte
        Alarme mit Personenbezug lohnt sich eine Rücksprache mit der Schulleitung oder
        Rechtsberatung: Personenschäden können in der Schweiz zivilrechtlich noch nach vielen Jahren
        geltend gemacht werden, bei Minderjährigen unter Umständen erst ab deren Volljährigkeit.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {feld(
          'Echte Alarme', 'Nicht-Übungsalarme – Auslösung, Verlauf, Ereignisbericht.',
          r.alarmeTage, (n) => update({ alarmeTage: n }),
        )}
        {feld(
          'Übungsalarme', 'Alarme, die als Übung markiert sind.',
          r.uebungenTage, (n) => update({ uebungenTage: n }),
        )}
        {feld(
          'Ereignisprotokoll (Audit-Log)', 'Alle protokollierten Aktionen im Portal.',
          r.auditTage, (n) => update({ auditTage: n }),
        )}
      </div>
      <p className="text-xs text-faint">
        Beendete Alarme und Protokolleinträge, die älter als die jeweilige Frist sind, werden
        automatisch gelöscht – spätestens innerhalb von 10 Minuten nach Ablauf. Laufende Alarme
        werden nie gelöscht.
      </p>
    </div>
  )
}

/**
 * Indoor-Ortung über Aruba Meridian: Die Access Points senden Bluetooth-Beacons,
 * das Meridian-SDK in der App bestimmt daraus Stockwerk und Position. Hier
 * stehen die Zugangsdaten und die Klarnamen der Stockwerke für Alarmtexte.
 */
function IndoorEinstellungen() {
  const { state, dispatch } = useStore()
  const integ = state.integrations
  const meridian = integ.meridian
  const [entwurf, patch, geaendert, gespeichert] = useEntwurf(meridian)
  const [laden, setLaden] = useState<TestStatus>(null)

  function speichern() {
    dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, meridian: { ...entwurf, enabled: meridian.enabled } } })
    vergissMeridianZugang()
    gespeichert()
  }

  function karteAendern(index: number, aenderung: Partial<MeridianKarte>) {
    patch({ karten: entwurf.karten.map((k, i) => (i === index ? { ...k, ...aenderung } : k)) })
  }

  /** Stockwerke aus dem Meridian Editor übernehmen – bestehende Namen und Standorte bleiben */
  async function kartenLaden() {
    setLaden({ laeuft: true })
    try {
      const zugang = await api.meridianZugang()
      if (!zugang.apiToken || !zugang.appId) throw new Error('Zuerst Location-ID und Lese-Token speichern.')
      const sdk = await ladeMeridianSdk()
      const meridianApi = new sdk.API({ token: zugang.apiToken, environment: zugang.region === 'eu' ? 'eu' : 'production' })
      // Ohne Zeitlimit bliebe die Anzeige bei einem hängenden Netz ewig auf «läuft»
      const stockwerke = await Promise.race([
        meridianApi.fetchFloorsByLocation(zugang.appId),
        new Promise<never>((_, abbruch) => setTimeout(() => abbruch(new Error('Meridian antwortet nicht – Netz oder Rechenzentrum prüfen.')), 20_000)),
      ])
      const bekannt = new Set(entwurf.karten.map((k) => k.mapId))
      const neu = stockwerke
        .filter((f) => f.id && !bekannt.has(f.id))
        .map((f): MeridianKarte => ({
          mapId: String(f.id),
          name: [f.group_name, f.name].filter((t) => typeof t === 'string' && t.trim()).join(', '),
        }))
      if (neu.length > 0) patch({ karten: [...entwurf.karten, ...neu] })
      setLaden({ ok: true, text: `${stockwerke.length} Stockwerke gefunden, ${neu.length} neu – bitte prüfen und speichern.` })
    } catch (fehler) {
      setLaden({ ok: false, text: (fehler as Error).message })
    }
  }

  return (
    <div className="space-y-3">
      <Toggle
        checked={meridian.enabled}
        onChange={(v) => dispatch({ type: 'UPDATE_INTEGRATIONS', integrations: { ...integ, meridian: { ...meridian, enabled: v } } })}
        label="Position im Gebäude mit Alarmen übermitteln"
      />
      <p className={`text-xs pl-11 ${meridian.enabled ? 'text-muted' : 'text-faint'}`}>
        Die Aruba-Access-Points senden Bluetooth-Beacons; die App bestimmt daraus Stockwerk und Position auf dem
        Grundriss. Übermittelt wird die Position nur mit einem Alarm – beim Auslösen und, solange der eigene Alarm
        läuft, bei Bewegung. Alarmtexte nennen das Stockwerk, die Alarmzentrale zeigt den Grundriss mit Markierung.
      </p>
      {meridian.enabled && (
        <div className="pl-11 space-y-3">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Rechenzentrum">
              <select className={inputClass} value={entwurf.region} onChange={(e) => patch({ region: e.target.value === 'us' ? 'us' : 'eu' })}>
                <option value="eu">Europa – edit-eu.meridianapps.com</option>
                <option value="us">USA – edit.meridianapps.com</option>
              </select>
            </Field>
            <Field label="Location-ID (Meridian Editor)">
              <input className={inputClass} placeholder="z. B. 5809862863224832" value={entwurf.appId} onChange={(e) => patch({ appId: e.target.value })} />
            </Field>
          </div>
          <Field label="Application Token für die App (Permissions → Application Token)">
            <input className={inputClass} value={entwurf.sdkToken} onChange={(e) => patch({ sdkToken: e.target.value })} />
          </Field>
          <Field label="Lese-Token für die Grundrissanzeige (API-Token, nur Lesen)">
            <input className={inputClass} type="password" value={entwurf.apiToken} onChange={(e) => patch({ apiToken: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
          </Field>

          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Stockwerke</div>
            <p className="text-xs text-muted mb-2">
              Jede Karte im Meridian Editor ist ein Stockwerk. Der Name erscheint in Alarmtexten («Hauptgebäude, 2. OG»);
              der Standort sorgt dafür, dass ein SOS aus diesem Stockwerk die Personen dieses Standorts alarmiert.
            </p>
            <div className="space-y-2">
              {entwurf.karten.map((k, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 items-center">
                  <input className={inputClass} placeholder="Map-ID" value={k.mapId} onChange={(e) => karteAendern(i, { mapId: e.target.value })} />
                  <input className={inputClass} placeholder="Name, z. B. Hauptgebäude, 2. OG" value={k.name} onChange={(e) => karteAendern(i, { name: e.target.value })} />
                  <select className={inputClass} value={k.locationId ?? ''} onChange={(e) => karteAendern(i, { locationId: e.target.value || undefined })}>
                    <option value="">– kein Standort –</option>
                    {state.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="p-2 text-faint hover:text-alarm-600"
                    title="Stockwerk entfernen"
                    onClick={() => patch({ karten: entwurf.karten.filter((_, j) => j !== i) })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Button variant="secondary" onClick={() => patch({ karten: [...entwurf.karten, { mapId: '', name: '' }] })}>
                <Plus size={14} /> Stockwerk
              </Button>
              <Button variant="secondary" onClick={kartenLaden} disabled={geaendert}>
                <RefreshCw size={14} /> Aus Meridian übernehmen
              </Button>
              <TestErgebnis status={laden} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-700">Einrichtung in Kürze</div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Aruba Central mit dem Meridian-Abonnement verknüpfen; die Beacons der AP505 werden dabei aktiviert.</li>
              <li>Im Meridian Editor die Grundrisse hochladen und die Access Points auf den Karten platzieren.</li>
              <li>
                Unter <b>Permissions</b> ein <b>Application Token</b> (für die App) und ein <b>API-Token nur mit
                Leserecht</b> (für die Grundrisse hier) erzeugen und oben eintragen, dazu die Location-ID aus der
                Adresse des Editors.
              </li>
              <li>Speichern, «Aus Meridian übernehmen», die Namen prüfen und die Standorte zuordnen.</li>
              <li>Im Profil der App zeigt «Im Gebäude: …», ob die Ortung greift.</li>
            </ol>
            <p>Ausführlich: <code>MERIDIAN-EINRICHTUNG.md</code> im Projektverzeichnis.</p>
          </div>
        </div>
      )}
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
          <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
            {integ.hrSync.lastSync && <span>Letzte Synchronisation: {formatDateTime(integ.hrSync.lastSync)}</span>}
            <Button variant="secondary" onClick={() => update({ hrSync: { ...integ.hrSync, lastSync: Date.now() } })}>
              <RefreshCw size={13} /> Jetzt synchronisieren
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-faint">
        Bis dahin werden Konten von Hand oder per CSV-Import unter «Benutzende» gepflegt.
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
    laden()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (fehler && !daten) return <p className="text-sm text-alarm-600">{fehler}</p>
  if (!daten || !entwurf) return <p className="text-sm text-muted">Lade Konfiguration …</p>

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
          <p className="text-xs text-faint">
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
    // Ausweichadresse aus der Redundanz-Konfiguration übernehmen, falls vorhanden
    api.redundanz().then((d) => { if (d.config.enabled && d.config.peerUrl) setFallback(d.config.peerUrl) }).catch(() => {})
  }, [])

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
      <p className="text-sm text-muted">
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
        <div className="flex-1 min-w-[200px] space-y-2 text-xs text-muted">
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
  if (status.laeuft) return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Test läuft …</span>
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
                <option value="twilio">Twilio (auch Sprachanrufe)</option>
                <option value="http">Eigenes HTTP-Gateway</option>
              </select>
            </Field>
            <Field label={entwurf.provider === 'twilio' ? 'Absender: Twilio-Nummer (+41…) oder Kurzname' : 'Absenderkennung'}>
              <input className={inputClass} value={entwurf.senderId} onChange={(e) => patch({ senderId: e.target.value })} placeholder={entwurf.provider === 'twilio' ? '+41 44 000 00 00' : undefined} />
            </Field>
          </div>
          {entwurf.provider === 'http' ? (
            <Field label="URL-Vorlage – Platzhalter {to}, {text}, {from}">
              <input className={inputClass} placeholder="https://gateway.firma.ch/send?to={to}&text={text}&from={from}" value={entwurf.httpUrl} onChange={(e) => patch({ httpUrl: e.target.value })} />
            </Field>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={entwurf.provider === 'aspsms' ? 'Userkey' : entwurf.provider === 'twilio' ? 'Account SID' : 'Benutzername'}>
                <input className={inputClass} value={entwurf.username} onChange={(e) => patch({ username: e.target.value })} />
              </Field>
              <Field label={entwurf.provider === 'twilio' ? 'Auth Token' : 'Passwort / API-Schlüssel'}>
                <input className={inputClass} type="password" value={entwurf.password} onChange={(e) => patch({ password: e.target.value })} placeholder="gespeichert – zum Ändern neu eingeben" />
              </Field>
            </div>
          )}
          {entwurf.provider === 'twilio' && (
            <div className="rounded-lg border-l-4 border-brand-600 bg-brand-50 px-3 py-2.5 text-xs text-slate-700 space-y-1">
              <p>
                <b>Mit einer eigenen Twilio-Nummer als Absender führt das System auch Sprachanrufe</b> – der Kanal
                «Sprachanruf» in den Alarmplänen wird damit wirksam, solange Teams-Telefonie nicht aktiv ist.
                Ein Kurzname als Absender genügt nur für SMS.
              </p>
              <p>
                In der Twilio-Konsole müssen unter <i>Messaging › Geo permissions</i> und <i>Voice › Geo permissions</i>
                die Schweiz freigeschaltet sein. Ein Testkonto sendet nur an vorher verifizierte Nummern und
                stellt jeder SMS einen Hinweis voran – für den Ernstbetrieb das Konto aufwerten.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={speichern} disabled={!geaendert}>Speichern</Button>
            {<Button variant="secondary" onClick={testen} disabled={geaendert}>Test-SMS an mich</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-faint">
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
            {<Button variant="secondary" onClick={testen} disabled={geaendert}>Verbindung testen</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-faint">
            Beim Kanal «Sprachanruf» klingeln die Empfänger:innen in Teams (Handy, Desktop, Web); beim Kanal «Telefonkonferenz»
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
            {<Button variant="secondary" onClick={testen} disabled={geaendert}>Testmeldung senden</Button>}
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
            {<Button variant="secondary" onClick={testen} disabled={geaendert}>Verbindung testen</Button>}
            <TestErgebnis status={test} />
          </div>
          <p className="text-xs text-faint">
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

type Uplink = Awaited<ReturnType<typeof api.lorawanUplinks>>['uplinks'][number]

/** Wie ein Uplink ausgegangen ist – Klartext statt Statuscode */
const UPLINK_ERGEBNIS: Record<Uplink['ergebnis'], { text: string; farbe: 'green' | 'amber' | 'red' | 'slate'; rat?: string }> = {
  alarm: { text: 'Alarm ausgelöst', farbe: 'green' },
  zusammengefasst: {
    text: 'zum laufenden Alarm gezählt', farbe: 'amber',
    rat: 'Solange der Alarm dieses Knopfs läuft, löst ein weiterer Druck keinen zweiten aus. Erst nach dem Beenden in der Alarmzentrale wieder.',
  },
  status: { text: 'Statusmeldung', farbe: 'slate' },
  'unbekanntes-geraet': {
    text: 'Gerät nicht registriert', farbe: 'red',
    rat: 'Unter «Alarmknöpfe» einen Knopf mit genau dieser Seriennummer anlegen.',
  },
  'ohne-decoder': {
    text: 'ohne übersetzte Nutzlast', farbe: 'red',
    rat: 'Im Netzserver fehlt der Payload-Decoder des Geräts – ein Knopfdruck bleibt so unerkannt.',
  },
  'nicht-verstanden': {
    text: 'Format nicht verstanden', farbe: 'red',
    rat: 'Erwartet werden TTN v3, ChirpStack v4/v3 oder { serial, event, battery, lat, lng }.',
  },
  'token-falsch': {
    text: 'Token abgewiesen', farbe: 'red',
    rat: 'Der Netzserver sendet ein anderes Token als das hier hinterlegte.',
  },
}

/**
 * Die letzten Uplinks.
 *
 * Beim Einrichten ist die entscheidende Frage, ob überhaupt etwas ankommt –
 * und wenn ja, woran es scheitert. Ohne diese Liste sucht man den Fehler
 * abwechselnd im Gateway und im Portal, ohne je zu sehen, wo er liegt.
 */
function UplinkSpur({ uplinks, kopieren, kopiert }: {
  uplinks: Uplink[] | null
  kopieren: (wert: string, was: string) => void
  kopiert: string | null
}) {
  if (!uplinks) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-600 mb-1">Letzte Uplinks</div>
      {uplinks.length === 0 ? (
        <p className="text-xs text-muted">
          Noch nichts eingetroffen. Sobald der Netzserver den ersten Uplink schickt, erscheint er hier –
          auch dann, wenn er abgewiesen wird. Die Liste wird alle zehn Sekunden aufgefrischt und hält
          nur die jüngsten Meldungen; sie ist eine Hilfe beim Einrichten, kein Protokoll.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {uplinks.map((u, i) => {
            const art = UPLINK_ERGEBNIS[u.ergebnis]
            return (
              <li key={`${u.ts}-${i}`} className="py-1.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-faint tabular-nums">{formatDateTime(u.ts)}</span>
                  <Badge color={art.farbe}>{art.text}</Badge>
                  {u.knopf && <span className="text-slate-600">{u.knopf}</span>}
                  {u.geraet && (
                    <>
                      <code className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{u.geraet}</code>
                      <button
                        type="button"
                        className="text-faint hover:text-slate-600"
                        onClick={() => kopieren(u.geraet!, `uplink-${u.ts}`)}
                        aria-label="Seriennummer kopieren"
                      >
                        <Copy size={12} />
                      </button>
                      {kopiert === `uplink-${u.ts}` && <span className="text-emerald-700">kopiert</span>}
                    </>
                  )}
                  {typeof u.batteryPct === 'number' && <span className="text-faint">{u.batteryPct} %</span>}
                </div>
                {art.rat && <div className="text-alarm-600 mt-0.5">{art.rat}</div>}
                {u.felder && u.felder.length > 0 && (
                  <div className="text-faint mt-0.5">Übersetzte Felder: {u.felder.join(', ')}</div>
                )}
                {(u.fPort !== undefined || u.roh || u.batterieMv !== undefined) && (
                  // Für die Fehlersuche: Ohne Port und Rohbytes lässt sich ein
                  // falscher Messwert von aussen nicht nachrechnen.
                  <div className="text-faint mt-0.5 break-all">
                    {u.fPort !== undefined && <>Port {u.fPort}</>}
                    {u.batterieMv !== undefined && <> · {u.batterieMv} mV</>}
                    {u.roh && <> · <code>{u.roh}</code></>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
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
  const [uplinks, setUplinks] = useState<Uplink[] | null>(null)

  useEffect(() => {
    if (!lorawan.enabled) return
    api.lorawanInfo().then((i) => setInfo({ url: i.url, token: i.token })).catch((f: Error) => setFehler(f.message))
  }, [lorawan.enabled])

  // Beim Einrichten alle zehn Sekunden nachsehen: So sieht man den Uplink
  // eintreffen, während man neben dem Gerät steht.
  useEffect(() => {
    if (!lorawan.enabled) return
    const holen = () => api.lorawanUplinks().then((u) => setUplinks(u.uplinks)).catch(() => {})
    void holen()
    const takt = setInterval(holen, 10_000)
    return () => clearInterval(takt)
  }, [lorawan.enabled])

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
              <option value="chirpstack">ChirpStack (auch der im Gateway eingebaute Netzserver)</option>
              <option value="generic">Generisch (eigene Bridge, GSM-Knöpfe)</option>
            </select>
          </Field>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-600 mb-1">Überwachung der Knöpfe</div>
            <p className="text-xs text-muted mb-2.5">
              Ein Knopf, der stumm an der Wand hängt, wiegt in falscher Sicherheit. Der Server meldet
              der Administration, wenn ein Gerät kein Lebenszeichen mehr sendet oder die Batterie zur Neige geht.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Warnen ohne Signal nach (Stunden)">
                <input
                  type="number" min={1} max={720} className={inputClass}
                  value={lorawan.stilleWarnungStunden}
                  onChange={(e) => dispatch({
                    type: 'UPDATE_INTEGRATIONS',
                    integrations: { ...integ, lorawan: { ...lorawan, stilleWarnungStunden: Math.max(1, Number(e.target.value) || 1) } },
                  })}
                />
              </Field>
              <Field label="Warnen bei Batterie unter (%)">
                <input
                  type="number" min={1} max={99} className={inputClass}
                  value={lorawan.batterieWarnungProzent}
                  onChange={(e) => dispatch({
                    type: 'UPDATE_INTEGRATIONS',
                    integrations: { ...integ, lorawan: { ...lorawan, batterieWarnungProzent: Math.min(99, Math.max(1, Number(e.target.value) || 1)) } },
                  })}
                />
              </Field>
            </div>
            <p className="text-xs text-faint mt-1">
              Richten Sie die Stundenzahl nach dem Melde-Intervall der Geräte – die meisten senden alle
              12 bis 24 Stunden ein Lebenszeichen.
            </p>
          </div>
          {(
            <div className="space-y-2 text-sm">
              {info && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted w-24 shrink-0">Endpunkt</span>
                    <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 min-w-0 truncate">{info.url}</code>
                    <Button variant="ghost" onClick={() => kopieren(info.url, 'url')} aria-label="Endpunkt kopieren"><Copy size={13} /></Button>
                    {kopiert === 'url' && <span className="text-xs text-emerald-700">kopiert</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted w-24 shrink-0">Token</span>
                    <code className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 flex-1 min-w-0 truncate">{info.token ?? '– noch keines erzeugt –'}</code>
                    {info.token && <Button variant="ghost" onClick={() => kopieren(info.token!, 'token')} aria-label="Token kopieren"><Copy size={13} /></Button>}
                    {kopiert === 'token' && <span className="text-xs text-emerald-700">kopiert</span>}
                  </div>
                  <Button variant="secondary" onClick={neuesToken}><RefreshCw size={13} /> {info.token ? 'Neues Token erzeugen (altes verfällt)' : 'Token erzeugen'}</Button>
                </>
              )}
              {fehler && <div className="text-xs text-alarm-600">{fehler}</div>}
            </div>
          )}
          <UplinkSpur uplinks={uplinks} kopieren={kopieren} kopiert={kopiert} />
          <p className="text-xs text-faint">
            Im Netzserver einen Webhook auf den Endpunkt einrichten (Kopfzeile «Authorization: Bearer &lt;Token&gt;»;
            lässt das Gateway im Wert kein Leerzeichen zu, genügt das nackte Token, notfalls «?token=» in der Adresse).
            Der Server versteht TTN v3, ChirpStack v4 und v3 sowie generisches JSON. Statusmeldungen aktualisieren Batterie und
            «letztes Signal» der unter «Alarmknöpfe» registrierten Geräte (Zuordnung über die Seriennummer/DevEUI);
            ein Knopfdruck löst den dort hinterlegten stillen Alarm aus. Ohne Payload-Decoder im Netzserver
            kommt ein Uplink ohne übersetzte Nutzlast an &ndash; er wird abgewiesen und hier im Ereignisprotokoll
            vermerkt, denn ein Knopfdruck bliebe so unerkannt.
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
