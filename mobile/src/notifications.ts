import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { playAlarmSound, stopAlarmSound } from 'alarm-sound'

// Benachrichtigungen auch anzeigen, wenn die App im Vordergrund ist.
// shouldSetBadge übernimmt die vom Server mitgeschickte Zahl aufs App-Symbol.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Kanal für Alarme auf Android: höchste Wichtigkeit, Umgehung von «Nicht stören»,
 * und der Ton läuft über den Alarm-Audiokanal – wie bei einer Wecker-App klingt
 * er damit auch bei Lautlos und Vibrationsmodus (massgeblich ist die
 * Wecker-Lautstärke). Der Server verweist beim Versand auf diesen Kanal.
 *
 * «-v2», weil Android Kanal-Einstellungen nach dem Anlegen einfriert: Die
 * Audio-Attribute liessen sich auf dem alten Kanal nicht mehr ändern.
 */
export const ALARM_CHANNEL_ID = 'alarme-v2'
/** Stille Alarme und Entwarnungen: sichtbar, aber ohne Ton und Vibration */
export const SILENT_CHANNEL_ID = 'alarme-still-v2'
/** Kanal-Ids früherer Versionen – beim Start entfernen, damit die Einstellungen sauber bleiben */
const ALTE_KANAELE = ['alarme', 'alarme-still']

/** Was der Server einer Mitteilung mitgibt – Antippen öffnet die passende Ansicht */
export interface PushDaten {
  kind?: 'alarm' | 'ended'
  alarmId?: string
  scenarioId?: string
}

/**
 * Android: kritische Alarme (SOS, Timer-Alarm) laufen über notifee statt expo-notifications –
 * nur notifee kann eine Vollbild-Meldung wie bei einem eingehenden Anruf über den Sperrbildschirm
 * legen. Der Ton läuft zusätzlich über das native Modul `alarm-sound` auf Wecker-Lautstärke
 * (siehe dort) – das bleibt auch bei stummgeschaltetem Gerät hörbar, was ein Notification-Kanal
 * allein nicht kann. Auf iOS und in Expo Go/älteren Builds ohne natives Modul bleibt es beim
 * bisherigen Weg über expo-notifications. Siehe CRITICAL-ALERTS.md, Abschnitt Android.
 */
type NotifeeApi = typeof import('@notifee/react-native')
let notifeeApi: NotifeeApi | null | undefined
function notifee(): NotifeeApi | null {
  if (notifeeApi !== undefined) return notifeeApi
  if (Platform.OS !== 'android') return (notifeeApi = null)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifeeApi = require('@notifee/react-native') as NotifeeApi
  } catch {
    notifeeApi = null
  }
  return notifeeApi
}

/** PushDaten in das von notifee erwartete String-Format bringen (undefinierte Felder weglassen) */
function notifeeDaten(daten?: PushDaten): Record<string, string> {
  const eintraege = Object.entries(daten ?? {}).filter(([, wert]) => wert !== undefined) as [string, string][]
  return Object.fromEntries(eintraege)
}

const NOTIFEE_ID_PREFIX = 'notifee:'
/** Nach dieser Zeit hört der Alarmton von selbst auf, falls niemand die Meldung antippt oder wegwischt */
const ALARM_SOUND_TIMEOUT_MS = 2 * 60_000

/** Sofortige Vollbild-Meldung für einen kritischen Android-Alarm, plus Ton auf Wecker-Lautstärke */
async function androidAlarmAnzeigen(title: string, body: string, daten?: PushDaten): Promise<void> {
  const n = notifee()
  if (!n) return
  try {
    await n.default.displayNotification({
      title,
      body,
      data: notifeeDaten(daten),
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: n.AndroidCategory.ALARM,
        importance: n.AndroidImportance.HIGH,
        visibility: n.AndroidVisibility.PUBLIC,
        autoCancel: true,
        pressAction: { id: 'default' },
        fullScreenAction: { id: 'default', launchActivity: 'default' },
      },
    })
    playAlarmSound()
    setTimeout(stopAlarmSound, ALARM_SOUND_TIMEOUT_MS)
  } catch {
    // Keine Vollbild-Berechtigung (Android 14+, manuell in den Einstellungen zu erteilen) –
    // die Meldung im Kanal `alarme` bleibt trotzdem laut und umgeht «Nicht stören»
  }
}

/**
 * Für einen späteren Zeitpunkt geplante Vollbild-Meldung (z. B. Ablauf des Alleinarbeits-Timers).
 * Läuft über Androids AlarmManager wie ein Weckerklingeln (SET_ALARM_CLOCK) – zuverlässiger als
 * die Standardplanung, die der Energiesparmodus verzögern kann. Der Alarmton über `alarm-sound`
 * lässt sich dafür nicht vorausplanen: er wird nur ausgelöst, wenn zum Ablaufzeitpunkt JS läuft
 * (siehe store.tsx, wo der laufende Timer selbst notifyNow() aufruft). Diese geplante Meldung ist
 * das Sicherheitsnetz, falls die App zu dem Zeitpunkt beendet ist.
 */
