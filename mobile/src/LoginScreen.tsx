import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { AlertTriangle, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react-native'
import Svg, { Rect } from 'react-native-svg'
import { useStore } from './store'
import { DEMO_PASSWORD, LIVE_INITIAL_PASSWORD } from './seed'
import { MIN_PASSWORD_LENGTH, passwordProblem } from './auth'
import { ApiError, api, serverUrl, setServerUrl, type SetupInfo } from './api'
import type { User } from './types'
import { colors } from './ui'

function Shell({ subtitle, children, showModeSwitch = false }: { subtitle: string; children: React.ReactNode; showModeSwitch?: boolean }) {
  const { state, switchMode } = useStore()
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.dark }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
        <View style={s.logo}>
          <AlertTriangle size={30} color={colors.brand} />
        </View>
        <View style={s.titleRow}>
          <Text style={s.title}>SOBE Notfall</Text>
        </View>
        <Text style={s.subtitle}>{subtitle}</Text>

        {/* Modus vor der Anmeldung wählbar – Demo und Live haben getrennte Konten */}
        {showModeSwitch && (
          <View style={s.modeSwitch}>
            {(['demo', 'live'] as const).map((m) => {
              const aktiv = state.mode === m
              return (
                <Pressable
                  key={m}
                  style={[s.modeOption, aktiv && { backgroundColor: m === 'live' ? colors.green : '#f59e0b' }]}
                  onPress={() => switchMode(m)}
                >
                  <Text style={[s.modeOptionText, aktiv && { color: m === 'live' ? '#fff' : '#0f172a' }]}>
                    {m === 'demo' ? 'DEMO' : 'LIVE'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

/** Anmeldung mit E-Mail und Passwort */
export default function LoginScreen() {
  const { state, login, loginWithToken } = useStore()
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
      .then((info) => { if (!abgebrochen) { setSetup(info); setServerErreichbar(true) } })
      .catch((f) => { if (!abgebrochen) setServerErreichbar(!(f instanceof ApiError && f.status === 0)) })
    return () => { abgebrochen = true }
  }, [state.mode, serverBearbeiten])

  // Erstinbetriebnahme: Der Server meldet, solange nur das ausgelieferte
  // Administratorkonto mit unverändertem Erstpasswort besteht
  const liveFirstRun = state.mode === 'live' && setup?.freshInstall === true

  async function submit() {
    setBusy(true)
    setError(null)
    const ergebnis = await login(email, password)
    setBusy(false)
    if (!ergebnis.ok) setError(ergebnis.error)
  }

  /**
   * Single Sign-On: Anmeldung bei Microsoft im Systembrowser-Fenster. Der
   * Server leitet danach auf sobenotfall://auth zurück und übergibt das
   * Sitzungs-Token (oder den Grund des Scheiterns).
   */
  async function microsoftAnmeldung() {
    setBusy(true)
    setError(null)
    try {
      const ergebnis = await WebBrowser.openAuthSessionAsync(
        `${serverUrl()}/api/auth/sso/start?target=app`,
        'sobenotfall://auth',
      )
      if (ergebnis.type === 'success') {
        const token = ergebnis.url.match(/[?&]token=([^&]+)/)?.[1]
        const fehler = ergebnis.url.match(/[?&]error=([^&]+)/)?.[1]
        if (token) {
          const anmeldung = await loginWithToken(decodeURIComponent(token))
          if (!anmeldung.ok) setError(anmeldung.error)
        } else {
          setError(fehler ? decodeURIComponent(fehler).replace(/\+/g, ' ') : 'Die Microsoft-Anmeldung wurde abgebrochen.')
        }
      }
    } catch {
      setError('Die Microsoft-Anmeldung konnte nicht gestartet werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell subtitle="Kompetenzzentrum Baar · Menzingen · Kloten" showModeSwitch>
      <View style={s.card}>
        <Text style={s.label}>E-Mail-Adresse</Text>
        <TextInput
          style={s.input}
          placeholder="vorname.name@sonnenberg-baar.ch"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(null) }}
        />

        <Text style={[s.label, { marginTop: 14 }]}>Passwort</Text>
        <View>
          <TextInput
            style={[s.input, { paddingRight: 46 }]}
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!show}
            textContentType="password"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null) }}
            onSubmitEditing={submit}
          />
          <Pressable style={s.eye} onPress={() => setShow((v) => !v)} hitSlop={8}>
            {show ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
          </Pressable>
        </View>

        {error && (
          <View style={s.error}>
            <AlertTriangle size={15} color="#fecaca" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <LogIn size={16} color="#fff" />
          <Text style={s.primaryText}>{busy ? 'Anmelden …' : 'Anmelden'}</Text>
        </Pressable>

        {state.mode === 'live' && setup?.sso && (
          <Pressable style={[s.microsoft, busy && { opacity: 0.6 }]} onPress={microsoftAnmeldung} disabled={busy}>
            <Svg width={15} height={15} viewBox="0 0 16 16">
              <Rect x={0} y={0} width={7.5} height={7.5} fill="#f25022" />
              <Rect x={8.5} y={0} width={7.5} height={7.5} fill="#7fba00" />
              <Rect x={0} y={8.5} width={7.5} height={7.5} fill="#00a4ef" />
              <Rect x={8.5} y={8.5} width={7.5} height={7.5} fill="#ffb900" />
            </Svg>
            <Text style={s.primaryText}>Mit Microsoft anmelden</Text>
          </Pressable>
        )}
      </View>

      {state.mode === 'demo' && (
        <View style={s.hint}>
          <Text style={s.hintTitle}>Demo-Zugänge</Text>
          <Text style={s.hintText}>Passwort für alle Demo-Konten: {DEMO_PASSWORD}</Text>
          {state.users.slice(0, 4).map((u) => (
            <Pressable key={u.id} onPress={() => { setEmail(u.email); setPassword(DEMO_PASSWORD); setError(null) }}>
              <Text style={s.hintLink}>{u.email} · {u.role}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {liveFirstRun && (
        <View style={[s.hint, { borderColor: '#065f46' }]}>
          <View style={s.hintRow}>
            <ShieldCheck size={14} color={colors.green} />
            <Text style={[s.hintTitle, { color: colors.green }]}>Erstinbetriebnahme</Text>
          </View>
          <Pressable
            onPress={() => { setEmail(setup!.adminEmail ?? ''); setPassword(LIVE_INITIAL_PASSWORD); setError(null) }}
          >
            <Text style={s.hintLink}>{setup!.adminEmail}</Text>
          </Pressable>
          <Text style={s.hintText}>
            Erstpasswort {LIVE_INITIAL_PASSWORD} – sofern beim Serverstart nichts anderes gesetzt wurde. Zum
            Übernehmen auf die Adresse tippen.
          </Text>
        </View>
      )}

      {state.mode === 'live' && serverErreichbar === false && (
        <View style={[s.hint, { borderColor: '#991b1b' }]}>
          <View style={s.hintRow}>
            <AlertTriangle size={14} color="#fecaca" />
            <Text style={[s.hintTitle, { color: '#fecaca' }]}>Alarmserver nicht erreichbar</Text>
          </View>
          <Text style={[s.hintText, { marginBottom: 0 }]}>
            Im Live-Modus kommen alle Konten vom Alarmserver. Prüfen Sie die Adresse unten und ob der Server
            läuft. Zum Arbeiten ohne Server oben auf DEMO wechseln.
          </Text>
        </View>
      )}

      {state.mode === 'live' && (
        <View style={s.hint}>
          {serverBearbeiten ? (
            <>
              <Text style={s.hintTitle}>Adresse des Alarmservers</Text>
              <TextInput
                style={[s.input, { marginBottom: 8 }]}
                value={adresse}
                onChangeText={setAdresse}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://temp-gross-ict.ch"
                placeholderTextColor="#64748b"
              />
              <Text style={s.hintText}>
                Vollständige Adresse mit https. Sie ist bereits eingetragen und muss nur
                geändert werden, wenn ein anderer Server verwendet wird.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[s.kleinerKnopf, { backgroundColor: '#334155' }]} onPress={() => setServerBearbeiten(false)}>
                  <Text style={s.kleinerKnopfText}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  style={[s.kleinerKnopf, { backgroundColor: colors.brand }]}
                  onPress={async () => { await setServerUrl(adresse); setServerBearbeiten(false); setError(null) }}
                >
                  <Text style={s.kleinerKnopfText}>Übernehmen</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => { setAdresse(serverUrl()); setServerBearbeiten(true) }}>
              <Text style={s.hintTitle}>Alarmserver</Text>
              <Text style={s.hintText}>
                {serverUrl()}
                {serverErreichbar === false ? ' – nicht erreichbar' : serverErreichbar === true ? ' – verbunden' : ''}
              </Text>
              <Text style={[s.hintText, { marginBottom: 0 }]}>Zum Ändern tippen.</Text>
            </Pressable>
          )}
        </View>
      )}

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

  async function submit() {
    const problem = passwordProblem(password)
    if (problem) return setError(problem)
    if (password !== repeat) return setError('Die beiden Passwörter stimmen nicht überein.')
    const ergebnis = await changePassword(knownPassword ?? aktuell, password)
    if (!ergebnis.ok) setError(ergebnis.error)
  }

  return (
    <Shell subtitle={`Willkommen, ${user.firstName}`}>
      <View style={s.card}>
        <View style={s.notice}>
          <ShieldCheck size={15} color="#fcd34d" />
          <Text style={s.noticeText}>Bitte vergeben Sie ein eigenes Passwort, bevor Sie fortfahren.</Text>
        </View>

        {/* Nach einem Neustart ist das Anmeldepasswort nicht mehr bekannt */}
        {!knownPassword && (
          <>
            <Text style={s.label}>Bisheriges Passwort</Text>
            <TextInput
              style={[s.input, { marginBottom: 14 }]} secureTextEntry autoCapitalize="none"
              value={aktuell} onChangeText={(t) => { setAktuell(t); setError(null) }}
            />
          </>
        )}

        <Text style={s.label}>Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen, mit Ziffer)</Text>
        <TextInput
          style={s.input} secureTextEntry autoCapitalize="none" textContentType="newPassword"
          value={password} onChangeText={(t) => { setPassword(t); setError(null) }}
        />
        <Text style={[s.label, { marginTop: 14 }]}>Passwort wiederholen</Text>
        <TextInput
          style={s.input} secureTextEntry autoCapitalize="none" textContentType="newPassword"
          value={repeat} onChangeText={(t) => { setRepeat(t); setError(null) }}
          onSubmitEditing={submit}
        />

        {error && (
          <View style={s.error}>
            <AlertTriangle size={15} color="#fecaca" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Pressable style={s.primary} onPress={submit}>
          <Text style={s.primaryText}>Passwort speichern</Text>
        </Pressable>
        <Pressable onPress={logout}>
          <Text style={s.link}>Abmelden</Text>
        </Pressable>
      </View>
    </Shell>
  )
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingBottom: 40 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  modeSwitch: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 16 },
  modeOption: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  modeOptionText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: '#94a3b8' },
  subtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 22 },
  card: { backgroundColor: '#1e293b99', borderWidth: 1, borderColor: '#1e293b', borderRadius: 18, padding: 18 },
  label: { color: '#94a3b8', fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#fff' },
  eye: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#7f1d1d55', borderWidth: 1, borderColor: '#991b1b', borderRadius: 12, padding: 11, marginTop: 14 },
  errorText: { color: '#fecaca', fontSize: 13, flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#78350f55', borderWidth: 1, borderColor: '#b45309', borderRadius: 12, padding: 11, marginBottom: 16 },
  noticeText: { color: '#fde68a', fontSize: 13, flex: 1 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  microsoft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 14 },
  hint: { backgroundColor: '#1e293b66', borderWidth: 1, borderColor: '#1e293b', borderRadius: 18, padding: 16, marginTop: 16 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  hintText: { color: '#94a3b8', fontSize: 12, marginBottom: 8, lineHeight: 17 },
  hintLink: { color: '#cbd5e1', fontSize: 12, paddingVertical: 3 },
  kleinerKnopf: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  kleinerKnopfText: { color: '#fff', fontWeight: '700', fontSize: 12 },
})
