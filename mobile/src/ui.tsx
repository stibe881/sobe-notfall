import React, { useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, Vibration, View } from 'react-native'

export const colors = {
  bg: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  dark: '#0f172a',
  text: '#1e293b',
  // Die drei Textstufen halten auf allen Untergründen (weiss, Seitengrund,
  // stille Fläche) mindestens 4.5:1 – die Schwelle der WCAG AA für normalen
  // Text. Vorher lag «faint» bei 2.56:1: An einem Kompetenzzentrum mit dem
  // Schwerpunkt Sehen war das die falsche Stelle zum Sparen, und in einer
  // App, die unter Stress und oft im Gehen gelesen wird, erst recht.
  muted: '#475569',
  faint: '#5b6b7f',
  // Hausfarbe aus dem Corporate Design (Petrol) – Kopf, Reiter, Akzente
  brand: '#1c504b',
  brandLight: '#2a6a63',
  brandBg: '#eaf2f1',
  // Alarmrot bleibt dem Alarmieren vorbehalten: SOS, Auslöseknöpfe, aktive Alarme, Notruf
  alarm: '#c81e1e',
  alarmLight: '#e02424',
  alarmBg: '#fff1f1',
  // Grün und Bernstein dienen auch als Textfarbe («3 kommen», «Fehlalarm
  // gemeldet») und müssen deshalb 4.5:1 halten – die helleren Vorgänger
  // #059669 und #b45309 lagen bei 3.3 bzw. 4.4:1 auf dem Seitengrund.
  green: '#047857',
  greenBg: '#d1fae5',
  violet: '#7c3aed',
  violetBg: '#ede9fe',
  amber: '#a9500a',
  amberBg: '#fef3c7',
}

export function Badge({ label, color = 'slate' }: { label: string; color?: 'slate' | 'green' | 'red' | 'violet' | 'amber' }) {
  const map = {
    slate: { bg: '#f1f5f9', fg: '#475569' },
    green: { bg: colors.greenBg, fg: colors.green },
    red: { bg: colors.alarmBg, fg: colors.alarm },
    violet: { bg: colors.violetBg, fg: colors.violet },
    amber: { bg: colors.amberBg, fg: colors.amber },
  }[color]
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>
}

/** Auslöse-Button mit Halte-Geste – gedrückt halten füllt den Button, bei 100 % wird ausgelöst. */
export function HoldButton({ onTrigger, label, hint = 'Zum Auslösen gedrückt halten', holdMs = 1200 }: {
  onTrigger: () => void
  label: string
  hint?: string
  holdMs?: number
}) {
  const progress = useRef(new Animated.Value(0)).current
  const [holding, setHolding] = useState(false)

  function start() {
    // Ohne diese Sperre löst ein zweites onPressIn während einer laufenden
    // Haltung (z. B. wenn das Touch-System bei einem langen Druck ein
    // erneutes PressIn ohne passendes PressOut dazwischen liefert) eine
    // zweite, unabhängige Animation mit eigenem Callback aus – und damit
    // denselben Alarm doppelt oder dreifach.
    if (holding) return
    setHolding(true)
    Animated.timing(progress, { toValue: 1, duration: holdMs, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        progress.setValue(0)
        setHolding(false)
        Vibration.vibrate([0, 120, 60, 120])
        onTrigger()
      }
    })
  }

  function stop() {
    setHolding(false)
    Animated.timing(progress, { toValue: 0, duration: 120, useNativeDriver: true }).start()
  }

  return (
    <Pressable onPressIn={start} onPressOut={stop} style={styles.holdButton}>
      <Animated.View
        // Läuft über den Native-Treiber statt über width%: Sonst hängt die
        // Rückmeldung am JS-Thread – ist der gerade mit Zustands-Abgleich
        // beschäftigt (z. B. während eines laufenden Alarms), wirkt der Knopf
        // träge oder ganz ohne Reaktion, was zu wiederholtem, mehrfachem
        // Drücken und damit mehrfacher Alarmauslösung verleitet.
        style={[styles.holdFill, { transform: [{ scaleX: progress }] }]}
      />
      <Text style={styles.holdLabel}>{label}</Text>
      <Text style={styles.holdHint}>{holding ? 'Halten…' : hint}</Text>
    </Pressable>
  )
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'gerade eben'
  if (diff < 3600_000) return `vor ${Math.floor(diff / 60_000)} Min.`
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`
  return new Date(ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  holdButton: {
    backgroundColor: colors.alarmLight,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    // scaleX wächst von 0 auf 1 – Ursprung links, sonst wächst die Füllung
    // (wie transform es sonst tut) aus der Mitte statt von links
    transformOrigin: 'left',
    backgroundColor: colors.alarm,
  },
  holdLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  holdHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 3,
  },
})
