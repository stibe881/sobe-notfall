/**
 * Geplante Gerätemeldungen zur Alleinarbeit: Vorwarnung fünf Minuten vor
 * Ablauf und der Hinweis beim Ablauf selbst. Sie liegen in der Planung des
 * Betriebssystems und laufen auch ohne geöffnete App.
 *
 * Abgeglichen wird gegen den Zustand, nicht gegen einen Klick: Wird eine
 * Sitzung beendet, verlängert oder gar nicht in dieser App gestartet – etwa im
 * Portal oder auf einem zweiten Gerät –, zieht der Abgleich nach. Die
 * Zuordnung Sitzung → Meldungen überlebt dafür den App-Neustart; vorher lag
 * sie nur im Arbeitsspeicher, und eine beendete Sitzung meldete sich nach
 * einem Neustart trotzdem noch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { cancelScheduled, scheduleAt } from './notifications'
import type { LoneWorkSession } from './types'

const SPEICHER = 'sonnenberg-alleinarbeit-meldungen-v1'
const VORWARNUNG_MS = 5 * 60_000

/** sessionId → { geplante Meldungen, Ablauf, auf den sie geplant sind } */
type Eintraege = Record<string, { ids: (string | null)[]; expiresAt: number }>
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

async function plane(s: LoneWorkSession): Promise<(string | null)[]> {
  return Promise.all([
    scheduleAt(
      'Alleinarbeit: Timer läuft bald ab',
      `Noch 5 Minuten (${s.activity}) – Lebenszeichen geben, sonst wird alarmiert.`,
      s.expiresAt - VORWARNUNG_MS,
    ),
    scheduleAt(
      'Alleinarbeit: Alarm ausgelöst',
      `Timer abgelaufen (${s.activity}) – die gewählten Personen werden alarmiert.`,
      s.expiresAt,
      true,
    ),
  ])
}

/**
 * Meldungen mit den Sitzungen der angemeldeten Person abgleichen: laufende
 * planen oder auf einen neuen Ablauf umplanen, beendete und alarmierte
 * abbestellen.
 *
 * Läufe werden aneinandergereiht: Der Zustand wird alle paar Sekunden neu
 * geladen, und zwei gleichzeitige Läufe würden dieselbe Meldung doppelt
 * planen.
 */
let laeuft: Promise<void> = Promise.resolve()

export function alleinarbeitMeldungenAbgleichen(sitzungen: LoneWorkSession[]): Promise<void> {
  laeuft = laeuft.then(() => gleicheAb(sitzungen)).catch(() => {})
  return laeuft
}

async function gleicheAb(sitzungen: LoneWorkSession[]): Promise<void> {
  const bekannt = await lade()
  let veraendert = false

  for (const s of sitzungen) {
    const eintrag = bekannt[s.id]
    if (s.status === 'running') {
      // Unveränderter Ablauf: Die Planung steht bereits
      if (eintrag && eintrag.expiresAt === s.expiresAt) continue
      if (eintrag) await cancelScheduled(eintrag.ids)
      bekannt[s.id] = { ids: await plane(s), expiresAt: s.expiresAt }
      veraendert = true
      continue
    }
    // Beendet oder Alarm ausgelöst: Nichts steht mehr bevor
    if (!eintrag) continue
    await cancelScheduled(eintrag.ids)
    delete bekannt[s.id]
    veraendert = true
  }

  // Sitzungen, die es nicht mehr gibt (Abmeldung, anderes Gerät, Aufräumen)
  for (const sessionId of Object.keys(bekannt)) {
    if (sitzungen.some((s) => s.id === sessionId)) continue
    await cancelScheduled(bekannt[sessionId].ids)
    delete bekannt[sessionId]
    veraendert = true
  }

  if (veraendert) await speichere()
}
