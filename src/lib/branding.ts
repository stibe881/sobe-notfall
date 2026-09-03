/**
 * Akzentfarbe des Kunden auf die Hausfarben-Palette anwenden.
 *
 * Die Tailwind-Skala «brand» (50–700) hängt an CSS-Variablen (src/index.css).
 * Aus einer einzigen Kundenfarbe entstehen hier die Abstufungen: hellere
 * Töne durch Mischen mit Weiss, dunklere mit Schwarz – dieselbe Treppe, die
 * auch die Petrol-Vorgabe abbildet. Das Alarmrot bleibt unangetastet.
 */

const STUFEN: { stufe: number; mischung: number }[] = [
  // > 0: Anteil Weiss · < 0: Anteil Schwarz · 0: die Kundenfarbe selbst (600)
  { stufe: 50, mischung: 0.93 },
  { stufe: 100, mischung: 0.84 },
  { stufe: 200, mischung: 0.68 },
  { stufe: 400, mischung: 0.28 },
  { stufe: 500, mischung: 0.12 },
  { stufe: 600, mischung: 0 },
  { stufe: 700, mischung: -0.24 },
]

function hexZuRgb(hex: string): [number, number, number] | null {
  const treffer = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!treffer) return null
  const n = parseInt(treffer[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mische([r, g, b]: [number, number, number], anteil: number): [number, number, number] {
  const ziel = anteil >= 0 ? 255 : 0
  const a = Math.abs(anteil)
  const m = (k: number) => Math.round(k + (ziel - k) * a)
  return [m(r), m(g), m(b)]
}

/** Abstufungen 50–700 als RGB-Tripel-Strings («28 80 75») – null bei ungültiger Farbe */
export function akzentAbstufungen(hex: string): Map<number, string> | null {
  const rgb = hexZuRgb(hex)
  if (!rgb) return null
  return new Map(STUFEN.map(({ stufe, mischung }) => [stufe, mische(rgb, mischung).join(' ')]))
}

/**
 * Farbe anwenden (oder mit null auf die Petrol-Vorgabe zurückstellen).
 * Wirkt sofort auf alles, was brand-Klassen trägt – Anmeldemaske eingeschlossen.
 */
export function wendeAkzentfarbeAn(hex: string | null | undefined): void {
  const wurzel = document.documentElement
  const abstufungen = hex ? akzentAbstufungen(hex) : null
  if (!abstufungen) {
    for (const { stufe } of STUFEN) wurzel.style.removeProperty(`--brand-${stufe}`)
    return
  }
  for (const [stufe, wert] of abstufungen) wurzel.style.setProperty(`--brand-${stufe}`, wert)
}
