import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

// Benachrichtigungen auch anzeigen, wenn die App im Vordergrund ist
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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
        allowBadge: false,
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
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
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
  return () => abo.remove()
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
