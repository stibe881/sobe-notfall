import type { LucideIcon } from 'lucide-react'
import {
  Siren,
  Activity, Bomb, Biohazard, Bus, ClipboardList, CloudLightning, DoorOpen, Droplets, Flame, Hand,
  HeartCrack, HeartPulse, LifeBuoy, LockOpen, Pill, Search, ServerCrash, ShieldAlert, Stethoscope, Users, ZapOff,
} from 'lucide-react'

/** Verfügbare Szenario-Icons: Schlüssel wird im Datenmodell gespeichert */
export const SCENARIO_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  'flame': { icon: Flame, label: 'Feuer' },
  'door-open': { icon: DoorOpen, label: 'Evakuierung' },
  'heart-pulse': { icon: HeartPulse, label: 'Medizin' },
  'shield-alert': { icon: ShieldAlert, label: 'Bedrohung' },
  'bomb': { icon: Bomb, label: 'Sprengstoff' },
  'lock-open': { icon: LockOpen, label: 'Einbruch' },
  'hand': { icon: Hand, label: 'Gewalt' },
  'server-crash': { icon: ServerCrash, label: 'IT-Ausfall' },
  'zap-off': { icon: ZapOff, label: 'Stromausfall' },
  'droplets': { icon: Droplets, label: 'Wasser' },
  'biohazard': { icon: Biohazard, label: 'Gefahrstoff' },
  'activity': { icon: Activity, label: 'Erdbeben' },
  'cloud-lightning': { icon: CloudLightning, label: 'Unwetter' },
  'stethoscope': { icon: Stethoscope, label: 'Pandemie' },
  'search': { icon: Search, label: 'Vermisst' },
  'users': { icon: Users, label: 'Krisenstab' },
  'bus': { icon: Bus, label: 'Transport' },
  'pill': { icon: Pill, label: 'Medikamente' },
  'heart-crack': { icon: HeartCrack, label: 'Todesfall' },
  'life-buoy': { icon: LifeBuoy, label: 'Psychische Krise' },
  'siren': { icon: Siren, label: 'SOS / Hilferuf' },
  'clipboard-list': { icon: ClipboardList, label: 'Allgemein' },
}

/** Migration: früher gespeicherte Emoji-Icons auf Icon-Schlüssel abbilden */
export const LEGACY_EMOJI_TO_ICON: Record<string, string> = {
  '🔥': 'flame',
  '🚪': 'door-open',
  '🚑': 'heart-pulse',
  '⚠️': 'shield-alert',
  '💣': 'bomb',
  '🔓': 'lock-open',
  '🥊': 'hand',
  '💻': 'server-crash',
  '⚡': 'zap-off',
  '💧': 'droplets',
  '☣️': 'biohazard',
  '🌍': 'activity',
  '🌪️': 'cloud-lightning',
  '😷': 'stethoscope',
  '🔍': 'search',
  '📉': 'users',
  '📋': 'clipboard-list',
}

export function ScenarioIcon({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  const key = SCENARIO_ICONS[name] ? name : LEGACY_EMOJI_TO_ICON[name] ?? 'clipboard-list'
  const Icon = SCENARIO_ICONS[key].icon
  return <Icon size={size} className={className} aria-hidden />
}
