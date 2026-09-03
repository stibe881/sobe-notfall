import React, { useEffect, useState } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import {
  BellRing, BookOpen, Check, CheckCircle2, ChevronLeft, Clock, ExternalLink, KeyRound, LogOut, MapPin, Phone, Play,
  Search as SearchIcon, Scale, ShieldAlert, ShieldCheck, Siren, Timer, X,
} from 'lucide-react-native'
import { alleinarbeitEmpfaenger, createAlarm, resolveRecipients, uid, useStore } from './store'
import { ScenarioIcon } from './ScenarioIcon'
import Constants from 'expo-constants'
import { cancelScheduled, ensurePermissions, scheduleAt } from './notifications'
import { androidCountdownVerfuegbar } from './androidTimer'
import { serverUrl } from './api'
import { LONE_WORK_DEFAULT_GROUPS, type Alarm, type LoneWorkSession, type Scenario, type User } from './types'
import { Badge, Card, HoldButton, colors, formatDuration, formatRelative } from './ui'
import { MIN_PASSWORD_LENGTH, passwordProblem } from './auth'
import { activeScenarios, allClearStepsOf, responseStepsFor, responseStepsOf } from './scenarios'

// ---------- Start: Alarme + SOS ----------

type Dispatch = ReturnType<typeof useStore>['dispatch']

/** Text abfragen – iOS kennt Alert.prompt, Android bekommt eine Bestätigung ohne Text */
function frageText(titel: string, text: string, knopf: string, weiter: (eingabe: string) => void) {
  if (Platform.OS === 'ios') {
    Alert.prompt(titel, text, [{ text: 'Abbrechen', style: 'cancel' }, { text: knopf, onPress: (e?: string) => weiter((e ?? '').trim()) }], 'plain-text')
  } else {
    Alert.alert(titel, text, [{ text: 'Abbrechen', style: 'cancel' }, { text: knopf, onPress: () => weiter('') }])
  }
}

/** Auslösende Person meldet einen Irrtum – der Krisenstab entwarnt */
export function fehlalarmMelden(dispatch: Dispatch, alarmId: string) {
  frageText(
    'Fehlalarm melden',
    'Alle Empfänger und der Krisenstab erhalten Ihre Meldung; die Entwarnung gibt der Krisenstab. Kurze Begründung (optional):',
    'Melden',
    (text) => dispatch({ type: 'ALARM_UPDATE', alarmId, message: text, kind: 'fehlalarm' }),
  )
}

/** Führung beendet den Alarm – mit einem Satz, der in der Entwarnung mitgeht */
export function entwarnungGeben(dispatch: Dispatch, alarmId: string) {
  frageText(
    'Entwarnung geben',
    'Der Alarm wird beendet und alle Empfänger erhalten die Entwarnung. Hinweis für die Empfänger (optional), z. B. Rückkehr ab 10:30 über den Haupteingang:',
    'Entwarnung senden',
    (text) => dispatch({ type: 'END_ALARM', alarmId, note: text }),
  )
}

/** Live: Wie viele wurden benachrichtigt, wie viele kommen, wie viele sind nicht verfügbar */
export function rueckmeldungen(alarm: Alarm): { benachrichtigt: number; kommen: number; nichtVerfuegbar: number; offen: number } {
  const personen = new Map<string, 'none' | 'acknowledged' | 'declined'>()
  for (const d of alarm.deliveries) {
    const bisher = personen.get(d.userId)
    if (!bisher || bisher === 'none') personen.set(d.userId, d.ack)
  }
  const werte = [...personen.values()]
  const kommen = werte.filter((a) => a === 'acknowledged').length
  const nichtVerfuegbar = werte.filter((a) => a === 'declined').length
  return { benachrichtigt: werte.length, kommen, nichtVerfuegbar, offen: werte.length - kommen - nichtVerfuegbar }
}

function Rueckmeldestand({ alarm }: { alarm: Alarm }) {
  const r = rueckmeldungen(alarm)
  return (
    <View style={[styles.row, { flexWrap: 'wrap', gap: 10, marginTop: 6 }]}>
      <Text style={styles.faint}><Text style={{ fontWeight: '700', color: colors.text }}>{r.benachrichtigt}</Text> benachrichtigt</Text>
      <Text style={[styles.faint, { color: colors.green }]}><Text style={{ fontWeight: '700' }}>{r.kommen}</Text> kommen</Text>
      <Text style={[styles.faint, { color: colors.muted }]}><Text style={{ fontWeight: '700' }}>{r.nichtVerfuegbar}</Text> nicht verfügbar</Text>
      <Text style={styles.faint}><Text style={{ fontWeight: '700' }}>{r.offen}</Text> offen</Text>
    </View>
  )
}

/** Meldungen zum laufenden Alarm, neueste zuoberst */
function Lagemeldungen({ alarm }: { alarm: Alarm }) {
  const updates = [...(alarm.updates ?? [])].reverse()
  if (updates.length === 0) return null
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      {updates.map((u, i) => (
        <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: u.kind === 'fehlalarm' ? colors.amber : colors.violet, paddingLeft: 8 }}>
          <Text style={[styles.faint, { color: u.kind === 'fehlalarm' ? colors.amber : colors.violet, fontWeight: '700' }]}>
            {u.kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : u.kind === 'meldung' ? 'Weitere Meldung' : 'Lagemeldung'} · {formatRelative(u.ts)}
          </Text>
          <Text style={[styles.body, { marginTop: 0 }]}>{u.message}</Text>
        </View>
      ))}
    </View>
  )
}

/** Wie lange eine Entwarnung auf dem Start-Tab stehen bleibt */
const ENTWARNUNG_SICHTBAR_MS = 12 * 60 * 60_000

