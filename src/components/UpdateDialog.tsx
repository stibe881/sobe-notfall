import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, ArrowRight, Check, CircleDashed, Download, ExternalLink, Loader2, RefreshCw,
  Server as ServerIcon, Smartphone, X,
} from 'lucide-react'
import { ApiError, api, type UpdateJob, type UpdateScope, type VersionsInfo } from '../lib/api'
import { formatRelative } from './ui'

/**
 * Aktualisierung per Knopfdruck.
 *
 * Wählbar ist nur der Umfang – die auszuführenden Schritte liegen fest auf dem
 * Server. Der Fortschritt wird während des Laufs abgefragt; nach einem
 * Serverneustart wartet der Dialog, bis der Server wieder antwortet.
 */
export default function UpdateDialog({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState<VersionsInfo | null>(null)
  const [job, setJob] = useState<UpdateJob | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [wartetAufServer, setWartetAufServer] = useState(false)
  const [offenerSchritt, setOffenerSchritt] = useState<string | null>(null)

  const laden = useCallback(async () => {
    try {
      const { version, job } = await api.updateStatus()
      setVersion(version)
      setJob(job)
      setFehler(null)
      setWartetAufServer(false)
    } catch (f) {
      if (f instanceof ApiError && f.status === 0) setWartetAufServer(true)
      else setFehler(f instanceof ApiError ? f.message : 'Status konnte nicht geladen werden.')
    } finally {
      setLaedt(false)
    }
  }, [])

  useEffect(() => {
    void laden()
  }, [laden])

  // Während eines Laufs regelmässig nachsehen; nach dem Neustart wieder verbinden
  const laeuft = job?.status === 'laufend'
  useEffect(() => {
    if (!laeuft && !wartetAufServer) return
    const timer = setInterval(() => {
      if (wartetAufServer) {
        void laden()
        return
      }
      api
        .updateJob()
        .then(({ job }) => setJob(job))
        .catch((f) => {
          // Der Server startet nach dem Update neu – das ist kein Fehler
          if (f instanceof ApiError && f.status === 0) setWartetAufServer(true)
        })
    }, 2000)
    return () => clearInterval(timer)
  }, [laeuft, wartetAufServer, laden])

  async function starten(scope: UpdateScope) {
    setFehler(null)
    try {
      const { job } = await api.startUpdate(scope)
      setJob(job)
    } catch (f) {
      setFehler(f instanceof ApiError ? f.message : 'Die Aktualisierung konnte nicht gestartet werden.')
    }
  }

  const zeigtAuswahl = !laeuft && !wartetAufServer && job?.status !== 'neustart'

  // Direkt an den Seitenkörper hängen: Der Knopf sitzt in der Seitenleiste, und
  // deren position: sticky bildet einen eigenen Stapelkontext. Ohne Portal
  // zeichnet der später folgende Hauptbereich seine Inhalte darüber.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mt-10 mb-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Download size={18} className="text-brand-600" /> Aktualisierung
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Schliessen">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {laedt && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Stand wird geprüft …
            </div>
          )}

          {fehler && (
            <div className="flex items-start gap-2 rounded-xl bg-alarm-50 border border-alarm-200 px-3 py-2.5 text-sm text-alarm-700" role="alert">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {fehler}
            </div>
          )}

          {version && <VersionsKarte version={version} onPruefen={() => { setLaedt(true); void laden() }} />}

          {zeigtAuswahl && version && (
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-slate-700">Was soll aktualisiert werden?</div>

              <Auswahl
                icon={ServerIcon}
                titel="Nur Server"
                beschreibung="Quellcode holen, Portal und Server neu bauen, Server neu starten. Dauert wenige Minuten."
                onClick={() => starten('server')}
              />

              <Auswahl
                icon={Smartphone}
                titel="Server und App"
                beschreibung={
                  version.iosMoeglich
                    ? 'Zusätzlich einen App-Build anstossen. iOS immer; Android automatisch mit, sobald der Play-Store-Schlüssel (mobile/play-service-account.json) auf dem Server liegt. Der Build läuft danach bei Expo weiter und geht von dort an TestFlight bzw. Play – der Lauf hier wartet nicht darauf.'
                    : (version.iosHinweis ?? 'Auf diesem Server nicht eingerichtet.')
                }
                gesperrt={!version.iosMoeglich}
                onClick={() => starten('server+ios')}
              />
            </div>
          )}

          {wartetAufServer && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
              <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin" />
              <div>
                Der Server startet mit dem neuen Stand neu. Sobald er wieder antwortet, geht es hier automatisch weiter.
                <div className="text-xs mt-1 text-amber-700">
                  Bleibt es länger als eine Minute hier stehen, läuft der Server nicht unter einem Dienstverwalter, der
                  ihn neu startet – siehe <code>server/README.md</code>.
                </div>
              </div>
            </div>
          )}

          {job && <JobFortschritt job={job} offenerSchritt={offenerSchritt} setOffenerSchritt={setOffenerSchritt} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function VersionsKarte({ version, onPruefen }: { version: VersionsInfo; onPruefen: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">Aktueller Stand</div>
          {/* Zuerst der Branch – der Titel des letzten Commits kann selbst
              Branch-Namen enthalten (z. B. «Merge branch …») und führt sonst
              in die Irre, auf welchem Branch der Server steht. */}
          <div className="text-sm font-medium text-slate-800 truncate">
            Branch <code className="bg-white border border-slate-200 rounded px-1">{version.branch}</code>
            {version.commitKurz && <span className="text-slate-500 font-normal"> · {version.commitKurz}</span>}
            {version.commitDatum && (
              <span className="text-slate-500 font-normal"> · {formatRelative(new Date(version.commitDatum).getTime())}</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            Letzter Commit: {version.commitTitel || 'unbekannt'}
          </div>
        </div>
        <button
          onClick={onPruefen}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 bg-white rounded-lg px-2.5 py-1.5 transition"
        >
          <RefreshCw size={13} /> Prüfen
        </button>
      </div>

      <div className="mt-3 text-sm">
        {version.hinterher > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 text-xs font-medium">
            <ArrowRight size={13} />
            {version.hinterher} neue {version.hinterher === 1 ? 'Änderung' : 'Änderungen'} verfügbar
          </span>
        ) : version.remoteVorhanden === false ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 text-xs font-medium">
            <AlertTriangle size={13} /> Diesen Branch gibt es nur auf diesem Server – es gibt nichts zu holen
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-medium">
            <Check size={13} /> Auf dem neuesten Stand
          </span>
        )}
      </div>

      {version.remoteVorhanden === false && (
        <p className="text-xs text-slate-500 mt-2.5">
          Die Aktualisierung funktioniert trotzdem: Sie überspringt das Holen und baut den vorhandenen
          Stand neu. Neue Änderungen kommen erst an, wenn der Branch auf dem Repository liegt oder der
          Server auf einen dort vorhandenen Branch wechselt.
        </p>
      )}

      {!version.neustartMoeglich && (
        <p className="text-xs text-slate-500 mt-2.5">
          Der automatische Neustart ist abgeschaltet. Nach der Aktualisierung muss der Server von Hand neu gestartet werden.
        </p>
      )}
    </div>
  )
}

function Auswahl({
  icon: Icon, titel, beschreibung, onClick, gesperrt = false,
}: {
  icon: typeof ServerIcon
  titel: string
  beschreibung: string
  onClick: () => void
  gesperrt?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={gesperrt}
      className={`w-full text-left flex items-start gap-3 rounded-xl border p-4 transition ${
        gesperrt
          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
          : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50/40'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${gesperrt ? 'bg-slate-200 text-slate-500' : 'bg-slate-800 text-white'}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 text-sm">{titel}</div>
        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{beschreibung}</div>
      </div>
      {!gesperrt && <ArrowRight size={16} className="ml-auto shrink-0 text-slate-400 mt-1" />}
    </button>
  )
}

function JobFortschritt({
  job, offenerSchritt, setOffenerSchritt,
}: {
  job: UpdateJob
  offenerSchritt: string | null
  setOffenerSchritt: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const logRef = useRef<HTMLPreElement>(null)
  const aktiverSchritt = job.schritte.find((s) => s.status === 'laufend')
  const fehlerSchritt = job.schritte.find((s) => s.status === 'fehlgeschlagen')

  // Bei einem Fehlschlag die Ausgabe von selbst zeigen – die Ursache steht
  // dort, und sie erst hinter einem Klick zu verstecken hilft niemandem
  useEffect(() => {
    if (fehlerSchritt) setOffenerSchritt((aktuell) => aktuell ?? fehlerSchritt.id)
  }, [fehlerSchritt?.id, setOffenerSchritt])

  // Ausgabe des laufenden Schritts mitscrollen
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [aktiverSchritt?.ausgabe])

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-sm">
        {job.status === 'laufend' && <Loader2 size={15} className="animate-spin text-brand-600" />}
        {job.status === 'erfolgreich' && <Check size={15} className="text-emerald-600" />}
        {job.status === 'neustart' && <RefreshCw size={15} className="text-emerald-600" />}
        {job.status === 'fehlgeschlagen' && <AlertTriangle size={15} className="text-alarm-600" />}
        <span className="font-medium text-slate-700">
          {job.status === 'laufend' && 'Aktualisierung läuft'}
          {job.status === 'erfolgreich' && 'Aktualisierung abgeschlossen'}
          {job.status === 'neustart' && 'Fertig – Server startet neu'}
          {job.status === 'fehlgeschlagen' && 'Aktualisierung fehlgeschlagen'}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {job.scope === 'server+ios' ? 'Server und iOS-App' : 'Nur Server'} · {job.gestartetVon}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {job.schritte.map((schritt) => {
          const offen = offenerSchritt === schritt.id
          const hatAusgabe = schritt.ausgabe.trim().length > 0
          return (
            <li key={schritt.id}>
              <button
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 transition disabled:hover:bg-transparent"
                disabled={!hatAusgabe}
                onClick={() => setOffenerSchritt(offen ? null : schritt.id)}
              >
                <SchrittSymbol status={schritt.status} />
                <span className={`text-sm flex-1 ${schritt.status === 'übersprungen' ? 'text-slate-400' : 'text-slate-700'}`}>
                  {schritt.titel}
                </span>
                {schritt.startedAt && schritt.finishedAt && (
                  <span className="text-xs text-slate-400">
                    {Math.max(1, Math.round((schritt.finishedAt - schritt.startedAt) / 1000))} s
                  </span>
                )}
              </button>

              {(offen || (schritt.status === 'laufend' && hatAusgabe)) && (
                <pre
                  ref={schritt.status === 'laufend' ? logRef : undefined}
                  className="mx-4 mb-3 max-h-48 overflow-auto rounded-lg bg-slate-900 text-slate-300 text-[11px] leading-relaxed p-3 whitespace-pre-wrap break-all"
                >
                  {schritt.ausgabe.trim() || '(keine Ausgabe)'}
                </pre>
              )}
            </li>
          )
        })}
      </ul>

      {job.fehler && (
        <div className="px-4 py-3 bg-alarm-50 border-t border-alarm-200 text-sm text-alarm-700">{job.fehler}</div>
      )}

      {job.hinweis && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-sm text-amber-900">{job.hinweis}</div>
      )}

      {job.buildUrl && (
        <div className="px-4 py-3 border-t border-slate-200 text-sm">
          <a
            href={job.buildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
          >
            <ExternalLink size={14} /> Build bei Expo öffnen
          </a>
          <p className="text-xs text-slate-500 mt-1">
            {job.hinweis
              ? 'Der Build läuft dort 20 bis 45 Minuten. Danach lässt er sich von Hand an TestFlight übermitteln.'
              : 'Der Build läuft dort 20 bis 45 Minuten und geht anschliessend automatisch an TestFlight, das nochmals 5 bis 15 Minuten für die Verarbeitung braucht.'}
          </p>
        </div>
      )}
    </div>
  )
}

function SchrittSymbol({ status }: { status: UpdateJob['schritte'][number]['status'] }) {
  if (status === 'laufend') return <Loader2 size={15} className="text-brand-600 animate-spin shrink-0" />
  if (status === 'erfolgreich') return <Check size={15} className="text-emerald-600 shrink-0" />
  if (status === 'fehlgeschlagen') return <AlertTriangle size={15} className="text-alarm-600 shrink-0" />
  return <CircleDashed size={15} className="text-slate-300 shrink-0" />
}
