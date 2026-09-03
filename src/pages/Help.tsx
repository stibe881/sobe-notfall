import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink } from 'lucide-react'
import { api, serverUrl } from '../lib/api'
import { useStore } from '../store'
import { Badge, Card } from '../components/ui'

/**
 * Handbücher – ausgeliefert vom Alarmserver unter /handbuecher aus dem
 * Ordner docs/ der installierten Version. Damit zeigen sie immer den Stand,
 * der tatsächlich läuft: Jede Aktualisierung bringt die passenden Handbücher
 * mit. Die Liste kommt vom Server, künftige Handbücher erscheinen also ohne
 * Portal-Anpassung; für die bekannten gibt es Zielgruppe und Kurzbeschrieb.
 */

const BEKANNT: Record<string, { nr: number; titel: string; fuer: string; beschreibung: string }> = {
  'handbuch-1-administration.html': {
    nr: 1,
    titel: 'Administration',
    fuer: 'Schulleitung und Systemverantwortliche',
    beschreibung: 'Das System einrichten und aktuell halten: Szenarien, Benutzer, Gruppen, Alarmpläne, Integrationen, Aktualisierung.',
  },
  'handbuch-2-krisenstab.html': {
    nr: 2,
    titel: 'Krisenstab',
    fuer: 'Krisenstabsmitglieder',
    beschreibung: 'Führen im Ereignis: Alarm auslösen, Alarmzentrale, Lagemeldungen, Entwarnung, Krisenteam aufbieten.',
  },
  'handbuch-3-mitarbeitende.html': {
    nr: 3,
    titel: 'Mitarbeitende',
    fuer: 'alle Mitarbeitenden',
    beschreibung: 'Die App im Alltag und im Ernstfall: Alarme empfangen und quittieren, Szenarien, SOS, Alleinarbeits-Timer, Notruf.',
  },
  'handbuch-4-installation.html': {
    nr: 4,
    titel: 'Installation & Konfiguration',
    fuer: 'Systemverantwortliche und technischen Betrieb',
    beschreibung: 'Vom leeren Server zum geprobten Failover: Installation, Einrichtung, Integrationen, App-Verteilung, Redundanz, Sicherung.',
  },
}

export default function Help() {
  const { state } = useStore()
  const [dateien, setDateien] = useState<{ datei: string; titel: string }[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (state.mode !== 'live') return
    api.handbuecher()
      .then(({ handbuecher }) => setDateien(handbuecher))
      .catch((f: Error) => setFehler(f.message))
  }, [state.mode])

  // Im Demo-Modus (und solange die Liste lädt) die bekannten Handbücher zeigen
  const liste = (dateien && dateien.length > 0 ? dateien : Object.keys(BEKANNT).map((datei) => ({ datei, titel: BEKANNT[datei].titel })))
    .map((h) => ({ ...h, info: BEKANNT[h.datei] as (typeof BEKANNT)[string] | undefined }))
    .sort((a, b) => (a.info?.nr ?? 99) - (b.info?.nr ?? 99) || a.datei.localeCompare(b.datei))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Handbücher</h1>
        <p className="text-sm text-slate-500">
          Die Benutzerhandbücher zur installierten Version – je eines pro Rolle. Sie öffnen im Browser
          und lassen sich von dort drucken oder als PDF sichern.
        </p>
      </div>

      {fehler && <p className="text-sm text-alarm-600">{fehler}</p>}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {liste.map(({ datei, titel, info }) => (
          <Card key={datei}>
            <a
              href={`${serverUrl()}/handbuecher/${datei}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 group-hover:text-brand-600 transition">
                      {info ? `Handbuch ${info.nr} – ${info.titel}` : titel}
                    </span>
                    <ExternalLink size={13} className="text-slate-400 group-hover:text-brand-600 transition" />
                  </div>
                  {info && (
                    <div className="mt-1">
                      <Badge>{`Für ${info.fuer}`}</Badge>
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-2">
                    {info?.beschreibung ?? 'Handbuch öffnen.'}
                  </p>
                </div>
              </div>
            </a>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400 max-w-2xl">
        Die Handbücher werden vom Alarmserver mit ausgeliefert und mit jeder Aktualisierung
        automatisch nachgeführt – sie passen immer zur Version, die gerade läuft.
        {state.mode === 'demo' && ' Im Demo-Modus öffnen die Links den Bestand des eingestellten Alarmservers.'}
      </p>
    </div>
  )
}
