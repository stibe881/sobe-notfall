/**
 * Android-Gegenstück zur iOS-Live-Aktivität: Während einer laufenden
 * Alleinarbeit zeigt eine dauerhafte Benachrichtigung den Countdown bis zum
 * Ablauf – sichtbar auch auf dem Sperrbildschirm, nicht wegwischbar, ohne Ton.
 *
 * Umgesetzt mit Notifee (Chronometer-Countdown, «ongoing»). Das native Modul
 * gibt es nur im eigenen Build – in Expo Go und auf iOS passiert schlicht
 * nichts.
 */
import { Platform } from 'react-native'
import type { LoneWorkSession } from './types'

type Modul = typeof import('@notifee/react-native')

let geladen: Modul | null | undefined
function modul(): Modul | null {
  if (geladen !== undefined) return geladen
  if (Platform.OS !== 'android') return (geladen = null)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geladen = require('@notifee/react-native') as Modul
  } catch {
    geladen = null
  }
  return geladen
}

const KANAL_TIMER = 'alleinarbeit-timer'
const MELDUNG_ID = 'alleinarbeit-countdown'

/**
 * Enthält dieser Build die Countdown-Benachrichtigung? In Expo Go und in
 * Builds vor der Android-Erweiterung fehlt das native Modul – die
 * Alleinarbeits-Ansicht zeigt dann einen Hinweis statt still nichts.
 */
export function androidCountdownVerfuegbar(): boolean {
  return Platform.OS === 'android' && modul() !== null
}

/** Zuletzt angezeigter Stand – nicht bei jedem Datenabgleich neu zeichnen */
let angezeigt: { sessionId: string; expiresAt: number } | null = null

/**
 * Countdown mit dem Zustand abgleichen: Läuft eine Alleinarbeit, wird die
 * Benachrichtigung angezeigt oder nachgeführt; sonst verschwindet sie.
 */
export async function alleinarbeitAndroidAbgleichen(sitzungen: LoneWorkSession[]): Promise<void> {
  const m = modul()
  if (!m) return
  const notifee = m.default

  // Die App kennt pro Person höchstens einen laufenden Timer; zur Sicherheit
  // gewinnt der zuletzt ablaufende
  const laufend = sitzungen
    .filter((s) => s.status === 'running' && s.expiresAt > Date.now())
    .sort((a, b) => b.expiresAt - a.expiresAt)[0]

  try {
    if (!laufend) {
      if (angezeigt) {
        angezeigt = null
        await notifee.cancelNotification(MELDUNG_ID)
      }
      return
    }
    if (angezeigt && angezeigt.sessionId === laufend.id && angezeigt.expiresAt === laufend.expiresAt) return

    await notifee.createChannel({
      id: KANAL_TIMER,
      name: 'Alleinarbeits-Timer',
      description: 'Laufender Countdown der Alleinarbeit – ohne Ton.',
      importance: m.AndroidImportance.LOW,
      vibration: false,
    })
    await notifee.displayNotification({
      id: MELDUNG_ID,
      title: 'Alleinarbeit läuft',
      body: `${laufend.activity} – bei Ablauf wird alarmiert. Lebenszeichen in der App geben.`,
      android: {
        channelId: KANAL_TIMER,
        // Vom expo-notifications-Plugin erzeugtes monochromes Icon
        smallIcon: 'notification_icon',
        color: '#c81e1e',
        ongoing: true,
        onlyAlertOnce: true,
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: laufend.expiresAt,
        pressAction: { id: 'default' },
      },
    })
    angezeigt = { sessionId: laufend.id, expiresAt: laufend.expiresAt }
  } catch (fehler) {
    // Anzeige ist Komfort – der Timer selbst läuft in App und Server weiter.
    // Der Grund landet im Geräteprotokoll (adb logcat), statt still verloren zu gehen.
    console.warn('[alleinarbeit] Countdown-Benachrichtigung fehlgeschlagen:', (fehler as Error).message)
  }
}