export function StartScreen({ onOpenScenario }: { onOpenScenario: (s: Scenario, alarm: Alarm, modus?: 'empfaenger' | 'entwarnung') => void }) {
  const { state, dispatch } = useStore()
  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  const mySos = state.alarms.filter((a) => a.status === 'active' && a.triggeredByUserId === me.id)
  const myAlarms = state.alarms.filter(
    (a) => a.status === 'active' && a.triggeredByUserId !== me.id && a.deliveries.some((d) => d.userId === me.id),
  )
  // Beendete Alarme der letzten Stunden: Die Entwarnung bringt eigene Schritte mit
  const entwarnungen = state.alarms
    .filter(
      (a) => a.status === 'ended' && (a.endedAt ?? 0) > Date.now() - ENTWARNUNG_SICHTBAR_MS &&
        (a.triggeredByUserId === me.id || a.deliveries.some((d) => d.userId === me.id)),
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 3)
  const hotline = state.integrations?.hotline

  function sos() {
    const location = state.locations.find((l) => l.id === me.locationId)
    dispatch({
      type: 'TRIGGER_ALARM',
      alarm: createAlarm(state.users, {
        scenarioId: 'sc-medizin',
        message: `SOS-Alarm von ${me.firstName} ${me.lastName} (App) – Standort: ${location?.name ?? 'unbekannt'}`,
        silent: false,
        requireAck: true,
        channels: ['push', 'sms', 'voice'],
        groupIds: ['gr-ersthelfer', 'gr-sicherheit'],
        locationIds: [me.locationId],
        triggeredByUserId: me.id,
        triggeredVia: 'app',
        escalation: [{ afterMinutes: 3, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true }],
      }),
    })
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {hotline?.enabled && hotline.number.trim() !== '' && (
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`tel:${hotline.number.replace(/\s/g, '')}`)}>
          <Phone size={18} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Interne Notfallnummer</Text>
            <Text style={styles.faint}>Alarmauslösung per Anruf</Text>
          </View>
          <Text style={styles.contactNumber}>{hotline.number}</Text>
        </Pressable>
      )}
      {mySos.map((a) => {
        const delivered = a.deliveries.filter((d) => d.status === 'delivered').length
        const helpers = [...new Set(a.deliveries.filter((d) => d.ack === 'acknowledged').map((d) => d.userId))]
          .map((id) => state.users.find((u) => u.id === id))
          .filter(Boolean)
        const istTimer = a.triggeredVia === 'timer'
        const istSos = a.message.startsWith('SOS-Alarm') || istTimer
        const istFuehrung = me.role !== 'mitarbeiter'
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        return (
          <Card key={a.id} style={{ borderColor: colors.alarmLight, borderWidth: 2 }}>
            <View style={styles.row}>
              <Siren size={18} color={colors.alarm} />
              <Text style={[styles.cardTitle, { color: colors.alarm, flex: 1 }]}>
                {istTimer ? 'Alleinarbeits-Timer abgelaufen – Alarm aktiv' : istSos ? 'Ihr SOS-Alarm ist aktiv' : `Ihr Alarm ist aktiv${scenario ? ` · ${scenario.title}` : ''}`}
              </Text>
              {a.drill && <Badge label="ÜBUNG" color="amber" />}
              <Text style={styles.faint}>{formatRelative(a.triggeredAt)}</Text>
            </View>
            <Lagemeldungen alarm={a} />
            <Text style={styles.body}>{delivered}/{a.deliveries.length} Benachrichtigungen zugestellt</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${a.deliveries.length ? (delivered / a.deliveries.length) * 100 : 0}%` }]} />
            </View>
            {helpers.length > 0 ? (
              <View style={[styles.row, { marginTop: 8 }]}>
                <CheckCircle2 size={15} color={colors.green} />
                <Text style={{ color: colors.green, fontWeight: '600', flex: 1 }}>
                  {helpers.map((u) => `${u!.firstName} ${u!.lastName}`).join(', ')} {helpers.length === 1 ? 'kommt' : 'kommen'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.muted, { marginTop: 8 }]}>Warten auf Rückmeldung der Einsatzkräfte…</Text>
            )}
            {istSos ? (
              <Pressable
                style={[styles.outlineButton, istTimer && { backgroundColor: colors.green, borderColor: colors.green }]}
                onPress={() =>
                  Alert.alert('Entwarnung', istTimer ? 'Ihnen geht es gut und der Alarm soll beendet werden? Alle Alarmierten erhalten die Entwarnung.' : 'Entwarnung geben und den SOS-Alarm beenden?', [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Entwarnung geben', style: 'destructive', onPress: () => dispatch({ type: 'END_ALARM', alarmId: a.id, note: istTimer ? 'Mir geht es gut – der Timer wurde nicht rechtzeitig verlängert.' : undefined }) },
                  ])
                }
              >
                <Text style={[styles.outlineButtonText, istTimer && { color: '#fff' }]}>Entwarnung – mir geht es gut</Text>
              </Pressable>
            ) : istFuehrung ? (
              <Pressable style={styles.outlineButton} onPress={() => entwarnungGeben(dispatch, a.id)}>
                <Text style={styles.outlineButtonText}>Entwarnung geben</Text>
              </Pressable>
            ) : (a.updates ?? []).some((u) => u.kind === 'fehlalarm') ? (
              <Text style={[styles.faint, { marginTop: 10, textAlign: 'center' }]}>Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung.</Text>
            ) : (
              <Pressable style={styles.outlineButton} onPress={() => fehlalarmMelden(dispatch, a.id)}>
                <Text style={styles.outlineButtonText}>Fehlalarm melden</Text>
              </Pressable>
            )}
          </Card>
        )
      })}

      {myAlarms.map((a) => {
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        const myAck = a.deliveries.find((d) => d.userId === me.id)?.ack ?? 'none'
        return (
          <Card key={a.id} style={{ borderColor: a.silent ? colors.violet : colors.alarmLight, borderWidth: 2 }}>
            <View style={styles.row}>
              <BellRing size={18} color={a.silent ? colors.violet : colors.alarm} />
              <Text style={[styles.cardTitle, { flex: 1 }]}>{scenario?.title}</Text>
              {a.drill && <Badge label="ÜBUNG" color="amber" />}
              {a.silent && <Badge label="still" color="violet" />}
            </View>
            <Text style={styles.body}>{a.message}</Text>
            <Rueckmeldestand alarm={a} />
            <Lagemeldungen alarm={a} />
            {scenario && (
              <Pressable style={styles.darkButton} onPress={() => onOpenScenario(scenario, a)}>
                <Text style={styles.darkButtonText}>Was jetzt zu tun ist</Text>
              </Pressable>
            )}
            {a.requireAck && myAck === 'none' && (
              <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
                <Pressable
                  style={[styles.ackButton, { backgroundColor: colors.green }]}
                  onPress={() => dispatch({ type: 'ACK_ALARM', alarmId: a.id, userId: me.id, ack: 'acknowledged' })}
                >
                  <Check size={15} color="#fff" />
                  <Text style={styles.ackButtonText}>Ich komme</Text>
                </Pressable>
                <Pressable
                  style={[styles.ackButton, { backgroundColor: '#cbd5e1' }]}
                  onPress={() => dispatch({ type: 'ACK_ALARM', alarmId: a.id, userId: me.id, ack: 'declined' })}
                >
                  <X size={15} color={colors.text} />
                  <Text style={[styles.ackButtonText, { color: colors.text }]}>Nicht verfügbar</Text>
                </Pressable>
              </View>
            )}
            {a.requireAck && myAck !== 'none' && (
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                <Badge
                  label={myAck === 'acknowledged' ? 'quittiert – Sie nehmen teil' : 'als nicht verfügbar gemeldet'}
                  color={myAck === 'acknowledged' ? 'green' : 'slate'}
                />
              </View>
            )}
            {me.role !== 'mitarbeiter' && (
              <Pressable style={styles.outlineButton} onPress={() => entwarnungGeben(dispatch, a.id)}>
                <Text style={styles.outlineButtonText}>Entwarnung geben</Text>
              </Pressable>
            )}
          </Card>
        )
      })}

      {myAlarms.length === 0 && mySos.length === 0 && (
        <Card style={{ alignItems: 'center' }}>
          <CheckCircle2 size={28} color={colors.green} />
          <Text style={[styles.cardTitle, { marginTop: 6 }]}>Keine aktiven Alarme</Text>
          <Text style={styles.faint}>Sie werden bei einem Ereignis sofort benachrichtigt.</Text>
        </Card>
      )}

      {entwarnungen.map((a) => {
        const scenario = state.scenarios.find((s) => s.id === a.scenarioId)
        return (
          <Card key={a.id} style={{ borderColor: colors.green, borderWidth: 2 }}>
            <View style={styles.row}>
              <ShieldCheck size={18} color={colors.green} />
              <Text style={[styles.cardTitle, { flex: 1 }]}>Entwarnung · {scenario?.title ?? 'Alarm'}</Text>
              <Text style={styles.faint}>{formatRelative(a.endedAt ?? a.triggeredAt)}</Text>
            </View>
            <Text style={styles.body}>Der Alarm ist beendet. Für die Rückkehr zum Normalbetrieb gelten eigene Schritte.</Text>
            {scenario && (
              <Pressable style={[styles.darkButton, { backgroundColor: colors.green }]} onPress={() => onOpenScenario(scenario, a, 'entwarnung')}>
                <Text style={styles.darkButtonText}>Nächste Schritte</Text>
              </Pressable>
            )}
          </Card>
        )
      })}

      {mySos.length === 0 && (
        <>
          <HoldButton label="SOS" onTrigger={sos} />
          <Text style={[styles.faint, { textAlign: 'center' }]}>
            Alarmiert sofort Schulsanität und Hausdienst an Ihrem Standort – mit automatischer Eskalation.
          </Text>
        </>
      )}

    </ScrollView>
  )
}

// ---------- Alarm auslösen: Ereignis wählen ----------

/**
 * Einstieg über den Knopf oben rechts: Welches Ereignis? Danach geht es direkt
 * in die Phase «Alarmieren» des gewählten Szenarios – Notruf zuerst, dann die
 * interne Alarmierung.
 */
export function AlarmAuswahlScreen({ onPick, onBack }: { onPick: (s: Scenario) => void; onBack: () => void }) {
  const { state } = useStore()
  const rang = { hoch: 0, mittel: 1, tief: 2 } as const
  const szenarien = [...activeScenarios(state.scenarios)].sort((a, b) => rang[a.priority] - rang[b.priority])

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={[styles.row, { marginBottom: 4 }]}>
        <ChevronLeft size={18} color={colors.muted} />
        <Text style={styles.muted}>Zurück</Text>
      </Pressable>
      <View style={[styles.row, { marginBottom: 4 }]}>
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center' }}>
          <Siren size={24} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Alarm auslösen</Text>
          <Text style={styles.faint}>Welches Ereignis liegt vor?</Text>
        </View>
      </View>
      <View style={styles.empfaengerHinweis}>
        <Text style={styles.empfaengerHinweisText}>
          Bei Lebensgefahr zuerst der Notruf – die passende Nummer steht im nächsten Schritt. Danach halten Sie den roten Knopf gedrückt, um intern zu alarmieren.
        </Text>
      </View>
      <View style={styles.grid}>
        {szenarien.map((s) => (
          <Pressable key={s.id} style={styles.tile} onPress={() => onPick(s)}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <ScenarioIcon name={s.icon} size={22} color={s.priority === 'hoch' ? colors.alarm : colors.muted} />
              {s.silentDefault && <Badge label="still" color="violet" />}
            </View>
            <Text style={styles.tileTitle}>{s.title}</Text>
            <Text style={styles.faint}>{s.category}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.faint, { textAlign: 'center' }]}>
        Persönlicher Notfall ohne Szenario: SOS auf dem Start-Tab alarmiert Schulsanität und Hausdienst.
      </Text>
    </ScrollView>
  )
}

// ---------- Szenarien ----------

export function ScenariosScreen({ onOpen }: { onOpen: (s: Scenario) => void }) {
  const { state } = useStore()
  const [search, setSearch] = useState('')
  const filtered = activeScenarios(state.scenarios).filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.searchBox}>
        <SearchIcon size={16} color={colors.faint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Szenario suchen…"
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.grid}>
        {filtered.map((s) => (
          <Pressable key={s.id} style={styles.tile} onPress={() => onOpen(s)}>
            <ScenarioIcon name={s.icon} size={22} color={s.priority === 'hoch' ? colors.alarm : colors.muted} />
            <Text style={styles.tileTitle}>{s.title}</Text>
            <Text style={styles.faint}>{s.category}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

type ScenarioModus = 'entdecker' | 'empfaenger' | 'entwarnung'

export function ScenarioDetailScreen({
  scenario, onBack, startModus = 'entdecker', alarm = null, startPhase = null,
}: {
  scenario: Scenario
  onBack: () => void
  startModus?: ScenarioModus
  alarm?: Alarm | null
  /** Direkt in eine Phase springen, z. B. 0 = Alarmieren über den Knopf im Header */
  startPhase?: number | null
}) {
  const { state, dispatch } = useStore()
  const [modus, setModus] = useState<ScenarioModus>(startModus)
  const [phase, setPhase] = useState<number | null>(startPhase)
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})
  const [checkedList, setCheckedList] = useState<Record<number, boolean>>({})
  const [notifiedUserIds, setNotifiedUserIds] = useState<string[]>([])

  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  const [alarmLocationIds, setAlarmLocationIds] = useState<string[]>([me.locationId])
  const contacts = state.contacts.filter((c) => scenario.contactIds.includes(c.id))
  // Hinweise zum Notruf gehören in die Phase «Alarmieren» – deshalb stehen sie
  // nicht mehr in den Sofortmassnahmen.
  const callGuidance = scenario.callGuidance ?? []
  const responsibleGroups = state.groups.filter((g) => scenario.responsibleGroupIds.includes(g.id))
  const alarmGroupIds = responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.id) : ['gr-alle']
  const alarmRecipientCount = resolveRecipients(state.users, alarmGroupIds, alarmLocationIds).length
  const crisisGroups = state.groups.filter((g) => g.isCrisisTeam)
  const crisisMembers = state.users.filter((u) => u.id !== me.id && u.groupIds.some((g) => crisisGroups.some((cg) => cg.id === g)))

  const myScenarioAlarm = state.alarms.find(
    (a) => a.status === 'active' && a.scenarioId === scenario.id && a.triggeredByUserId === me.id && !a.message.startsWith('Info an') && !a.message.startsWith('Krisenteam-Aufgebot'),
  )
  // Läuft für dieses Ereignis bereits ein Alarm von jemand anderem am selben
  // Standort? Dann ist eine zweite Auslösung meist überflüssig.
  const fremderAlarm = state.alarms.find(
    (a) =>
      a.status === 'active' && a.scenarioId === scenario.id && a.triggeredByUserId !== me.id &&
      !a.message.startsWith('Info an') && !a.message.startsWith('Krisenteam-Aufgebot') &&
      (a.locationIds.length === 0 || alarmLocationIds.length === 0 || a.locationIds.some((id) => alarmLocationIds.includes(id))),
  )
  const fremderAusloeser = fremderAlarm ? state.users.find((u) => u.id === fremderAlarm.triggeredByUserId) : undefined
  const myCrisisAlarm = state.alarms.find(
    (a) => a.status === 'active' && a.triggeredByUserId === me.id && a.message.startsWith('Krisenteam-Aufgebot'),
  )

  const PHASES = [
    { title: 'Alarmieren', hint: 'Notruf & interne Alarmierung' },
    { title: 'Sofortmassnahmen', hint: `${scenario.instructions.length} Schritte` },
    { title: 'Informieren', hint: 'Krisenteam aufbieten & benachrichtigen' },
    { title: 'Weitere Massnahmen', hint: 'Nachbearbeitung & Checkliste' },
  ]

  function triggerGroupAlarm() {
    const locationNames = alarmLocationIds
      .map((id) => state.locations.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join(', ')
    dispatch({
      type: 'TRIGGER_ALARM',
      alarm: createAlarm(state.users, {
        scenarioId: scenario.id,
        message: `${scenario.title} – Standort ${locationNames || 'alle Standorte'}. Ausgelöst von ${me.firstName} ${me.lastName}, bitte Handlungsanweisungen in der App befolgen.`,
        silent: scenario.silentDefault,
        requireAck: true,
        channels: scenario.defaultChannels.length > 0 ? scenario.defaultChannels : ['push', 'sms'],
        groupIds: alarmGroupIds,
        locationIds: alarmLocationIds,
        triggeredByUserId: me.id,
        triggeredVia: 'app',
        escalation: [{ afterMinutes: 5, channels: ['voice'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: false }],
      }),
    })
  }

  function triggerCrisisTeam() {
    dispatch({
      type: 'TRIGGER_ALARM',
      alarm: createAlarm(state.users, {
        scenarioId: scenario.id,
        message: `Krisenteam-Aufgebot (${scenario.title}) durch ${me.firstName} ${me.lastName} – bitte quittieren.`,
        silent: false,
        requireAck: true,
        channels: ['push', 'sms', 'voice'],
        groupIds: crisisGroups.map((g) => g.id),
        locationIds: [],
        triggeredByUserId: me.id,
        triggeredVia: 'app',
      }),
    })
  }

  function notifyMember(userId: string) {
    const user = state.users.find((u) => u.id === userId)
    dispatch({
      type: 'TRIGGER_ALARM',
      alarm: createAlarm(state.users, {
        scenarioId: scenario.id,
        message: `Info an ${user?.firstName} ${user?.lastName}: ${scenario.title} – bitte bei ${me.firstName} ${me.lastName} melden.`,
        silent: true,
        requireAck: true,
        channels: ['push', 'sms'],
        groupIds: [],
        locationIds: [],
        triggeredByUserId: me.id,
        triggeredVia: 'app',
        recipientUserIds: [userId],
      }),
    })
    setNotifiedUserIds((ids) => [...ids, userId])
  }

  function AlarmStatus({ alarm }: { alarm: NonNullable<typeof myScenarioAlarm> }) {
    const delivered = alarm.deliveries.filter((d) => d.status === 'delivered').length
    const acked = [...new Set(alarm.deliveries.filter((d) => d.ack === 'acknowledged').map((d) => d.userId))].length
    return (
      <View style={{ borderWidth: 2, borderColor: colors.green, backgroundColor: colors.greenBg, borderRadius: 14, padding: 13 }}>
        <View style={styles.row}>
          <CheckCircle2 size={16} color={colors.green} />
          <Text style={{ color: '#065f46', fontWeight: '700', fontSize: 14 }}>
            Alarm ausgelöst <Text style={{ fontWeight: '400' }}>{formatRelative(alarm.triggeredAt)}</Text>
          </Text>
        </View>
        <Text style={{ color: '#047857', fontSize: 13, marginTop: 4 }}>
          {delivered}/{alarm.deliveries.length} zugestellt · {acked} quittiert – Live-Status auf dem Start-Tab.
        </Text>
        {(alarm.updates ?? []).some((u) => u.kind === 'fehlalarm') ? (
          <Text style={[styles.faint, { marginTop: 8 }]}>Fehlalarm gemeldet – der Krisenstab gibt die Entwarnung.</Text>
        ) : (
          <Pressable style={[styles.outlineButton, { marginTop: 8 }]} onPress={() => fehlalarmMelden(dispatch, alarm.id)}>
            <Text style={styles.outlineButtonText}>Fehlalarm melden</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const header = (
    <View style={[styles.row, { marginBottom: 12 }]}>
      <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center' }}>
        <ScenarioIcon name={scenario.icon} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{scenario.title}</Text>
        {phase !== null && <Text style={styles.faint}>Phase {phase + 1} von {PHASES.length} · {PHASES[phase].title}</Text>}
      </View>
    </View>
  )

  // ---------- Nach der Entwarnung ----------
  if (modus === 'entwarnung') {
    const beendeterAlarm =
      (alarm && state.alarms.find((a) => a.id === alarm.id)) ??
      [...state.alarms]
        .filter((a) => a.status === 'ended' && a.scenarioId === scenario.id)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0] ??
      null
    return (
      <EntwarnungScreen
        scenario={scenario}
        alarm={beendeterAlarm}
        onBack={onBack}
        onSzenario={() => { setModus('entdecker'); setPhase(null) }}
      />
    )
  }

  // ---------- Empfängerweg ----------
  if (modus === 'empfaenger') {
    // Immer den aktuellen Stand aus dem Zustand nehmen: Das übergebene Objekt
    // veraltet, sobald quittiert wird
    const aktiverAlarm =
      (alarm && state.alarms.find((a) => a.id === alarm.id)) ??
      state.alarms.find(
        (a) => a.status === 'active' && a.scenarioId === scenario.id && a.deliveries.some((d) => d.userId === me.id),
      ) ??
      null
    return (
      <EmpfaengerScreen
        scenario={scenario}
        alarm={aktiverAlarm}
        onBack={onBack}
        onEntdecker={() => { setModus('entdecker'); setPhase(null) }}
      />
    )
  }

  if (phase === null) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Pressable onPress={onBack} style={[styles.row, { marginBottom: 4 }]}>
          <ChevronLeft size={18} color={colors.muted} />
          <Text style={styles.muted}>Zurück</Text>
        </Pressable>
        {header}
        {PHASES.map((p, i) => (
          <Pressable
            key={p.title}
            style={[styles.row, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15 }]}
            onPress={() => setPhase(i)}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.faint}>{p.hint}</Text>
            </View>
            <ChevronLeft size={16} color={colors.faint} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        ))}
        <Pressable style={[styles.bigButton, { backgroundColor: colors.dark }]} onPress={() => setPhase(0)}>
          <Play size={16} color="#fff" />
          <Text style={styles.bigButtonText}>Geführt starten – ich habe es entdeckt</Text>
        </Pressable>
        {responseStepsOf(scenario).length > 0 && (
          <Pressable style={styles.outlineButton} onPress={() => setModus('empfaenger')}>
            <Text style={styles.outlineButtonText}>Ich wurde alarmiert – was jetzt?</Text>
          </Pressable>
        )}
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable onPress={() => setPhase(null)} style={[styles.row, { marginBottom: 4 }]}>
        <ChevronLeft size={18} color={colors.muted} />
        <Text style={styles.muted}>Übersicht</Text>
      </Pressable>
      {header}

      {phase === 0 && (
        <>
          {callGuidance.length > 0 && (
            <View style={styles.callGuidanceBox}>
              <Text style={styles.callGuidanceTitle}>Wann anrufen und was sagen</Text>
              {callGuidance.map((hinweis, i) => (
                <View key={i} style={styles.callGuidanceRow}>
                  <Text style={styles.callGuidanceBullet}>•</Text>
                  <Text style={styles.callGuidanceText}>{hinweis}</Text>
                </View>
              ))}
            </View>
          )}
          {contacts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Bei unmittelbarer Gefahr zuerst den Notruf wählen:</Text>
              {contacts.map((c) => (
                <Pressable key={c.id} style={styles.callButton} onPress={() => Linking.openURL(`tel:${c.number}`)}>
                  <Phone size={18} color="#fff" />
                  <Text style={styles.callButtonText}>{c.name} anrufen</Text>
                  <Text style={styles.callButtonNumber}>{c.number}</Text>
                </Pressable>
              ))}
            </>
          )}
          <Text style={styles.sectionTitle}>Interne Alarmierung{scenario.silentDefault ? ' (still)' : ''}</Text>
          <Text style={[styles.body, { fontWeight: '600', marginTop: 0 }]}>Betroffener Standort wählen:</Text>
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
            {state.locations.map((l) => {
              const selected = alarmLocationIds.includes(l.id)
              return (
                <Pressable
                  key={l.id}
                  disabled={!!myScenarioAlarm}
                  onPress={() =>
                    setAlarmLocationIds(selected ? alarmLocationIds.filter((id) => id !== l.id) : [...alarmLocationIds, l.id])
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderColor: selected ? colors.brandLight : '#cbd5e1',
                    backgroundColor: selected ? colors.brandLight : colors.card,
                  }}
                >
                  <MapPin size={11} color={selected ? '#fff' : colors.muted} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? '#fff' : colors.muted }}>{l.name}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.faint}>
            Alarmiert {responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.name).join(', ') : 'alle Mitarbeitenden mit App'}
            {alarmLocationIds.length === 0 ? ' an allen Standorten' : ' am gewählten Standort'} – mit Quittierung.{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{alarmRecipientCount} Empfänger:innen</Text> werden benachrichtigt.
          </Text>
          {!myScenarioAlarm && fremderAlarm && (
            <View style={{ borderWidth: 2, borderColor: colors.violet, backgroundColor: colors.violetBg, borderRadius: 14, padding: 13, gap: 6 }}>
              <View style={styles.row}>
                <BellRing size={16} color={colors.violet} />
                <Text style={[styles.cardTitle, { color: colors.violet, flex: 1 }]}>Für dieses Ereignis läuft bereits ein Alarm</Text>
              </View>
              <Text style={[styles.body, { marginTop: 0 }]}>
                {fremderAusloeser ? `${fremderAusloeser.firstName} ${fremderAusloeser.lastName}` : 'Jemand'} hat {formatRelative(fremderAlarm.triggeredAt)} alarmiert.
                Wenn Sie trotzdem auslösen, entsteht kein zweiter Alarm: Ihre Meldung wird dem laufenden hinzugefügt, und neu gewählte Standorte werden zusätzlich alarmiert.
              </Text>
              <Pressable style={[styles.darkButton, { marginTop: 4 }]} onPress={() => setModus('empfaenger')}>
                <Text style={styles.darkButtonText}>Was jetzt zu tun ist</Text>
              </Pressable>
            </View>
          )}
          {myScenarioAlarm ? (
            <AlarmStatus alarm={myScenarioAlarm} />
          ) : (
            <HoldButton
              label={fremderAlarm
                ? `Meldung zum laufenden Alarm ergänzen (${alarmRecipientCount})`
                : `${responsibleGroups.length > 0 ? responsibleGroups.map((g) => g.name).join(' & ') : 'Alle'} alarmieren (${alarmRecipientCount})`}
              hint="Zum Alarmieren gedrückt halten"
              onTrigger={triggerGroupAlarm}
            />
          )}
        </>
      )}

      {phase === 1 && (
        <>
          <Text style={styles.faint}>Schritte antippen, wenn erledigt:</Text>
          {scenario.instructions.map((step, i) => (
            <Pressable key={i} style={styles.stepRow} onPress={() => setCheckedSteps({ ...checkedSteps, [i]: !checkedSteps[i] })}>
              <View style={[styles.stepNumber, checkedSteps[i] && { backgroundColor: colors.green }]}>
                {checkedSteps[i] ? <Check size={13} color="#fff" /> : <Text style={styles.stepNumberText}>{i + 1}</Text>}
              </View>
              <Text style={[styles.body, { flex: 1, marginTop: 2 }, checkedSteps[i] && { color: colors.faint, textDecorationLine: 'line-through' }]}>
                {step}
              </Text>
            </Pressable>
          ))}
        </>
      )}

      {phase === 2 && (
        <>
          {myCrisisAlarm ? (
            <AlarmStatus alarm={myCrisisAlarm} />
          ) : (
            <HoldButton label="Krisenteam aufbieten" hint="Zum Aufbieten gedrückt halten" onTrigger={triggerCrisisTeam} />
          )}
          <Text style={styles.faint}>
            Aufgebot per Push, SMS und Sprachanruf mit Quittierung – oder einzelne Mitglieder direkt kontaktieren:
          </Text>
          {crisisMembers.map((u) => {
            const memberGroups = state.groups.filter((g) => g.isCrisisTeam && u.groupIds.includes(g.id))
            const notified = notifiedUserIds.includes(u.id)
            return (
              <View key={u.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }}>
                <Text style={styles.cardTitle}>{u.firstName} {u.lastName}</Text>
                <Text style={styles.faint}>{memberGroups.map((g) => g.name).join(', ')}</Text>
                <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 9 }}
                    onPress={() => Linking.openURL(`tel:${u.phone.replace(/\s/g, '')}`)}
                  >
                    <Phone size={13} color={colors.text} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Anrufen</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 9, backgroundColor: notified ? colors.greenBg : colors.dark }}
                    disabled={notified}
                    onPress={() => notifyMember(u.id)}
                  >
                    {notified ? <Check size={13} color={colors.green} /> : <BellRing size={13} color="#fff" />}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: notified ? colors.green : '#fff' }}>
                      {notified ? 'Gesendet' : 'SMS & Push'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
        </>
      )}

      {phase === 3 && (
        <>
          {scenario.followUp.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Nach der Akutphase</Text>
              {scenario.followUp.map((step, i) => (
                <Text key={i} style={[styles.body, { marginBottom: 4 }]}>– {step}</Text>
              ))}
            </>
          )}
          <Text style={styles.sectionTitle}>Checkliste</Text>
          {scenario.checklist.map((item, i) => (
            <Pressable key={i} style={styles.checkRow} onPress={() => setCheckedList({ ...checkedList, [i]: !checkedList[i] })}>
              <View style={[styles.checkbox, checkedList[i] && { backgroundColor: colors.green, borderColor: colors.green }]}>
                {checkedList[i] && <Check size={13} color="#fff" />}
              </View>
              <Text style={[styles.body, { flex: 1 }, checkedList[i] && { textDecorationLine: 'line-through', color: colors.faint }]}>
                {item}
              </Text>
            </Pressable>
          ))}

          {(scenario.legalBasis?.length ?? 0) > 0 && <LegalSection eintraege={scenario.legalBasis!} />}
        </>
      )}

      <View style={[styles.row, { gap: 8, marginTop: 8 }]}>
        <Pressable
          style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
          onPress={() => setPhase(phase === 0 ? null : phase - 1)}
        >
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>Zurück</Text>
        </Pressable>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.dark, borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}
          onPress={() => (phase === PHASES.length - 1 ? setPhase(null) : setPhase(phase + 1))}
        >
          <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>{phase === PHASES.length - 1 ? 'Abschliessen' : 'Weiter'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

/** Rechtsgrundlagen – eingeklappt, damit sie im Ernstfall nicht im Weg stehen */
function LegalSection({ eintraege }: { eintraege: string[] }) {
  const [offen, setOffen] = useState(false)
  return (
    <Card>
      <Pressable style={styles.row} onPress={() => setOffen((v) => !v)}>
        <Scale size={15} color={colors.muted} />
        <Text style={[styles.cardTitle, { flex: 1 }]}>Rechtsgrundlagen</Text>
        <Text style={styles.faint}>{offen ? 'einklappen' : `${eintraege.length} Punkte`}</Text>
      </Pressable>
      {offen && (
        <View style={{ marginTop: 8 }}>
          {eintraege.map((eintrag, i) => (
            <Text key={i} style={[styles.faint, { marginBottom: 8, lineHeight: 17 }]}>
              § {eintrag}
            </Text>
          ))}
          <Text style={[styles.faint, { fontStyle: 'italic' }]}>
            Orientierungshilfe, keine Rechtsberatung. Verbindlich sind die kantonalen Vorgaben und das
            Notfallkonzept der Trägerschaft.
          </Text>
        </View>
      )}
    </Card>
  )
}

// ---------- Empfängerweg ----------

/**
 * Was jemand tut, der den Alarm erhalten hat – und die Lage nicht selbst
 * entdeckt hat. Notruf und Auslösung sind bereits geschehen; hier steht die
 * eigene Aufgabe, dazu die Quittierung.
 */
/**
 * Nach der Entwarnung: Der Alarm ist beendet, aber der Normalbetrieb beginnt
 * nicht von selbst – Rückkehr, Zählung, Nachsorge.
 */
function EntwarnungScreen({
  scenario, alarm, onBack, onSzenario,
}: {
  scenario: Scenario
  alarm: Alarm | null
  onBack: () => void
  onSzenario: () => void
}) {
  const { state } = useStore()
  const [erledigt, setErledigt] = useState<Record<number, boolean>>({})
  const schritte = allClearStepsOf(scenario)
  const beendetDurch = alarm?.log
    .map((l) => l.message)
    .reverse()
    .find((m) => m.startsWith('Alarm beendet durch '))
    ?.replace(/^Alarm beendet durch /, '')
    .replace(/ – Entwarnung versendet\.$/, '')
  const orte = alarm
    ? alarm.locationIds.map((id) => state.locations.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
    : ''

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={[styles.row, { marginBottom: 4 }]}>
        <ChevronLeft size={18} color={colors.muted} />
        <Text style={styles.muted}>Zurück</Text>
      </Pressable>
      <View style={[styles.row, { marginBottom: 12 }]}>
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={24} color={colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Entwarnung</Text>
          <Text style={styles.faint}>{scenario.title}</Text>
        </View>
      </View>

      {alarm ? (
        <Card style={{ borderColor: colors.green, borderWidth: 2 }}>
          <Text style={styles.body}>{alarm.message}</Text>
          <Text style={styles.faint}>
            Beendet {formatRelative(alarm.endedAt ?? alarm.triggeredAt)}
            {beendetDurch ? ` durch ${beendetDurch}` : ''}
            {orte ? ` · ${orte}` : ''}
          </Text>
          {alarm.endNote && (
            <View style={{ marginTop: 8, borderLeftWidth: 3, borderLeftColor: colors.green, paddingLeft: 8 }}>
              <Text style={[styles.faint, { color: colors.green, fontWeight: '700' }]}>Hinweis des Krisenstabs</Text>
              <Text style={[styles.body, { marginTop: 0 }]}>{alarm.endNote}</Text>
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={styles.faint}>Zu diesem Szenario ist kein beendeter Alarm bekannt. Das sind die Schritte für den Fall einer Entwarnung.</Text>
        </Card>
      )}

      <View style={[styles.empfaengerHinweis, { backgroundColor: colors.greenBg, borderColor: '#6ee7b7' }]}>
        <Text style={[styles.empfaengerHinweisText, { color: '#065f46' }]}>
          Der Alarm ist beendet. Der Normalbetrieb beginnt aber nicht von selbst – das gilt jetzt:
        </Text>
      </View>

      <Text style={styles.faint}>Schritte antippen, wenn erledigt:</Text>
      {schritte.map((schritt, i) => (
        <Pressable
          key={i}
          style={[styles.row, { alignItems: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }]}
          onPress={() => setErledigt({ ...erledigt, [i]: !erledigt[i] })}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: erledigt[i] ? colors.faint : colors.green, alignItems: 'center', justifyContent: 'center' }}>
            {erledigt[i] ? <Check size={14} color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>}
          </View>
          <Text style={[styles.body, { flex: 1, marginTop: 0, color: erledigt[i] ? colors.faint : colors.text, textDecorationLine: erledigt[i] ? 'line-through' : 'none' }]}>{schritt}</Text>
        </Pressable>
      ))}

      <Pressable onPress={onSzenario} style={{ marginTop: 16 }}>
        <Text style={[styles.muted, { textDecorationLine: 'underline', textAlign: 'center' }]}>
          Vollständiges Szenario ansehen
        </Text>
      </Pressable>
    </ScrollView>
  )
}

function EmpfaengerScreen({
  scenario, alarm, onBack, onEntdecker,
}: {
  scenario: Scenario
  alarm: Alarm | null
  onBack: () => void
  onEntdecker: () => void
}) {
  const { state, dispatch } = useStore()
  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  const [erledigt, setErledigt] = useState<Record<number, boolean>>({})
  const [zeigeAndere, setZeigeAndere] = useState(false)
  // Nur die Schritte der eigenen Gruppen – die übrigen bleiben auf Wunsch einsehbar
  const { eigene, andere } = responseStepsFor(scenario, me.groupIds)
  const gruppenName = (ids?: string[]) =>
    (ids ?? []).map((id) => state.groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ')
  const meineGruppen = state.groups.filter((g) => me.groupIds.includes(g.id) && g.id !== 'gr-alle').map((g) => g.name).join(', ')
  const ausloeser = alarm ? state.users.find((u) => u.id === alarm.triggeredByUserId) : undefined
  const orte = alarm
    ? alarm.locationIds.map((id) => state.locations.find((l) => l.id === id)?.name).filter(Boolean).join(', ')
    : ''
  const myAck = alarm?.deliveries.find((d) => d.userId === me.id)?.ack ?? 'none'

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable onPress={onBack} style={[styles.row, { marginBottom: 4 }]}>
        <ChevronLeft size={18} color={colors.muted} />
        <Text style={styles.muted}>Zurück</Text>
      </Pressable>
      <View style={[styles.row, { marginBottom: 12 }]}>
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center' }}>
          <ScenarioIcon name={scenario.icon} size={24} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{scenario.title}</Text>
          <Text style={styles.faint}>Sie wurden alarmiert</Text>
        </View>
      </View>

      {alarm ? (
        <Card style={{ borderColor: alarm.silent ? colors.violet : colors.brandLight, borderWidth: 2 }}>
          {alarm.drill && (
            <View style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
              <Badge label="ÜBUNG – kein Ernstfall" color="amber" />
            </View>
          )}
          <Text style={styles.body}>{alarm.message}</Text>
          <Text style={styles.faint}>
            {ausloeser ? `Ausgelöst von ${ausloeser.firstName} ${ausloeser.lastName} · ` : ''}
            {formatRelative(alarm.triggeredAt)}
            {orte ? ` · ${orte}` : ''}
          </Text>
          <Rueckmeldestand alarm={alarm} />
          <Lagemeldungen alarm={alarm} />
          {alarm.requireAck && myAck === 'none' && (
            <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
              <Pressable
                style={[styles.ackButton, { backgroundColor: colors.green }]}
                onPress={() => dispatch({ type: 'ACK_ALARM', alarmId: alarm.id, userId: me.id, ack: 'acknowledged' })}
              >
                <Check size={15} color="#fff" />
                <Text style={styles.ackButtonText}>Ich komme</Text>
              </Pressable>
              <Pressable
                style={[styles.ackButton, { backgroundColor: '#cbd5e1' }]}
                onPress={() => dispatch({ type: 'ACK_ALARM', alarmId: alarm.id, userId: me.id, ack: 'declined' })}
              >
                <X size={15} color={colors.text} />
                <Text style={[styles.ackButtonText, { color: colors.text }]}>Nicht verfügbar</Text>
              </Pressable>
            </View>
          )}
          {alarm.requireAck && myAck !== 'none' && (
            <View style={{ marginTop: 8 }}>
              {myAck === 'acknowledged'
                ? <Badge label="quittiert – Sie nehmen teil" color="green" />
                : <Badge label="als nicht verfügbar gemeldet" color="slate" />}
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={styles.faint}>Zurzeit läuft kein Alarm zu diesem Szenario. Das ist der Ablauf für den Fall, dass Sie einen erhalten.</Text>
        </Card>
      )}

      <View style={styles.empfaengerHinweis}>
        <Text style={styles.empfaengerHinweisText}>
          Kein Notruf, keine erneute Auslösung – das ist bereits geschehen. Hier steht, was Sie jetzt tun.
        </Text>
      </View>

      <Text style={styles.faint}>
        Ihre Schritte{meineGruppen ? ` als ${meineGruppen}` : ''} – antippen, wenn erledigt:
      </Text>
      {eigene.map((step, i) => (
        <Pressable
          key={i}
          style={[styles.row, { alignItems: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }]}
          onPress={() => setErledigt({ ...erledigt, [i]: !erledigt[i] })}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: erledigt[i] ? colors.green : '#d97706', alignItems: 'center', justifyContent: 'center' }}>
            {erledigt[i] ? <Check size={14} color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.body, { marginTop: 0, color: erledigt[i] ? colors.faint : colors.text, textDecorationLine: erledigt[i] ? 'line-through' : 'none' }]}>{step.text}</Text>
            {step.groupIds && step.groupIds.length > 0 && (
              <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>{gruppenName(step.groupIds)}</Text>
            )}
          </View>
        </Pressable>
      ))}

      {andere.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Pressable onPress={() => setZeigeAndere(!zeigeAndere)}>
            <Text style={[styles.muted, { textDecorationLine: 'underline', fontSize: 12 }]}>
              {zeigeAndere ? 'Schritte anderer Gruppen ausblenden' : `${andere.length} Schritt${andere.length > 1 ? 'e' : ''} anderer Gruppen anzeigen`}
            </Text>
          </Pressable>
          {zeigeAndere && andere.map((step, i) => (
            <View key={i} style={[styles.row, { alignItems: 'flex-start', backgroundColor: colors.bg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12, padding: 12, marginTop: 8 }]}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>·</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { marginTop: 0, color: colors.muted }]}>{step.text}</Text>
                <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>{gruppenName(step.groupIds)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={onEntdecker} style={{ marginTop: 16 }}>
        <Text style={[styles.muted, { textDecorationLine: 'underline', textAlign: 'center' }]}>
          Vollständiges Szenario ansehen – für den Fall, dass Sie die Lage selbst entdecken
        </Text>
      </Pressable>
    </ScrollView>
  )
}

// ---------- Alleinarbeit ----------

// Geplante Timer-Benachrichtigungen pro Sitzung (überleben den App-Neustart als iOS-Planung;
// die Zuordnung hier genügt für Verlängern/Beenden innerhalb der laufenden App)
const loneWorkNotifIds = new Map<string, (string | null)[]>()

async function scheduleLoneWorkNotifications(sessionId: string, activity: string, expiresAt: number) {
  await cancelScheduled(loneWorkNotifIds.get(sessionId) ?? [])
  const warnAt = expiresAt - 5 * 60_000
  const ids = await Promise.all([
    scheduleAt('Alleinarbeit: Timer läuft bald ab', `Noch 5 Minuten (${activity}) – Lebenszeichen geben, sonst wird alarmiert.`, warnAt),
    scheduleAt('Alleinarbeit: Alarm ausgelöst', `Timer abgelaufen (${activity}) – Schulsanität und Hausdienst werden alarmiert.`, expiresAt, true),
  ])
  loneWorkNotifIds.set(sessionId, ids)
}

export function LoneWorkScreen() {
  const { state, dispatch } = useStore()
  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  const [activity, setActivity] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [silent, setSilent] = useState(false)
  // Wer bei Ablauf alarmiert wird: Gruppen am eigenen Standort, dazu einzelne Personen
  const [alertGroupIds, setAlertGroupIds] = useState<string[]>(() =>
    LONE_WORK_DEFAULT_GROUPS.filter((id) => state.groups.some((g) => g.id === id)),
  )
  const [alertUserIds, setAlertUserIds] = useState<string[]>([])
  const [personenOffen, setPersonenOffen] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const mySessions = state.loneWorkSessions.filter((s) => s.userId === me.id)
  const running = mySessions.find((s) => s.status === 'running')
  // Timer abgelaufen, Alarm läuft noch: «mir geht es gut» beendet ihn
  const abgelaufenerAlarm = state.alarms.find((a) => a.status === 'active' && a.triggeredVia === 'timer' && a.triggeredByUserId === me.id)
  const waehlbareGruppen = state.groups.filter((g) => g.id !== 'gr-alle')
  const waehlbarePersonen = [...state.users]
    .filter((u) => u.id !== me.id)
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
  const vorschau = alleinarbeitEmpfaenger(state.users, {
    id: '', userId: me.id, locationId: me.locationId, activity: '', startedAt: 0, durationMin, expiresAt: 0, silent, status: 'running',
    alertGroupIds, alertUserIds,
  })
  const anzahlEmpfaenger = vorschau.recipientUserIds
    ? vorschau.recipientUserIds.length
    : resolveRecipients(state.users, vorschau.groupIds, [me.locationId]).filter((u) => u.id !== me.id).length
  const toggle = (liste: string[], id: string) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id])
  const nameVon = (id: string) => {
    const u = state.users.find((x) => x.id === id)
    return u ? `${u.firstName} ${u.lastName}` : ''
  }
  const empfaengerText = (s: LoneWorkSession) => {
    const gruppen = (s.alertGroupIds?.length ? s.alertGroupIds : LONE_WORK_DEFAULT_GROUPS)
      .map((id) => state.groups.find((g) => g.id === id)?.name).filter(Boolean)
    const personen = (s.alertUserIds ?? []).map(nameVon).filter(Boolean)
    return [...gruppen, ...personen].join(', ')
  }

  function start() {
    const session: LoneWorkSession = {
      id: uid('lw'),
      userId: me.id,
      locationId: me.locationId,
      activity: activity || 'Alleinarbeit',
      startedAt: Date.now(),
      durationMin,
      expiresAt: Date.now() + durationMin * 60_000,
      silent,
      status: 'running',
      alertGroupIds,
      alertUserIds,
    }
    dispatch({ type: 'START_LONE_WORK', session })
    scheduleLoneWorkNotifications(session.id, session.activity, session.expiresAt)
    setActivity('')
  }

  if (running) {
    const remaining = running.expiresAt - now
    const critical = remaining < 5 * 60_000
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Card style={{ alignItems: 'center', borderWidth: 2, borderColor: critical ? colors.alarmLight : colors.border }}>
          <Text style={styles.muted}>{running.activity}</Text>
          <Text style={[styles.countdown, critical && { color: colors.alarm }]}>{formatDuration(remaining)}</Text>
          <Text style={[styles.faint, { textAlign: 'center', marginBottom: 14 }]}>
            {critical ? 'Bald läuft der Timer ab – Lebenszeichen geben!' : 'Läuft der Timer ab, wird automatisch alarmiert.'}
            {'\n'}Alarmiert werden: {empfaengerText(running)}
          </Text>
          <Pressable
            style={[styles.bigButton, { backgroundColor: colors.green }]}
            onPress={() => {
              dispatch({ type: 'EXTEND_LONE_WORK', sessionId: running.id, minutes: running.durationMin })
              scheduleLoneWorkNotifications(running.id, running.activity, running.expiresAt + running.durationMin * 60_000)
            }}
          >
            <Clock size={18} color="#fff" />
            <Text style={styles.bigButtonText}>Lebenszeichen (+{running.durationMin} Min.)</Text>
          </Pressable>
          <Pressable
            style={[styles.bigButton, { backgroundColor: colors.dark, marginTop: 8 }]}
            onPress={() => {
              dispatch({ type: 'COMPLETE_LONE_WORK', sessionId: running.id })
              cancelScheduled(loneWorkNotifIds.get(running.id) ?? [])
              loneWorkNotifIds.delete(running.id)
            }}
          >
            <CheckCircle2 size={16} color="#fff" />
            <Text style={styles.bigButtonText}>Arbeit sicher beendet</Text>
          </Pressable>
        </Card>
        {running.silent && <Text style={[styles.faint, { textAlign: 'center' }]}>Stille Alarmauslösung aktiviert.</Text>}
        {Platform.OS === 'android' && (
          <Text style={[styles.faint, { textAlign: 'center' }]}>
            {androidCountdownVerfuegbar()
              ? 'Der Countdown läuft auch als Benachrichtigung – sichtbar auf dem Sperrbildschirm.'
              : 'Dieser App-Build zeigt den Countdown noch nicht als Benachrichtigung an – bitte die App aktualisieren.'}
          </Text>
        )}
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {abgelaufenerAlarm && (
        <Card style={{ borderColor: colors.alarmLight, borderWidth: 2 }}>
          <View style={styles.row}>
            <Siren size={18} color={colors.alarm} />
            <Text style={[styles.cardTitle, { color: colors.alarm, flex: 1 }]}>Timer abgelaufen – Alarm ausgelöst</Text>
            <Text style={styles.faint}>{formatRelative(abgelaufenerAlarm.triggeredAt)}</Text>
          </View>
          <Text style={styles.body}>
            Schulsanität und Hausdienst sind alarmiert. Wenn Ihnen nichts fehlt und Sie nur vergessen haben, den Timer zu verlängern, geben Sie hier Entwarnung.
          </Text>
          <Rueckmeldestand alarm={abgelaufenerAlarm} />
          <Pressable
            style={[styles.bigButton, { backgroundColor: colors.green, marginTop: 12 }]}
            onPress={() =>
              Alert.alert('Entwarnung', 'Ihnen geht es gut und der Alarm soll beendet werden? Alle Alarmierten erhalten die Entwarnung.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Entwarnung senden', onPress: () => dispatch({ type: 'END_ALARM', alarmId: abgelaufenerAlarm.id, note: 'Mir geht es gut – der Timer wurde nicht rechtzeitig verlängert.' }) },
              ])
            }
          >
            <CheckCircle2 size={16} color="#fff" />
            <Text style={styles.bigButtonText}>Mir geht es gut – Entwarnung senden</Text>
          </Pressable>
        </Card>
      )}
      <Card>
        <View style={[styles.row, { marginBottom: 10 }]}>
          <Timer size={18} color={colors.text} />
          <Text style={styles.cardTitle}>Alleinarbeit starten</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Tätigkeit (z. B. Abendrundgang, Wartung)"
          placeholderTextColor={colors.faint}
          value={activity}
          onChangeText={setActivity}
        />
        <Text style={[styles.body, { marginTop: 12, fontWeight: '600' }]}>Timer: {durationMin} Minuten</Text>
        <View style={[styles.row, { marginTop: 8, flexWrap: 'wrap', gap: 8 }]}>
          {[5, 15, 30, 45, 60, 90].map((m) => (
            <Pressable
              key={m}
              onPress={() => setDurationMin(m)}
              style={[styles.chip, durationMin === m && { backgroundColor: colors.dark }]}
            >
              <Text style={[styles.chipText, durationMin === m && { color: '#fff' }]}>{m} Min.</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.body, { marginTop: 14, fontWeight: '600' }]}>Bei Ablauf alarmieren</Text>
        <Text style={styles.faint}>Gruppen an Ihrem Standort – antippen zum An- und Abwählen:</Text>
        <View style={[styles.row, { marginTop: 8, flexWrap: 'wrap', gap: 8 }]}>
          {waehlbareGruppen.map((g) => {
            const an = alertGroupIds.includes(g.id)
            return (
              <Pressable key={g.id} onPress={() => setAlertGroupIds(toggle(alertGroupIds, g.id))} style={[styles.chip, an && { backgroundColor: colors.dark }]}>
                <Text style={[styles.chipText, an && { color: '#fff' }]}>{g.name}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable onPress={() => setPersonenOffen(!personenOffen)} style={{ marginTop: 10 }}>
          <Text style={[styles.muted, { textDecorationLine: 'underline', fontSize: 13 }]}>
            {personenOffen ? 'Einzelne Personen ausblenden' : `Zusätzlich einzelne Personen wählen${alertUserIds.length ? ` (${alertUserIds.length} gewählt)` : ''}`}
          </Text>
        </Pressable>
        {personenOffen && (
          <View style={{ marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, maxHeight: 260 }}>
            <ScrollView nestedScrollEnabled>
              {waehlbarePersonen.map((u) => {
                const an = alertUserIds.includes(u.id)
                const ort = state.locations.find((l) => l.id === u.locationId)?.name
                return (
                  <Pressable key={u.id} onPress={() => setAlertUserIds(toggle(alertUserIds, u.id))} style={[styles.row, { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: an ? colors.brand : '#cbd5e1', backgroundColor: an ? colors.brand : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                      {an && <Check size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.body, { marginTop: 0, flex: 1 }]}>{u.firstName} {u.lastName}</Text>
                    <Text style={styles.faint}>{ort}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        )}
        {alertUserIds.length > 0 && (
          <Text style={[styles.faint, { marginTop: 6 }]}>Zusätzlich: {alertUserIds.map(nameVon).filter(Boolean).join(', ')}</Text>
        )}
        <Text style={[styles.faint, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700', color: anzahlEmpfaenger === 0 ? colors.alarm : colors.text }}>{anzahlEmpfaenger} Person{anzahlEmpfaenger === 1 ? '' : 'en'}</Text> würden bei Ablauf alarmiert{anzahlEmpfaenger === 0 ? ' – bitte mindestens eine Gruppe oder Person wählen' : ''}.
        </Text>
        <View style={[styles.row, { marginTop: 14 }]}>
          <Switch value={silent} onValueChange={setSilent} />
          <Text style={styles.body}>Stille Alarmauslösung</Text>
        </View>
        <Pressable
          style={[styles.bigButton, { backgroundColor: anzahlEmpfaenger === 0 ? colors.faint : colors.dark, marginTop: 14 }]}
          onPress={start}
          disabled={anzahlEmpfaenger === 0}
        >
          <Play size={16} color="#fff" />
          <Text style={styles.bigButtonText}>Timer starten</Text>
        </Pressable>
        <Text style={[styles.faint, { marginTop: 8 }]}>
          Melden Sie sich vor Ablauf zurück – sonst alarmiert das System automatisch die gewählten Personen.
        </Text>
      </Card>

      {mySessions.length > 0 && (
        <Card>
          <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Verlauf</Text>
          {mySessions.slice(0, 6).map((s) => (
            <View key={s.id} style={[styles.row, { paddingVertical: 5 }]}>
              <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{s.activity}</Text>
              {s.status === 'completed' && <Badge label="beendet" color="green" />}
              {s.status === 'alarm' && <Badge label="Alarm ausgelöst" color="red" />}
              {s.status === 'running' && <Badge label="läuft" color="amber" />}
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  )
}

// ---------- Notruf ----------

export function ContactsScreen() {
  const { state } = useStore()
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {state.contacts.map((c) => (
        <Pressable key={c.id} style={styles.contactRow} onPress={() => Linking.openURL(`tel:${c.number}`)}>
          <View style={styles.contactIcon}>
            <Phone size={17} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.faint} numberOfLines={1}>{c.description}</Text>
          </View>
          <Text style={styles.contactNumber}>{c.number}</Text>
        </Pressable>
      ))}
      <Text style={[styles.faint, { textAlign: 'center' }]}>Antippen ruft direkt an.</Text>
    </ScrollView>
  )
}

// ---------- Profil ----------

/** Demo/Live-Umschalter – nur für Admins sichtbar */
function ModeCard() {
  const { state, switchMode } = useStore()
  return (
    <Card>
      <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Modus</Text>
      <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3 }}>
        {(['demo', 'live'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: state.mode === m ? (m === 'live' ? '#059669' : '#f59e0b') : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                letterSpacing: 0.5,
                color: state.mode === m ? (m === 'live' ? '#fff' : '#0f172a') : colors.muted,
              }}
            >
              {m === 'demo' ? 'DEMO' : 'LIVE'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.faint, { marginTop: 8 }]}>
        {state.mode === 'demo'
          ? 'Beispieldaten, Zustellung und Rückmeldungen werden simuliert.'
          : 'Eigener Datenbestand ohne Simulation – Zustellungen bleiben offen, bis ein Versand-Gateway angebunden ist. Beide Modi behalten ihre Daten.'}
      </Text>
    </Card>
  )
}

/**
 * Handbücher zur eigenen Rolle – ausgeliefert vom Alarmserver unter
 * /handbuecher, geöffnet im Browser. Mitarbeitende sehen nur ihr eigenes
 * Handbuch; Administrations- und Installationsunterlagen bleiben der
 * jeweiligen Rolle vorbehalten.
 */
const HANDBUECHER: { datei: string; titel: string; rollen: User['role'][] }[] = [
  { datei: 'handbuch-1-administration.html', titel: 'Administration', rollen: ['admin'] },
  { datei: 'handbuch-2-krisenstab.html', titel: 'Krisenstab', rollen: ['admin', 'krisenstab'] },
  { datei: 'handbuch-3-mitarbeitende.html', titel: 'Mitarbeitende', rollen: ['admin', 'krisenstab', 'mitarbeiter'] },
  { datei: 'handbuch-4-installation.html', titel: 'Installation & Konfiguration', rollen: ['admin'] },
]

function HandbuchCard({ rolle }: { rolle: User['role'] }) {
  const passend = HANDBUECHER.filter((h) => h.rollen.includes(rolle))
  if (passend.length === 0) return null
  return (
    <Card>
      <View style={styles.row}>
        <BookOpen size={16} color={colors.muted} />
        <Text style={[styles.cardTitle, { flex: 1 }]}>Handbücher</Text>
      </View>
      {passend.map((h) => (
        <Pressable
          key={h.datei}
          style={[styles.row, { paddingVertical: 9 }]}
          onPress={() => Linking.openURL(`${serverUrl()}/handbuecher/${h.datei}`).catch(() => {})}
        >
          <Text style={[styles.body, { flex: 1 }]}>{h.titel}</Text>
          <ExternalLink size={14} color={colors.faint} />
        </Pressable>
      ))}
      <Text style={styles.faint}>Öffnet im Browser – von dort auch druck- und speicherbar.</Text>
    </Card>
  )
}

/** Nur der Zustand zählt: Sind Push-Mitteilungen auf diesem Gerät aktiv? */
function PushStatusCard() {
  const [granted, setGranted] = useState<boolean | null>(null)

  useEffect(() => {
    ensurePermissions().then(setGranted)
  }, [])

  return (
    <Card>
      <View style={styles.row}>
        <BellRing size={16} color={colors.muted} />
        <Text style={[styles.cardTitle, { flex: 1 }]}>Push-Benachrichtigungen</Text>
        <Badge
          label={granted === null ? 'prüfe…' : granted ? 'aktiv' : 'nicht aktiv'}
          color={granted ? 'green' : 'amber'}
        />
      </View>
      {granted === false && (
        <Text style={[styles.faint, { marginTop: 6 }]}>
          Mitteilungen sind für diese App abgeschaltet – in den iOS-Einstellungen unter
          «Mitteilungen» erlauben, sonst kommen Alarme nur bei geöffneter App an.
        </Text>
      )}
    </Card>
  )
}

export function ProfileScreen() {
  const { state, dispatch, logout, serverStatus } = useStore()
  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  const myLocation = state.locations.find((l) => l.id === me.locationId)
  const myGroups = state.groups.filter((g) => me.groupIds.includes(g.id))

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Card>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{me.firstName[0]}{me.lastName[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{me.firstName} {me.lastName}</Text>
            <Text style={styles.faint}>{me.email}</Text>
          </View>
        </View>
        <View style={[styles.row, { marginTop: 10 }]}>
          <MapPin size={14} color={colors.faint} />
          <Text style={styles.body}>{myLocation?.name}</Text>
        </View>
        <View style={[styles.row, { marginTop: 8, flexWrap: 'wrap', gap: 6 }]}>
          {myGroups.map((g) => <Badge key={g.id} label={g.name} />)}
        </View>
      </Card>

      <PasswordCard />

      {state.mode === 'demo' && (
      <Card>
        <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Demo: Ansicht als andere Person</Text>
        {state.users.map((u) => (
          <Pressable
            key={u.id}
            style={[styles.row, { paddingVertical: 7 }]}
            onPress={() => dispatch({ type: 'SET_USER', userId: u.id })}
          >
            <View style={[styles.radio, u.id === me.id && { borderColor: colors.brand }]}>
              {u.id === me.id && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.body, { flex: 1 }]}>{u.firstName} {u.lastName}</Text>
            <Text style={styles.faint}>{u.role}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.outlineButton, { marginTop: 10 }]}
          onPress={() =>
            Alert.alert('Zurücksetzen', 'Demo-Daten zurücksetzen?', [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Zurücksetzen', style: 'destructive', onPress: () => dispatch({ type: 'RESET' }) },
            ])
          }
        >
          <Text style={styles.outlineButtonText}>Demo zurücksetzen</Text>
        </Pressable>
      </Card>
      )}

      {state.mode === 'live' && (
        <Card>
          <View style={styles.row}>
            <View
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: serverStatus === 'verbunden' ? colors.green : serverStatus === 'getrennt' ? colors.alarm : '#f59e0b',
              }}
            />
            <Text style={[styles.cardTitle, { flex: 1 }]}>
              {serverStatus === 'verbunden'
                ? 'Mit Alarmserver verbunden'
                : serverStatus === 'getrennt'
                  ? 'Alarmserver nicht erreichbar'
                  : 'Verbinde mit Alarmserver …'}
            </Text>
          </View>
        </Card>
      )}

      {me.role === 'admin' && <ModeCard />}

      <PushStatusCard />

      {state.mode === 'live' && <HandbuchCard rolle={me.role} />}

      <Card>
        <View style={styles.row}>
          <ShieldAlert size={16} color={colors.muted} />
          <Text style={[styles.cardTitle, { flex: 1 }]}>Über diese App</Text>
        </View>
        <Text style={[styles.body, { marginTop: 6 }]}>
          Version {Constants.expoConfig?.version ?? 'unbekannt'}
        </Text>
      </Card>

      <Pressable style={styles.outlineButton} onPress={logout}>
        <View style={styles.row}>
          <LogOut size={15} color={colors.text} />
          <Text style={styles.outlineButtonText}>Abmelden</Text>
        </View>
      </Pressable>
    </ScrollView>
  )
}

/** Eigenes Passwort ändern */
function PasswordCard() {
  const { changePassword } = useStore()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const problem = passwordProblem(next)
    if (problem) return setError(problem)
    if (next !== repeat) return setError('Die beiden neuen Passwörter stimmen nicht überein.')
    const ergebnis = await changePassword(current, next)
    if (!ergebnis.ok) return setError(ergebnis.error)
    setOpen(false)
    setCurrent(''); setNext(''); setRepeat(''); setError(null)
  }

  if (!open) {
    return (
      <Pressable style={[styles.outlineButton, { marginTop: 0 }]} onPress={() => setOpen(true)}>
        <View style={styles.row}>
          <KeyRound size={15} color={colors.text} />
          <Text style={styles.outlineButtonText}>Passwort ändern</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Card>
      <Text style={[styles.cardTitle, { marginBottom: 10 }]}>Passwort ändern</Text>
      <TextInput
        style={[styles.input, { marginBottom: 8 }]} placeholder="Aktuelles Passwort" placeholderTextColor={colors.faint}
        secureTextEntry autoCapitalize="none" value={current} onChangeText={(t) => { setCurrent(t); setError(null) }}
      />
      <TextInput
        style={[styles.input, { marginBottom: 8 }]}
        placeholder={`Neues Passwort (mind. ${MIN_PASSWORD_LENGTH} Zeichen, mit Ziffer)`} placeholderTextColor={colors.faint}
        secureTextEntry autoCapitalize="none" value={next} onChangeText={(t) => { setNext(t); setError(null) }}
      />
      <TextInput
        style={styles.input} placeholder="Neues Passwort wiederholen" placeholderTextColor={colors.faint}
        secureTextEntry autoCapitalize="none" value={repeat} onChangeText={(t) => { setRepeat(t); setError(null) }}
      />
      {error && <Text style={[styles.faint, { color: colors.alarm, marginTop: 8 }]}>{error}</Text>}
      <View style={[styles.row, { marginTop: 12 }]}>
        <Pressable style={[styles.outlineButton, { flex: 1, marginTop: 0 }]} onPress={() => { setOpen(false); setError(null) }}>
          <Text style={styles.outlineButtonText}>Abbrechen</Text>
        </Pressable>
        <Pressable style={[styles.darkButton, { flex: 1, marginTop: 0, backgroundColor: colors.brand }]} onPress={save}>
          <Text style={styles.darkButtonText}>Speichern</Text>
        </Pressable>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 14, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 4 },
  callGuidanceBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
  callGuidanceTitle: { fontSize: 14, fontWeight: '700', color: '#78350f' },
  callGuidanceRow: { flexDirection: 'row', gap: 8 },
  callGuidanceBullet: { color: '#d97706', fontSize: 14, lineHeight: 20 },
  callGuidanceText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#78350f' },
  empfaengerHinweis: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, marginBottom: 6 },
  empfaengerHinweisText: { fontSize: 12.5, lineHeight: 18, color: '#78350f' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text, marginTop: 4 },
  muted: { fontSize: 14, color: colors.muted },
  faint: { fontSize: 12, color: colors.faint },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#f1f5f9', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green },
  darkButton: { backgroundColor: colors.dark, borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  darkButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  outlineButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  outlineButtonText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  ackButton: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 11 },
  ackButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  bigButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, alignSelf: 'stretch' },
  bigButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13, gap: 3, flexGrow: 1 },
  tileTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.alarmLight, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginTop: 6 },
  callButtonText: { color: '#fff', fontWeight: '700', flex: 1, fontSize: 14 },
  callButtonNumber: { color: '#fff', fontWeight: '800', fontSize: 18 },
  stepRow: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 11, marginBottom: 8 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 11, marginBottom: 7 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  contactIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center' },
  contactNumber: { fontSize: 18, fontWeight: '800', color: colors.brand },
  countdown: { fontSize: 52, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], marginVertical: 6 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.card },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
})