async function androidAlarmPlanen(title: string, body: string, timestamp: number): Promise<string | null> {
  const n = notifee()
  if (!n) return null
  try {
    const id = await n.default.createTriggerNotification(
      {
        title,
        body,
        android: {
          channelId: ALARM_CHANNEL_ID,
          category: n.AndroidCategory.ALARM,
          importance: n.AndroidImportance.HIGH,
          visibility: n.AndroidVisibility.PUBLIC,
          autoCancel: true,
          pressAction: { id: 'default' },
          fullScreenAction: { id: 'default', launchActivity: 'default' },
        },
      },
      {
        type: n.TriggerType.TIMESTAMP,
        timestamp,
        alarmManager: { type: n.AlarmType.SET_ALARM_CLOCK },
      },
    )
    return `${NOTIFEE_ID_PREFIX}${id}`
  } catch {
    return null
  }
}

async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Alarme',
      description: 'Notfallalarme – klingeln wie ein Wecker, auch bei Lautlos und «Nicht stören».',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      sound: 'default',
      // Ton über den Alarm-Audiokanal: unabhängig von Klingel- und
      // Benachrichtigungslautstärke, klingt auch im Lautlos-Modus
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    })
    await Notifications.setNotificationChannelAsync(SILENT_CHANNEL_ID, {
      name: 'Stille Alarme und Entwarnung',
      description: 'Erscheinen ohne Ton und Vibration – damit niemand auf sich aufmerksam macht.',
      importance: Notifications.AndroidImportance.HIGH,
      bypassDnd: true,
      sound: null,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: false,
    })
    for (const alt of ALTE_KANAELE) {
      await Notifications.deleteNotificationChannelAsync(alt).catch(() => {})
    }
  } catch {
    // Kanal nicht anlegbar – Benachrichtigungen laufen über den Standardkanal
  }
}

export async function ensurePermissions(): Promise<boolean> {
  if (!Device.isDevice) return false
  try {
    await ensureAlarmChannel()
    const current = await Notifications.getPermissionsAsync()
    // Auch bei bereits erteilter Berechtigung nachfragen, solange Critical Alerts
    // noch fehlen – iOS zeigt den Dialog dann gezielt für diese Stufe
    if (current.granted && current.ios?.allowsCriticalAlerts) return true
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        // Zahl der laufenden Alarme auf dem App-Symbol
        allowBadge: true,
        // Klingeln auch bei stummgeschaltetem Telefon und in Fokus-Modi.
        // Setzt die von Apple bewilligte Berechtigung voraus (siehe app.json).
        allowCriticalAlerts: true,
      },
    })
    return requested.granted
  } catch {
    return false
  }
}

/**
 * Sind Critical Alerts tatsächlich erlaubt?
 *
 * Nur wenn Apple die Berechtigung erteilt hat, der Eintrag in app.json gesetzt
 * ist und die Person zugestimmt hat. Sonst wird auf «zeitkritisch»
 * ausgewichen – das durchbricht immerhin Fokus-Modi.
 */
export async function criticalAlertsGranted(): Promise<boolean> {
  try {
    const status = await Notifications.getPermissionsAsync()
    return Boolean(status.granted && status.ios?.allowsCriticalAlerts)
  } catch {
    return false
  }
}

/**
 * Inhalt einer Alarmmeldung zusammensetzen.
 *
 * Bei einem nicht stillen Alarm wird ein Critical Alert verschickt: Ton auch bei
 * stummgeschaltetem Telefon. Fehlt die Berechtigung, wird auf «zeitkritisch»
 * ausgewichen, das immerhin Fokus-Modi durchbricht.
 */
async function alarmInhalt(title: string, body: string, kritisch: boolean) {
  if (!kritisch) {
    return { title, body, sound: 'default' as const, interruptionLevel: 'active' as const }
  }
  const critical = await criticalAlertsGranted()
  return {
    title,
    body,
    sound: critical ? ('defaultCritical' as const) : ('default' as const),
    interruptionLevel: critical ? ('critical' as const) : ('timeSensitive' as const),
  }
}

/**
 * Sofortige lokale Benachrichtigung (z. B. Alarm ausgelöst).
 * `kritisch` steht für einen nicht stillen Alarm.
 */
export async function notifyNow(title: string, body: string, kritisch = false, daten?: PushDaten) {
  if (kritisch && Platform.OS === 'android' && notifee()) {
    await ensureAlarmChannel()
    await androidAlarmAnzeigen(title, body, daten)
    return
  }
  try {
    await ensureAlarmChannel()
    await Notifications.scheduleNotificationAsync({
      content: { ...(await alarmInhalt(title, body, kritisch)), data: { ...(daten ?? {}) } as Record<string, unknown> },
      trigger: null,
    })
  } catch {
    // ohne Berechtigung kein Banner – App-Anzeige reicht
  }
}

