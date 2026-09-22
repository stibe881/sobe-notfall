import React from 'react'
import type { LucideIcon } from 'lucide-react-native'
import {
  Siren,
  Activity, Bomb, Biohazard, Bus, ClipboardList, CloudLightning, DoorOpen, Droplets, Flame, Hand,
  HeartCrack, HeartPulse, LifeBuoy, LockOpen, Pill, Search, ServerCrash, ShieldAlert, Stethoscope, Users, ZapOff,
} from 'lucide-react-native'

const ICONS: Record<string, LucideIcon> = {
  'flame': Flame,
  'door-open': DoorOpen,
  'heart-pulse': HeartPulse,
  'shield-alert': ShieldAlert,
  'bomb': Bomb,
  'lock-open': LockOpen,
  'hand': Hand,
  'server-crash': ServerCrash,
  'zap-off': ZapOff,
  'droplets': Droplets,
  'biohazard': Biohazard,
  'activity': Activity,
  'cloud-lightning': CloudLightning,
  'stethoscope': Stethoscope,
  'search': Search,
  'users': Users,
  'bus': Bus,
  'pill': Pill,
  'heart-crack': HeartCrack,
  'life-buoy': LifeBuoy,
  'siren': Siren,
  'clipboard-list': ClipboardList,
}

export function ScenarioIcon({ name, size = 24, color = '#64748b' }: { name: string; size?: number; color?: string }) {
  const Icon = ICONS[name] ?? ClipboardList
  return <Icon size={size} color={color} />
}
