import { KANAL_ALARM, KANAL_STILL, pushNutzlast } from './pushnutzlast.js'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const ios = { token: 'ExponentPushToken[a]', userId: 'u-1', platform: 'ios', criticalAlerts: true }
const iosOhne = { ...ios, criticalAlerts: false }
const android = { ...ios, platform: 'android' }

// --- unsichtbar ---
const still = pushNutzlast(ios, { title: 'x', body: 'y', unsichtbar: true, data: { kind: 'test-still' } }, 0)
pruefe('unsichtbar: kein Titel, kein Text', !('title' in still) && !('body' in still))
pruefe('unsichtbar: kein Ton, kein Kanal', !('sound' in still) && !('channelId' in still))
pruefe('unsichtbar: Hintergrundzustellung für iOS', still._contentAvailable === true)
pruefe('unsichtbar: normale Priorität – das ist kein Alarm', still.priority === 'normal')
pruefe('unsichtbar: die Daten kommen mit', (still.data as { kind: string }).kind === 'test-still')

// --- die bisherigen Regeln bleiben ---
const laut = pushNutzlast(ios, { title: 'Alarm', body: 'Brand', critical: true }, 2)
pruefe('Critical Alert auf iOS mit Berechtigung: Sound-Objekt und «critical»',
  typeof laut.sound === 'object' && (laut.sound as { critical: boolean }).critical === true && laut.interruptionLevel === 'critical')
pruefe('Abzeichen wird mitgegeben', laut.badge === 2)
pruefe('Alarm läuft über den Alarmkanal', laut.channelId === KANAL_ALARM)
pruefe('ohne Berechtigung nur «time-sensitive» und einfacher Ton',
  pushNutzlast(iosOhne, { title: 'A', body: 'B', critical: true }, 0).interruptionLevel === 'time-sensitive' &&
  pushNutzlast(iosOhne, { title: 'A', body: 'B', critical: true }, 0).sound === 'default')
pruefe('Android bekommt nie ein Sound-Objekt',
  pushNutzlast(android, { title: 'A', body: 'B', critical: true }, 0).sound === 'default')
pruefe('Android bekommt kein interruptionLevel',
  pushNutzlast(android, { title: 'A', body: 'B', critical: true }, 0).interruptionLevel === undefined)
const stiller = pushNutzlast(ios, { title: 'A', body: 'B', silent: true }, 0)
pruefe('stiller Alarm: kein Ton, stiller Kanal, aber sichtbar (Titel bleibt)',
  stiller.sound === null && stiller.channelId === KANAL_STILL && stiller.title === 'A')

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
