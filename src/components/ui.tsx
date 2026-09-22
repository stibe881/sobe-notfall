import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CHANNEL_LABELS, type Channel } from '../types'

/**
 * `id` setzt einen Sprungpunkt: Andere Seiten verlinken einzelne Karten
 * (etwa der Alarmserver-Status auf dem Dashboard). `scroll-mt-4` sorgt dafür,
 * dass die Kartenüberschrift beim Anspringen nicht am Rand klebt.
 */
export function Card({ id, title, actions, children, className = '' }: { id?: string; title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div id={id} className={`bg-white rounded-xl border border-slate-200 shadow-sm scroll-mt-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function Badge({ color = 'slate', children }: { color?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>
}

export function Button({ variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles: Record<string, string> = {
    primary: 'bg-slate-800 text-white hover:bg-slate-700',
    secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
    danger: 'bg-alarm-600 text-white hover:bg-alarm-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Direkt an den Seitenkörper hängen: Wird der Dialog aus einem Bereich mit
  // eigenem Stapelkontext geöffnet (etwa der Seitenleiste mit position: sticky),
  // würde ihn der später gezeichnete Hauptbereich sonst überdecken.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} mt-4 sm:mt-10 mb-6`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, className = 'mb-3' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-slate-700">
      <span className={`w-9 h-5 rounded-full transition relative ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

/**
 * Bestätigungsdialog als Hook – Ersatz für natives confirm().
 * Verwendung: const { ask, confirmEl } = useConfirm(); ask('Löschen?', () => ...); {confirmEl} rendern.
 */
export function useConfirm() {
  const [req, setReq] = useState<{ message: string; label: string; onConfirm: () => void } | null>(null)

  function ask(message: string, onConfirm: () => void, label = 'Löschen') {
    setReq({ message, label, onConfirm })
  }

  const confirmEl = req ? (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setReq(null)}>
      <div className="toast-in bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-slate-700">{req.message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setReq(null)} autoFocus>
            Abbrechen
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              req.onConfirm()
              setReq(null)
            }}
          >
            {req.label}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return { ask, confirmEl }
}

/** Einheitliche Kennzeichnung für alles, was angelegt, aber noch nicht angebunden ist */
export const VORBEREITET = 'vorbereitet, noch nicht aktiv'

export function Vorbereitet({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ${className}`}>
      {VORBEREITET}
    </span>
  )
}

/** Kurzer Kanalname für Abzeichen; nur Push ist tatsächlich angebunden */
const KANAL_KURZ: Record<Channel, string> = {
  push: 'Push', sms: 'SMS', email: 'E-Mail', voice: 'Sprachanruf', conference: 'Telefonkonferenz', tts: 'Durchsage', teams: 'Teams',
}
export function kanalName(c: Channel): string {
  const kurz = KANAL_KURZ[c] ?? CHANNEL_LABELS[c]
  return c === 'push' ? kurz : `${kurz} (vorbereitet)`
}

/** Kurzer Text abfragen – z. B. der Hinweis, der mit der Entwarnung mitgeht */
export function usePrompt() {
  const [req, setReq] = useState<{ title: string; message: string; label: string; placeholder: string; onConfirm: (text: string) => void } | null>(null)
  const [text, setText] = useState('')

  function frage(title: string, message: string, onConfirm: (text: string) => void, label = 'Senden', placeholder = '') {
    setText('')
    setReq({ title, message, label, placeholder, onConfirm })
  }

  const promptEl = req ? (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setReq(null)}>
      <div className="toast-in bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800">{req.title}</h3>
        <p className="text-sm text-slate-600 mt-1">{req.message}</p>
        <textarea
          className={inputClass + ' mt-3'}
          rows={3}
          autoFocus
          placeholder={req.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setReq(null)}>Abbrechen</Button>
          <Button
            variant="danger"
            onClick={() => {
              req.onConfirm(text.trim())
              setReq(null)
            }}
          >
            {req.label}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return { frage, promptEl }
}

/** Relative Zeitangabe: «gerade eben», «vor 5 Min.», sonst Datum/Zeit */
export function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'gerade eben'
  if (diff < 3600_000) return `vor ${Math.floor(diff / 60_000)} Min.`
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`
  return formatDateTime(ts)
}

/**
 * Auslöse-Button mit Halte-Geste: verhindert versehentliche Alarme ohne zusätzlichen
 * Bestätigungsdialog. Gedrückt halten füllt den Button, bei 100 % wird ausgelöst.
 */
export function HoldButton({
  onTrigger, disabled = false, holdMs = 1200, children, hint = 'Gedrückt halten',
  className = '',
}: {
  onTrigger: () => void
  disabled?: boolean
  holdMs?: number
  children: React.ReactNode
  hint?: string
  className?: string
}) {
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const startTs = useRef(0)
  const fired = useRef(false)

  function stop() {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setProgress(0)
  }

  function begin() {
    if (disabled || fired.current) return
    startTs.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - startTs.current) / holdMs)
      setProgress(p)
      if (p >= 1) {
        fired.current = true
        stop()
        onTrigger()
        setTimeout(() => { fired.current = false }, 500)
      } else {
        raf.current = requestAnimationFrame(tick)
      }
    }
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => stop, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !disabled) {
          e.preventDefault()
          onTrigger()
        }
      }}
      className={`relative overflow-hidden select-none touch-none rounded-2xl bg-alarm-600 text-white font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-alarm-700 transition-none"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span className="relative z-10 flex flex-col items-center justify-center gap-0.5 px-6 py-4">
        <span className="flex items-center gap-2 text-lg">{children}</span>
        <span className="text-xs font-normal opacity-80">{progress > 0 ? 'Halten…' : hint}</span>
      </span>
    </button>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-sm text-slate-400 py-8">{children}</div>
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
