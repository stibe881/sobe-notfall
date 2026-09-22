import { Platform } from 'react-native'
import { requireNativeModule } from 'expo-modules-core'

/**
 * Natives Android-Modul: spielt den Alarmton über AudioAttributes.USAGE_ALARM ab, also über die
 * Wecker- statt der Benachrichtigungs-Lautstärke. Das bleibt – anders als ein Notification-Sound –
 * auch bei stummgeschaltetem oder auf 0 gestelltem Klingelton hörbar, wie ein Weckerklingeln.
 * Nur für Android gebaut (siehe expo-module.config.json); auf iOS übernehmen Critical Alerts
 * dieselbe Aufgabe, siehe CRITICAL-ALERTS.md.
 */
interface AlarmSoundNativeModule {
  play(): void
  stop(): void
}

let nativeModule: AlarmSoundNativeModule | null = null
if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule<AlarmSoundNativeModule>('AlarmSound')
  } catch {
    // Modul fehlt (Expo Go, oder Build ohne Prebuild) – Aufrufe unten werden dann zu No-ops
    nativeModule = null
  }
}

/** Startet den in Schleife laufenden Alarmton. Ohne Wirkung auf iOS oder ohne natives Modul. */
export function playAlarmSound(): void {
  try {
    nativeModule?.play()
  } catch {
    // kein Alarmton verfügbar – die Vollbild-/Vibrations-Meldung bleibt bestehen
  }
}

/** Beendet einen laufenden Alarmton. */
export function stopAlarmSound(): void {
  try {
    nativeModule?.stop()
  } catch {
    // nichts zu stoppen
  }
}