/** Lokale Benachrichtigung zu einem Zeitpunkt planen (z. B. Timer-Ablauf) */
export async function scheduleAt(title: string, body: string, timestamp: number, kritisch = false): Promise<string | null> {
  if (timestamp <= Date.now()) return null
  if (kritisch && Platform.OS === 'android' && notifee()) {
    await ensureAlarmChannel()
    return androidAlarmPlanen(title, body, timestamp)
  }
  try {
    await ensureAlarmChannel()
    return await Notifications.scheduleNotificationAsync({
      content: await alarmInhalt(title, body, kritisch),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timestamp) },
    })
  } catch {
    return null
  }
}

export async function cancelScheduled(ids: (string | null)[]) {
  for (const id of ids) {
    if (!id) continue
    if (id.startsWith(NOTIFEE_ID_PREFIX)) {
      await notifee()
        ?.default.cancelTriggerNotification(id.slice(NOTIFEE_ID_PREFIX.length))
        .catch(() => {})
      continue
    }
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
  }
}

/**
 * Zahl auf dem App-Symbol mit dem Zustand abgleichen (laufende Alarme, die mich
 * betreffen). Die Push-Nachrichten des Servers tragen dieselbe Zahl – so stimmt
 * das Symbol auch bei geschlossener App; hier wird sie beim Öffnen, Quittieren
 * und nach der Entwarnung nachgeführt. Android zeigt je nach Launcher einen
 * Punkt statt einer Zahl.
 */
export async function setAppBadge(anzahl: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, anzahl))
  } catch {
    // Ohne Berechtigung oder Launcher-Unterstützung bleibt das Symbol ohne Zahl
  }
}

/** Remote-Push: in Expo Go seit SDK 53 nicht verfügbar – erst im Development-/Store-Build */
export function remotePushAvailability(): { ok: boolean; reason?: string } {
  if (!Device.isDevice) {
    return { ok: false, reason: 'Simulator – Push nur auf echten Geräten.' }
  }
  if (Constants.appOwnership === 'expo') {
    return {
      ok: false,
      reason: 'Expo Go unterstützt keine Remote-Pushs (seit SDK 53). Lokale Benachrichtigungen (Timer, SOS) funktionieren. Für echte Pushs: Development-Build via «eas build».',
    }
  }
  return { ok: true }
}

/** Expo-Push-Token holen (für Versand über Expos Push-Dienst) */
/**
 * Antippen einer Mitteilung: Sofort für die laufende App, beim Kaltstart die
 * Mitteilung, über die die App geöffnet wurde. Gibt die Abmeldefunktion zurück.
 */
export function onNotificationTap(handler: (daten: PushDaten) => void): () => void {
  const lesen = (antwort: Notifications.NotificationResponse | null | undefined) => {
    const daten = antwort?.notification.request.content.data as PushDaten | undefined
    if (daten && (daten.alarmId || daten.scenarioId)) handler(daten)
  }
  const abo = Notifications.addNotificationResponseReceivedListener(lesen)
  Notifications.getLastNotificationResponseAsync().then(lesen).catch(() => {})

  // Android: Vollbild-Alarme laufen über notifee (siehe oben) und lösen daher auch dessen
  // eigene Ereignisse aus, nicht die von expo-notifications
  const n = notifee()
  let aboNotifee: (() => void) | undefined
  if (n) {
    const lesenNotifee = (daten: unknown) => {
      const pushDaten = daten as PushDaten | undefined
      if (pushDaten && (pushDaten.alarmId || pushDaten.scenarioId)) handler(pushDaten)
    }
    aboNotifee = n.default.onForegroundEvent(({ type, detail }) => {
      if (type !== n.EventType.PRESS && type !== n.EventType.DISMISSED) return
      stopAlarmSound()
      if (type === n.EventType.PRESS) lesenNotifee(detail.notification?.data)
    })
    n.default
      .getInitialNotification()
      .then((initial) => {
        if (!initial) return
        stopAlarmSound()
        lesenNotifee(initial.notification.data)
      })
      .catch(() => {})
  }

  return () => {
    abo.remove()
    aboNotifee?.()
  }
}

/**
 * Einmalig beim App-Start zu registrieren (in index.ts, nicht in einer Komponente) – notifee
 * erlaubt nur einen einzigen Background-Handler pro App. Stoppt den Alarmton, wenn eine
 * Vollbild-Meldung im Hintergrund angetippt oder weggewischt wird.
 */
export function registerAndroidAlarmBackgroundHandler(): void {
  const n = notifee()
  if (!n) return
  n.default.onBackgroundEvent(async ({ type }) => {
    if (type === n.EventType.PRESS || type === n.EventType.DISMISSED) {
      stopAlarmSound()
    }
  })
}

export async function getPushToken(): Promise<string | null> {
  try {
    const projectId: string | undefined =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined
    if (!projectId) return null
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch {
    return null
  }
}
