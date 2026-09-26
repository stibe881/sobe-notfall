/**
 * Was an den Push-Dienst geht – als reine Funktion, damit sie prüfbar ist.
 *
 * Aus push.ts herausgelöst, als die stille Testmeldung dazukam: Eine
 * Nachricht ohne Titel und Text, die kein Mensch sieht, aber deren Quittung
 * verrät, ob die App noch auf dem Gerät ist.
 */
export interface PushNachricht {
  title: string
  body: string
  data?: Record<string, unknown>
  /**
   * Nicht stiller Alarm: Ton auch bei stummgeschaltetem Telefon.
   * Geräte ohne bewilligte Critical-Alert-Berechtigung erhalten stattdessen
   * «time-sensitive» – das durchbricht immerhin Fokus-Modi.
   */
  critical?: boolean
  /**
   * Stiller Alarm: Die Mitteilung kommt an und erscheint auf dem Sperrbildschirm,
   * aber ohne Ton und ohne Vibration – niemand soll auf sich aufmerksam machen.
   */
  silent?: boolean
  /** Ohne Alarmton, aber wichtig genug, um Fokus-Modi zu durchbrechen (z. B. Entwarnung) */
  wichtig?: boolean
  /**
   * Unsichtbar: kein Titel, kein Text, kein Ton – nur Daten. Das Gerät zeigt
   * nichts an. Wozu dann? Der Push-Dienst quittiert auch diese Nachricht, und
   * eine Quittung «DeviceNotRegistered» heisst: App gelöscht. So werden tote
   * Geräte zwischen zwei Ernstfällen erkannt, ohne jede Woche alle
   * Mitarbeitenden mit einer Testmeldung zu stören.
   */
  unsichtbar?: boolean
}

export interface Nutzlastziel { token: string; userId: string; platform: string; criticalAlerts: boolean }

export const KANAL_ALARM = 'alarme-v2'
export const KANAL_STILL = 'alarme-still-v2'

export function pushNutzlast(ziel: Nutzlastziel, nachricht: PushNachricht, badge: number): Record<string, unknown> {
  if (nachricht.unsichtbar) {
    return {
      to: ziel.token,
      data: nachricht.data ?? {},
      // iOS: Hintergrundzustellung ohne Anzeige. Android: ohne title/body
      // zeigt expo-notifications nichts an.
      _contentAvailable: true,
      priority: 'normal',
      badge,
      ttl: 3600,
    }
  }

  // sound als Objekt ({critical, name, volume}) und interruptionLevel sind APNs-/
  // iOS-Eigenheiten. An ein Android-Gerät geschickt, kam das Sound-Objekt nicht als
  // gültiger Ton an – die Meldung blieb aus, obwohl der Versand bei Expo als
  // erfolgreich galt. Auf Android sorgt allein der Kanal (channelId, siehe
  // notifications.ts) für Lautstärke und «Nicht stören»-Umgehung; hier braucht es
  // nur einen simplen Ton oder gar keinen.
  const ios = ziel.platform === 'ios'
  return {
    to: ziel.token,
    title: nachricht.title,
    body: nachricht.body,
    data: nachricht.data ?? {},
    // Stiller Alarm: kein Ton – auf iOS entfällt damit auch die Vibration.
    // Echter Critical Alert braucht bei Apple das Sound-Objekt mit critical:
    // interruptionLevel allein durchbricht nur Fokus-Modi, nicht die
    // Stummschaltung. Nur an Geräte, deren Berechtigung gemeldet ist.
    sound: nachricht.silent
      ? null
      : ios && nachricht.critical && ziel.criticalAlerts
        ? { name: 'default', critical: true, volume: 1 }
        : 'default',
    priority: 'high',
    channelId: nachricht.silent ? KANAL_STILL : KANAL_ALARM,
    // Zahl auf dem App-Symbol (iOS; Android zeigt je nach Launcher Punkt oder Zahl)
    badge,
    // Critical Alert nur an Geräte, die ihn tatsächlich dürfen – sonst lehnt
    // Apple die Nachricht ab. Ohne Bewilligung bleibt «time-sensitive».
    // Ein stiller Alarm bleibt «time-sensitive»: sichtbar trotz Fokus, aber lautlos.
    // Nur für iOS gesetzt – auf Android ohne Bedeutung (dort zählt der Kanal).
    interruptionLevel: !ios
      ? undefined
      : nachricht.critical && !nachricht.silent
        ? (ziel.criticalAlerts ? 'critical' : 'time-sensitive')
        : nachricht.silent || nachricht.wichtig ? 'time-sensitive' : 'active',
    // Ein Alarm, der eine Stunde später eintrifft, hilft niemandem mehr
    ttl: nachricht.critical || nachricht.silent ? 3600 : undefined,
  }
}
