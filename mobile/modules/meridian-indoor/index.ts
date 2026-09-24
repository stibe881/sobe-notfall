import { NativeModule, requireOptionalNativeModule } from 'expo'

/** Position, wie sie das Meridian-SDK liefert (siehe SOBEMeridianBridge.m / MeridianIndoorModule.kt) */
export interface MeridianRohPosition {
  mapId: string
  x: number
  y: number
  genauigkeitM?: number
  ermitteltAt: number
  quelle?: 'beacons' | 'wlan' | 'system' | 'unbekannt'
}

type MeridianEvents = {
  onLocation: (position: MeridianRohPosition) => void
  /** code: bluetooth · wlan · standort, wenn das SDK darum bittet, etwas einzuschalten */
  onError: (fehler: { message: string; code?: string }) => void
}

declare class MeridianIndoorModule extends NativeModule<MeridianEvents> {
  configure(token: string, region: 'us' | 'eu'): Promise<void>
  start(appId: string): Promise<void>
  stop(): Promise<void>
  getCurrentLocation(appId: string, timeoutMs: number): Promise<MeridianRohPosition | null>
}

/**
 * Das native Modul – oder null, wo es fehlt (Expo Go, Web, ein Build ohne
 * das Modul). Die App läuft dann ohne Indoor-Ortung weiter.
 */
export default requireOptionalNativeModule<MeridianIndoorModule>('MeridianIndoor')
