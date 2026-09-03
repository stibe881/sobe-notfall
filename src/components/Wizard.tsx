import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import { Button } from './ui'

export interface WizardSchritt {
  titel: string
  /** Kurzer Hinweis unter dem Schritt-Titel */
  hinweis?: string
  inhalt: React.ReactNode
  /** Erst wenn gültig, lässt sich der Schritt mit «Weiter» verlassen */
  gueltig: boolean
}

/**
 * Mehrschrittiger Assistent als Vollbild-Dialog: nummerierte Schrittleiste in
 * den Markenfarben, Validierung pro Schritt, «Zurück/Weiter» und ein
 * abschliessender Erstellen-Knopf. Bereits besuchte Schritte sind über die
 * Leiste direkt anspringbar.
 */
export function Wizard({
  titel, untertitel, schritte, fertigLabel, onFertig, onClose,
}: {
  titel: string
  untertitel?: string
  schritte: WizardSchritt[]
  fertigLabel: string
  onFertig: () => void
  onClose: () => void
}) {
  const [aktuell, setAktuell] = useState(0)
  const schritt = schritte[aktuell]
  const letzter = aktuell === schritte.length - 1

  function weiter() {
    if (!schritt.gueltig) return
    if (letzter) onFertig()
    else setAktuell(aktuell + 1)
  }

  return createPortal(
    // Auf dem Telefon füllt der Assistent den Bildschirm (h-dvh berücksichtigt
    // die Browserleisten); Kopf, Schrittleiste und Fusszeile bleiben stehen,
    // nur der Inhalt scrollt. Ab sm wird daraus der zentrierte Dialog.
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-start justify-center bg-slate-900/60 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col h-dvh sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:mt-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-gradient-to-r from-brand-600 to-brand-700 px-4 sm:px-6 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold text-lg">
                <Sparkles size={18} className="opacity-80" /> {titel}
              </div>
              {untertitel && <p className="text-sm text-white/75 mt-0.5">{untertitel}</p>}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white mt-0.5" title="Schliessen">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5">
          <ol className="flex items-start">
            {schritte.map((s, i) => {
              const erledigt = i < aktuell
              const aktiv = i === aktuell
              return (
                <li key={i} className={`flex items-start ${i > 0 ? 'flex-1' : ''}`}>
                  {i > 0 && (
                    <span className={`h-0.5 flex-1 mt-4 rounded ${erledigt || aktiv ? 'bg-brand-500' : 'bg-slate-200'}`} aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => { if (erledigt) setAktuell(i) }}
                    className={`flex flex-col items-center gap-1 px-1.5 ${erledigt ? 'cursor-pointer' : 'cursor-default'}`}
                    title={s.titel}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                        aktiv
                          ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                          : erledigt
                            ? 'bg-brand-500 text-white'
                            : 'bg-white border-2 border-slate-200 text-slate-400'
                      }`}
                    >
                      {erledigt ? <Check size={16} /> : i + 1}
                    </span>
                    {/* Auf schmalen Bildschirmen trägt nur der aktive Schritt seinen Namen – so passen alle fünf ins Bild */}
                    <span className={`text-[11px] font-medium leading-tight text-center max-w-[5.5rem] ${aktiv ? 'text-brand-700' : erledigt ? 'hidden sm:block text-slate-600' : 'hidden sm:block text-slate-400'}`}>
                      {s.titel}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          <h4 className="font-semibold text-slate-800">
            Schritt {aktuell + 1} von {schritte.length}: {schritt.titel}
          </h4>
          {schritt.hinweis && <p className="text-sm text-slate-500 mt-0.5 mb-3">{schritt.hinweis}</p>}
          <div className={schritt.hinweis ? '' : 'mt-3'}>{schritt.inhalt}</div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <div className="flex items-center gap-2">
            {aktuell > 0 && (
              <Button variant="secondary" onClick={() => setAktuell(aktuell - 1)}>
                <ArrowLeft size={15} /> Zurück
              </Button>
            )}
            <Button
              onClick={weiter}
              disabled={!schritt.gueltig}
              className="!bg-brand-600 hover:!bg-brand-700"
              title={schritt.gueltig ? undefined : 'Bitte zuerst die Pflichtangaben dieses Schritts ausfüllen'}
            >
              {letzter ? <><Check size={15} /> {fertigLabel}</> : <>Weiter <ArrowRight size={15} /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Pillen-Knopf für Mehrfachauswahl im Assistenten – Markenfarbe im aktiven Zustand */
export function AuswahlChip({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
        aktiv
          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
          : 'bg-white border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700'
      }`}
    >
      {aktiv && <Check size={13} />}
      {children}
    </button>
  )
}
