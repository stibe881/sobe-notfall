/**
 * Live-Aktivität für laufende Alleinarbeit (iOS 16.2+): Countdown auf dem
 * Sperrbildschirm und in der Dynamic Island, ohne die App zu öffnen.
 *
 * Die Zuordnung Sitzung → Aktivität wird auf dem Gerät gemerkt, damit ein
 * Neustart der App eine laufende Aktivität noch beenden kann. In Expo Go und
 * auf Android fehlt das native Modul – dann passiert schlicht nichts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { LoneWorkSession } from './types'

type Modul = typeof import('expo-live-activity')

let geladen: Modul | null | undefined
function modul(): Modul | null {
  if (geladen !== undefined) return geladen
  if (Platform.OS !== 'ios') return (geladen = null)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geladen = require('expo-live-activity') as Modul
  } catch {
    geladen = null
  }
  return geladen
}

const SPEICHER = 'sonnenberg-live-activities-v1'
/** sessionId → { Aktivitäts-ID, zuletzt angezeigtes Ablaufdatum } */
type Eintraege = Record<string, { id: string; expiresAt: number }>
let eintraege: Eintraege | null = null

async function lade(): Promise<Eintraege> {
  if (eintraege) return eintraege
  try {
    eintraege = JSON.parse((await AsyncStorage.getItem(SPEICHER)) ?? '{}') as Eintraege
  } catch {
    eintraege = {}
  }
  return eintraege
}

async function speichere(): Promise<void> {
  await AsyncStorage.setItem(SPEICHER, JSON.stringify(eintraege ?? {})).catch(() => {})
}

/**
 * Gestaltung: durchscheinendes Alarmrot statt Hausfarbe – die laufende
 * Alleinarbeit soll auf dem Sperrbildschirm sofort als sicherheitsrelevant
 * auffallen. Die letzten beiden Hex-Stellen sind die Deckkraft (CC ≈ 80 %);
 * iOS legt die Farbe als Tönung über das Systemmaterial, der Hintergrund
 * scheint also durch. Antippen öffnet die Alleinarbeit.
 */
const GESTALTUNG = {
  backgroundColor: '#c81e1ecc',
  titleColor: '#ffffff',
  subtitleColor: '#ffdcdc',
  progressViewTint: '#ffc9c9',
  progressViewLabelColor: '#ffffff',
  deepLinkUrl: 'sobenotfall://alleinarbeit',
  timerType: 'circular' as const,
  imagePosition: 'left' as const,
  imageAlign: 'center' as const,
  imageSize: { width: 36, height: 36 },
}

function uhrzeit(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function zustandLaufend(s: LoneWorkSession) {
  return {
    title: 'Alleinarbeit läuft',
    subtitle: `${s.activity} · Lebenszeichen bis ${uhrzeit(s.expiresAt)}`,
    progressBar: { date: s.expiresAt },
    imageName: 'timer',
    dynamicIslandImageName: 'timer-klein',
  }
}

/**
 * Aktivitäten mit den Sitzungen der angemeldeten Person abgleichen:
 * laufende anzeigen oder nachführen, beendete und alarmierte abschliessen.
 */
export async function alleinarbeitAbgleichen(sitzungen: LoneWorkSession[]): Promise<void> {
  const m = modul()
  if (!m) return
  const bekannt = await lade()
  let veraendert = false

  for (const s of sitzungen) {
    const eintrag = bekannt[s.id]
    if (s.status === 'running') {
      try {
        if (!eintrag) {
          const id = m.startActivity(zustandLaufend(s), GESTALTUNG)
          if (id) {
            bekannt[s.id] = { id, expiresAt: s.expiresAt }
            veraendert = true
          }
        } else if (eintrag.expiresAt !== s.expiresAt) {
          m.updateActivity(eintrag.id, zustandLaufend(s))
          eintrag.expiresAt = s.expiresAt
          veraendert = true
        }
      } catch {
        // Ohne Berechtigung oder auf älteren Geräten gibt es keine Live-Aktivität
      }
      continue
    }
    if (!eintrag) continue
    try {
      m.stopActivity(eintrag.id, {
        title: s.status === 'alarm' ? 'Alarm ausgelöst' : 'Alleinarbeit sicher beendet',
        subtitle: s.status === 'alarm'
          ? `${s.activity} · Timer abgelaufen, Schulsanität und Hausdienst sind alarmiert`
          : `${s.activity} · zurückgemeldet um ${uhrzeit(Date.now())}`,
        progressBar: { progress: 1 },
        imageName: 'timer',
        dynamicIslandImageName: 'timer-klein',
      })
    } catch {
      // Aktivität ist womöglich schon vom System entfernt worden
    }
    delete bekannt[s.id]
    veraendert = true
  }

  // Sitzungen, die es nicht mehr gibt (z. B. nach Abmeldung): Aktivität schliessen
  for (const sessionId of Object.keys(bekannt)) {
    if (sitzungen.some((s) => s.id === sessionId)) continue
    try {
      m.stopActivity(bekannt[sessionId].id, { title: 'Alleinarbeit beendet', progressBar: { progress: 1 } })
    } catch {
      // siehe oben
    }
    delete bekannt[sessionId]
    veraendert = true
  }

  if (veraendert) await speichere()
}
