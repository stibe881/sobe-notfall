import React, { useEffect, useState } from 'react'
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { BellRing, BookOpen, CheckCircle2, MapPin, Phone, Siren, Timer, User } from 'lucide-react-native'
import { StoreProvider, useStore } from './src/store'
import { ensurePermissions, onNotificationTap, setAppBadge, type PushDaten } from './src/notifications'
import { alleinarbeitAbgleichen } from './src/liveActivity'
import { alleinarbeitAndroidAbgleichen } from './src/androidTimer'
import { logoUri } from './src/api'
import type { Alarm, Scenario } from './src/types'
import { colors } from './src/ui'
import { AlarmAuswahlScreen, ContactsScreen, LoneWorkScreen, ProfileScreen, ScenarioDetailScreen, ScenariosScreen, StartScreen } from './src/screens'
import LoginScreen, { ForcePasswordChange } from './src/LoginScreen'

type Tab = 'start' | 'szenarien' | 'alleinarbeit' | 'notruf' | 'profil'

const TABS: { key: Tab; label: string; icon: typeof Siren }[] = [
  { key: 'start', label: 'Start', icon: Siren },
  { key: 'szenarien', label: 'Szenarien', icon: BookOpen },
  { key: 'alleinarbeit', label: 'Alleinarbeit', icon: Timer },
  { key: 'notruf', label: 'Notruf', icon: Phone },
  { key: 'profil', label: 'Profil', icon: User },
]

type ScenarioModus = 'entdecker' | 'empfaenger' | 'entwarnung'

/** Wie lange nach dem Antippen einer Mitteilung auf die Daten vom Server gewartet wird */
const PUSH_WARTEZEIT_MS = 20_000

