import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Info, KeyRound, LogIn, Mail, Server as ServerIcon, ShieldCheck } from 'lucide-react'
import { useStore } from '../store'
import { DEMO_PASSWORD, LIVE_INITIAL_PASSWORD } from '../data/seed'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/auth'
import { ApiError, DEFAULT_SERVER_URL, api, logoUrl, serverUrl, setServerUrl, ssoStartAdresse, type SetupInfo } from '../lib/api'
import { wendeAkzentfarbeAn } from '../lib/branding'
import type { User } from '../types'

const fieldClass =
  'w-full rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 px-10 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition'

function Shell({ children, subtitle, showModeSwitch = false, logo = null }: {
  children: React.ReactNode
  subtitle: string
  showModeSwitch?: boolean
  /** Logo-Version des Kunden – zeigt das hochgeladene Logo statt des Warndreiecks */
  logo?: string | null
}) {
  const { state, dispatch } = useStore()
  const logoVersion = logo ?? state.integrations.organization?.logoVersion ?? null
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          {logoVersion ? (
            <div className="inline-flex items-center justify-center rounded-2xl bg-white p-3 mx-auto mb-4 max-w-[220px]">
              <img src={logoUrl(logoVersion)} alt="" className="h-12 w-auto max-w-full object-contain" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-brand-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={30} />
            </div>
          )}
          <h1 className="text-xl font-bold text-white">SOBE Notfall</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Modus vor der Anmeldung wählbar – Demo und Live haben getrennte Konten */}
        {showModeSwitch && (
          <div className="flex rounded-xl bg-slate-800 p-1 mb-4">
            {(['demo', 'live'] as const).map((m) => (
              <button
                key={m}
                onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
                className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition ${
                  state.mode === m
                    ? m === 'live'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'demo' ? 'Demo' : 'Live'}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Anmeldung mit E-Mail und Passwort */
export default function LoginScreen() {
  const { state, login } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serverBearbeiten, setServerBearbeiten] = useState(false)
  const [adresse, setAdresse] = useState(serverUrl())
  const [setup, setSetup] = useState<SetupInfo | null>(null)
  const [serverErreichbar, setServerErreichbar] = useState<boolean | null>(null)

  // Im Live-Modus beim Server nachfragen, ob er erreichbar und frisch eingerichtet ist
  useEffect(() => {
    if (state.mode !== 'live') return
    let abgebrochen = false
    api
      .setup()
      .then((info) => {
        if (abgebrochen) return
        setSetup(info)
        setServerErreichbar(true)
        // Branding schon auf der Anmeldemaske: Akzentfarbe des Kunden anwenden
        wendeAkzentfarbeAn(info.organizationColor ?? null)
      })
      .catch((f) => { if (!abgebrochen) setServerErreichbar(!(f instanceof ApiError && f.status === 0)) })
    return () => { abgebrochen = true }
  }, [state.mode])

  // Rücksprung einer gescheiterten Microsoft-Anmeldung: Der Server hängt den
  // Grund an die Adresse an (#ssoFehler=…)
  useEffect(() => {
    const treffer = window.location.hash.match(/[#&]ssoFehler=([^&]+)/)
    if (!treffer) return
    setError(decodeURIComponent(treffer[1]))
    window.history.replaceState(null, '', window.location.pathname + '#/')
  }, [])

  // Erstinbetriebnahme: Der Server meldet, solange nur das ausgelieferte
  // Administratorkonto mit unverändertem Erstpasswort besteht
  const liveFirstRun = state.mode === 'live' && setup?.freshInstall === true

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const ergebnis = await login(email, password)
    setBusy(false)
    if (!ergebnis.ok) setError(ergebnis.error)
  }

  // Der Name der Organisation kommt vom Server – die App bleibt für alle Kunden dieselbe
  const untertitel =
    (state.mode === 'live' ? setup?.organization : state.integrations.organization?.name) ||
    'Notfall- & Krisenmanagement'

  return (
    <Shell subtitle={untertitel} showModeSwitch logo={state.mode === 'live' ? (setup?.logoVersion ?? null) : null}>
      <form onSubmit={submit} className="rounded-2xl bg-slate-800/60 border border-slate-800 p-5 space-y-3.5">
        <label className="block">
          <span className="text-xs text-slate-400">E-Mail-Adresse</span>
          <div className="relative mt-1.5">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              autoComplete="username"
              autoFocus
              className={fieldClass}
              placeholder="vorname.name@firma.ch"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-slate-400">Passwort</span>
          <div className="relative mt-1.5">
            <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              className={fieldClass + ' pr-11'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300"
              aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-alarm-600/15 border border-alarm-600/40 px-3 py-2.5 text-sm text-alarm-200" role="alert">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 text-sm transition"
        >
          <LogIn size={16} /> {busy ? 'Anmelden …' : 'Anmelden'}
        </button>

        {state.mode === 'live' && setup?.sso && (
          <>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex-1 h-px bg-slate-700" /> oder <span className="flex-1 h-px bg-slate-700" />
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = ssoStartAdresse() }}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 text-sm transition"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <rect x="0" y="0" width="7.5" height="7.5" fill="#f25022" />
                <rect x="8.5" y="0" width="7.5" height="7.5" fill="#7fba00" />
                <rect x="0" y="8.5" width="7.5" height="7.5" fill="#00a4ef" />
                <rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#ffb900" />
              </svg>
              Mit Microsoft anmelden
            </button>
          </>
        )}
      </form>

      {state.mode === 'demo' && (
        <div className="mt-4 rounded-2xl bg-slate-800/40 border border-slate-800 p-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-2">
            <Info size={14} /> Demo-Zugänge
          </div>
          <p className="mb-2">
            Passwort für alle Demo-Konten: <code className="text-slate-200 font-semibold">{DEMO_PASSWORD}</code>
          </p>
          <ul className="space-y-1">
            {state.users.slice(0, 4).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); setError(null) }}
                  className="text-left hover:text-slate-200 transition"
                >
                  <span className="text-slate-300">{u.email}</span> · {u.role}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {liveFirstRun && (
        <div className="mt-4 rounded-2xl bg-slate-800/40 border border-emerald-800/60 p-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
            <ShieldCheck size={14} /> Erstinbetriebnahme
          </div>
          <p>
            <button
              type="button"
              onClick={() => { setEmail(setup!.adminEmail ?? ''); setPassword(LIVE_INITIAL_PASSWORD); setError(null) }}
              className="text-slate-300 hover:text-white underline underline-offset-2"
            >
              {setup!.adminEmail}
            </button>{' '}
            mit dem Erstpasswort <code className="text-slate-200 font-semibold">{LIVE_INITIAL_PASSWORD}</code> – sofern
            beim Serverstart nichts anderes gesetzt wurde. Das Passwort muss bei der ersten Anmeldung geändert werden;
            danach verschwindet dieser Hinweis.
          </p>
        </div>
      )}

      {state.mode === 'live' && serverErreichbar === false && (
        <div className="mt-4 rounded-2xl bg-brand-600/10 border border-brand-600/40 p-4 text-xs text-brand-200">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle size={14} /> Alarmserver nicht erreichbar
          </div>
          <p className="leading-relaxed">
            Im Live-Modus kommen alle Konten vom Alarmserver. Starten Sie ihn mit{' '}
            <code className="text-brand-100">cd server &amp;&amp; npm run dev</code> und prüfen Sie die Adresse unten.
            Zum Arbeiten ohne Server oben auf <span className="font-semibold">Demo</span> wechseln.
          </p>
        </div>
      )}

      {state.mode === 'live' && (
        <div className="mt-4 text-center">
          {serverBearbeiten ? (
            <div className="rounded-2xl bg-slate-800/40 border border-slate-800 p-4 text-left">
              <label className="block text-xs text-slate-400 mb-1.5">Adresse des Alarmservers</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                placeholder={DEFAULT_SERVER_URL}
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Im Schulnetz z. B. <code>http://192.168.1.42:3001</code> – die IP-Adresse des Rechners, auf dem
                der Alarmserver läuft.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setServerBearbeiten(false)}
                  className="flex-1 rounded-lg bg-slate-800 text-slate-300 py-2 text-xs font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => { setServerUrl(adresse); setServerBearbeiten(false); setError(null); location.reload() }}
                  className="flex-1 rounded-lg bg-brand-600 text-white py-2 text-xs font-semibold"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setAdresse(serverUrl()); setServerBearbeiten(true) }}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
            >
              <ServerIcon size={12} />
              Alarmserver: {serverUrl()}
              {serverErreichbar === false && <span className="text-alarm-400 font-semibold">nicht erreichbar</span>}
              {serverErreichbar === true && <span className="text-emerald-500 font-semibold">verbunden</span>}
            </button>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600 mt-5 leading-relaxed">
        Anmeldung über Microsoft Entra ID (SSO) ist vorbereitet und kann unter Integrationen aktiviert werden,
        sobald der Verzeichnisdienst angebunden ist.
      </p>
    </Shell>
  )
}

/** Erzwungene Passwortänderung nach der ersten Anmeldung */
export function ForcePasswordChange({ user }: { user: User }) {
  const { changePassword, logout, knownPassword } = useStore()
  const [aktuell, setAktuell] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== repeat) return setError('Die beiden Passwörter stimmen nicht überein.')
    const ergebnis = await changePassword(knownPassword ?? aktuell, password)
    if (!ergebnis.ok) setError(ergebnis.error)
  }

  return (
    <Shell subtitle={`Willkommen, ${user.firstName}`}>
      <form onSubmit={submit} className="rounded-2xl bg-slate-800/60 border border-slate-800 p-5 space-y-3.5">
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2.5 text-sm text-amber-200">
          <ShieldCheck size={16} className="shrink-0 mt-0.5" />
          Bitte vergeben Sie ein eigenes Passwort, bevor Sie fortfahren.
        </div>

        {/* Nach einem Neuladen ist das Anmeldepasswort nicht mehr bekannt */}
        {!knownPassword && (
          <label className="block">
            <span className="text-xs text-slate-400">Bisheriges Passwort</span>
            <input
              type="password" autoComplete="current-password"
              className={fieldClass.replace('px-10', 'px-3.5') + ' mt-1.5'}
              value={aktuell} onChange={(e) => { setAktuell(e.target.value); setError(null) }}
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs text-slate-400">Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen, mit Ziffer)</span>
          <input
            type="password" autoComplete="new-password" autoFocus
            className={fieldClass.replace('px-10', 'px-3.5') + ' mt-1.5'}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400">Passwort wiederholen</span>
          <input
            type="password" autoComplete="new-password"
            className={fieldClass.replace('px-10', 'px-3.5') + ' mt-1.5'}
            value={repeat} onChange={(e) => { setRepeat(e.target.value); setError(null) }}
          />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-alarm-600/15 border border-alarm-600/40 px-3 py-2.5 text-sm text-alarm-200" role="alert">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <button type="submit" className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 text-sm transition">
          Passwort speichern
        </button>
        <button
          type="button"
          onClick={logout}
          className="w-full text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Abmelden
        </button>
      </form>
    </Shell>
  )
}