function Root() {
  const { state, toasts, hydrated, refresh, uebernehmeServerLink } = useStore()
  const [tab, setTab] = useState<Tab>('start')

  useEffect(() => {
    if (hydrated) ensurePermissions()
  }, [hydrated])
  const [openScenario, setOpenScenario] = useState<Scenario | null>(null)
  // Aus der Liste geöffnet: Ich habe es entdeckt. Über einen erhaltenen Alarm
  // geöffnet: Ich wurde alarmiert – ein anderer Ablauf ohne Notruf. Nach der
  // Entwarnung: die Schritte zurück in den Normalbetrieb.
  const [openModus, setOpenModus] = useState<ScenarioModus>('entdecker')
  const [openAlarm, setOpenAlarm] = useState<Alarm | null>(null)
  const [openPhase, setOpenPhase] = useState<number | null>(null)
  // Knopf oben rechts: zuerst das Ereignis wählen
  const [alarmWahl, setAlarmWahl] = useState(false)
  function oeffneSzenario(s: Scenario, modus: ScenarioModus = 'entdecker', alarm: Alarm | null = null, phase: number | null = null) {
    setOpenScenario(s)
    setOpenModus(modus)
    setOpenAlarm(alarm)
    setOpenPhase(phase)
    setAlarmWahl(false)
  }

  // Antippen einer Push-Mitteilung: direkt zur Handlungsanweisung des Alarms
  // bzw. zu den Schritten nach der Entwarnung. Beim Kaltstart sind die Daten
  // noch nicht da – dann wird nachgeladen und gewartet.
  const [pendingPush, setPendingPush] = useState<(PushDaten & { seit: number }) | null>(null)
  useEffect(
    () =>
      onNotificationTap((daten) => {
        setPendingPush({ ...daten, seit: Date.now() })
        // Einmal sofort nachladen; danach übernimmt der regelmässige Abgleich
        refresh()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useEffect(() => {
    if (!pendingPush || !hydrated || !state.session) return
    const alarm = state.alarms.find((a) => a.id === pendingPush.alarmId) ?? null
    const scenario = state.scenarios.find((s) => s.id === (alarm?.scenarioId ?? pendingPush.scenarioId)) ?? null
    if (scenario && (alarm || pendingPush.kind !== 'ended')) {
      setPendingPush(null)
      setTab('start')
      oeffneSzenario(scenario, pendingPush.kind === 'ended' ? 'entwarnung' : 'empfaenger', alarm)
      return
    }
    if (Date.now() - pendingPush.seit > PUSH_WARTEZEIT_MS) {
      setPendingPush(null)
      setTab('start')
    }
  }, [pendingPush, hydrated, state.session, state.alarms, state.scenarios])

  const sessionUser = state.users.find((u) => u.id === state.session?.userId)
  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]

  // Laufende Alleinarbeit als Live-Aktivität auf dem Sperrbildschirm und in
  // der Dynamic Island – wird aus dem Zustand nachgeführt, egal ob der Timer
  // in der App oder im Portal gestartet wurde
  useEffect(() => {
    if (!hydrated || !state.session) return
    const eigene = state.loneWorkSessions.filter((s) => s.userId === state.currentUserId)
    void alleinarbeitAbgleichen(eigene)
    // Android: dauerhafte Countdown-Benachrichtigung statt Live-Aktivität
    void alleinarbeitAndroidAbgleichen(eigene)
  }, [hydrated, state.session, state.currentUserId, state.loneWorkSessions])

  // Zahl auf dem App-Symbol: laufende Alarme, die mich betreffen. Die
  // Push-Nachrichten tragen dieselbe Zahl – hier wird sie beim Öffnen und bei
  // jeder Zustandsänderung nachgeführt, ohne Anmeldung auf null gestellt.
  useEffect(() => {
    if (!hydrated) return
    if (!state.session) {
      void setAppBadge(0)
      return
    }
    const offene = state.alarms.filter(
      (a) => a.status === 'active' &&
        (a.triggeredByUserId === state.currentUserId || a.deliveries.some((d) => d.userId === state.currentUserId)),
    )
    void setAppBadge(offene.length)
  }, [hydrated, state.session, state.currentUserId, state.alarms])

  // Antippen der Live-Aktivität öffnet die Alleinarbeit (sobenotfall://alleinarbeit);
  // ein Verbindungs-Link aus dem Portal (sobenotfall://verbinden?server=…) trägt
  // Serveradresse und Ausweichserver ein – für die Einrichtung per QR-Code.
  useEffect(() => {
    const oeffne = (url: string | null) => {
      if (!url) return
      if (/alleinarbeit/i.test(url)) {
        setOpenScenario(null)
        setAlarmWahl(false)
        setTab('alleinarbeit')
        return
      }
      const verbinden = url.match(/verbinden\?([^#]*)/i)
      if (verbinden) {
        const lies = (schluessel: string) => {
          const treffer = verbinden[1].match(new RegExp(`(?:^|&)${schluessel}=([^&]*)`))
          return treffer ? decodeURIComponent(treffer[1]) : null
        }
        const server = lies('server')
        if (server && /^https?:\/\//.test(server)) {
          uebernehmeServerLink(server.replace(/\/+$/, ''), lies('fallback'), lies('name'))
        }
      }
    }
    Linking.getInitialURL().then(oeffne).catch(() => {})
    const abo = Linking.addEventListener('url', (e) => oeffne(e.url))
    return () => abo.remove()
  }, [uebernehmeServerLink])
  const myLocation = state.locations.find((l) => l.id === me.locationId)
  const myAlarms = state.alarms.filter(
    (a) => a.status === 'active' && (a.deliveries.some((d) => d.userId === me.id) || a.triggeredByUserId === me.id),
  )

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.dark }} />
  // Ohne gültige Anmeldung ist die App gesperrt
  if (!sessionUser) return <LoginScreen />
  // Der erzwungene Wechsel betrifft das Passwort – nach einer Microsoft-Anmeldung
  // (SSO) gibt es nichts zu wechseln, die Sperre bliebe sonst unpassierbar
  if (sessionUser.mustChangePassword && state.session?.via !== 'sso') return <ForcePasswordChange user={sessionUser} />

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {state.integrations?.organization?.logoVersion ? (
          <View style={styles.headerLogo}>
            <Image
              source={{ uri: logoUri(state.integrations.organization.logoVersion) }}
              style={{ width: 64, height: 22 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <Siren size={20} color={colors.brandLight} />
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>SOBE Notfall</Text>
            <View style={[styles.modeChip, state.mode === 'live' ? styles.modeChipLive : styles.modeChipDemo]}>
              <Text style={[styles.modeChipText, state.mode === 'demo' && { color: '#0f172a' }]}>
                {state.mode === 'live' ? 'LIVE' : 'DEMO'}
              </Text>
            </View>
          </View>
          <View style={styles.headerSubRow}>
            <Text style={styles.headerSub}>{me.firstName} {me.lastName} · </Text>
            <MapPin size={10} color="#94a3b8" />
            <Text style={styles.headerSub} numberOfLines={1}> {myLocation?.name}</Text>
          </View>
        </View>
        <Pressable
          style={styles.headerAlarmButton}
          onPress={() => { setOpenScenario(null); setAlarmWahl(true) }}
          accessibilityRole="button"
          accessibilityLabel="Alarm auslösen"
        >
          <Siren size={15} color="#fff" />
          <Text style={styles.headerAlarmText}>Alarm auslösen</Text>
        </Pressable>
      </View>

      {/* Akzentlinie in der Kundenfarbe – das Branding des verbundenen Alarmservers */}
      {state.integrations?.organization?.color ? (
        <View style={{ height: 3, backgroundColor: state.integrations.organization.color }} />
      ) : null}

      {myAlarms.length > 0 && tab !== 'start' && !openScenario && !alarmWahl && (
        <Pressable style={styles.alarmBanner} onPress={() => { setTab('start'); setOpenScenario(null) }}>
          <BellRing size={15} color="#fff" />
          <Text style={styles.alarmBannerText}>
            {myAlarms.length} aktiver Alarm{myAlarms.length > 1 ? 'e' : ''} – antippen
          </Text>
        </Pressable>
      )}

      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {openScenario ? (
          <ScenarioDetailScreen
            key={`${openScenario.id}-${openModus}-${openAlarm?.id ?? ''}-${openPhase ?? ''}`}
            scenario={openScenario}
            startModus={openModus}
            alarm={openAlarm}
            startPhase={openPhase}
            onBack={() => setOpenScenario(null)}
          />
        ) : alarmWahl ? (
          <AlarmAuswahlScreen onPick={(s) => oeffneSzenario(s, 'entdecker', null, 0)} onBack={() => setAlarmWahl(false)} />
        ) : tab === 'start' ? (
          <StartScreen onOpenScenario={(s, a, modus) => oeffneSzenario(s, modus ?? 'empfaenger', a)} />
        ) : tab === 'szenarien' ? (
          <ScenariosScreen onOpen={(s) => oeffneSzenario(s)} />
        ) : tab === 'alleinarbeit' ? (
          <LoneWorkScreen />
        ) : tab === 'notruf' ? (
          <ContactsScreen />
        ) : (
          <ProfileScreen />
        )}
      </View>

      {toasts.length > 0 && (
        <View style={styles.toastWrap} pointerEvents="none">
          {toasts.map((t) => (
            <View key={t.id} style={[styles.toast, t.kind === 'alarm' && { backgroundColor: colors.alarm }]}>
              {t.kind === 'alarm'
                ? <Siren size={15} color="#fff" />
                : <CheckCircle2 size={15} color="#34d399" />}
              <Text style={styles.toastText}>{t.message}</Text>
            </View>
          ))}
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key && !openScenario && !alarmWahl
            return (
              <Pressable key={key} style={styles.tabItem} onPress={() => { setTab(key); setOpenScenario(null); setAlarmWahl(false) }}>
                <View>
                  <Icon size={21} color={active ? colors.brand : colors.faint} />
                  {key === 'start' && myAlarms.length > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{myAlarms.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, active && { color: colors.brand, fontWeight: '700' }]}>{label}</Text>
              </Pressable>
            )
          })}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.dark,
  },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerLogo: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center' },
  headerSub: { color: '#94a3b8', fontSize: 11 },
  headerAlarmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.alarmLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerAlarmText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  alarmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.alarmLight,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  alarmBannerText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  toastWrap: { position: 'absolute', bottom: 96, left: 16, right: 16, gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  tabBarWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  tabBar: { flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8 },
  tabLabel: { fontSize: 10, color: colors.faint },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: colors.alarmLight,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  modeChip: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  modeChipLive: { backgroundColor: '#059669' },
  modeChipDemo: { backgroundColor: '#f59e0b' },
  modeChipText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
})
