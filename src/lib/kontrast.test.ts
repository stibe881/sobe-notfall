/**
 * Wacht über die Lesbarkeit der Textfarben.
 *
 * WCAG AA verlangt 4.5:1 für normalen Text. Bis September 2026 lag die
 * leiseste Stufe bei 2.56:1 – an einem Kompetenzzentrum mit dem Schwerpunkt
 * Sehen die falsche Stelle zum Sparen, und in einer App, die unter Stress
 * und oft im Gehen gelesen wird, erst recht.
 *
 * Die Prüfung liest die Farben aus den Quellen statt sie zu wiederholen:
 * Wer eine Farbe ändert, merkt es hier sofort.
 */
import { readFileSync, readdirSync } from 'node:fs'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

const SCHWELLE = 4.5

function helligkeit(hex: string): number {
  const h = hex.replace('#', '')
  const teile = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const linear = teile.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function kontrast(vordergrund: string, hintergrund: string): number {
  const [hell, dunkel] = [helligkeit(vordergrund), helligkeit(hintergrund)].sort((a, b) => b - a)
  return (hell + 0.05) / (dunkel + 0.05)
}

/** Farbwerte aus einer Quelldatei lesen, damit die Prüfung nicht veraltet */
function farbenAus(pfad: string, ab?: string): Record<string, string> {
  let text = readFileSync(pfad, 'utf8')
  if (ab) text = text.slice(text.indexOf(ab))
  const gefunden: Record<string, string> = {}
  for (const [, name, wert] of text.matchAll(/'?([\w-]+)'?:\s*'(#[0-9a-fA-F]{6})'/g)) {
    if (!(name in gefunden)) gefunden[name] = wert
  }
  return gefunden
}

// ---------- App ----------
const app = farbenAus('mobile/src/ui.tsx', 'export const colors')
const APP_GRUENDE = ['card', 'bg', 'brandBg', 'alarmBg', 'amberBg', 'greenBg', 'violetBg']
const APP_TEXTE = ['text', 'muted', 'faint', 'brand', 'alarm', 'amber', 'green', 'violet']

for (const t of APP_TEXTE) {
  const schlechteste = Math.min(...APP_GRUENDE.map((g) => kontrast(app[t], app[g])))
  pruefe(`App: «${t}» hält auf jeder Fläche (${schlechteste.toFixed(2)}:1)`, schlechteste >= SCHWELLE)
}
for (const flaeche of ['brand', 'alarm', 'green', 'dark']) {
  const v = kontrast('#ffffff', app[flaeche])
  pruefe(`App: weisse Schrift auf «${flaeche}» (${v.toFixed(2)}:1)`, v >= SCHWELLE)
}
// Der App-Kopf ist dunkel – dort muss die leise Schrift heller werden, nicht dunkler
const kopfSchrift = (readFileSync('mobile/App.tsx', 'utf8').match(/headerSub: \{ color: '(#[0-9a-fA-F]{6})'/) ?? [])[1]
pruefe('App: Kopfzeile auf dunklem Grund lesbar',
  !!kopfSchrift && kontrast(kopfSchrift, app.dark) >= SCHWELLE)

// ---------- Portal ----------
const portal = farbenAus('tailwind.config.js')
const PORTAL_HELL = ['#ffffff', '#f1f5f9', '#eaf2f1']
const PORTAL_DUNKEL = ['#0f172a', '#1e293b', '#334155']

for (const stufe of ['muted', 'faint']) {
  const schlechteste = Math.min(...PORTAL_HELL.map((g) => kontrast(portal[stufe], g)))
  pruefe(`Portal: «${stufe}» hält auf hellem Grund (${schlechteste.toFixed(2)}:1)`, schlechteste >= SCHWELLE)
}
const dunkelSchlechteste = Math.min(...PORTAL_DUNKEL.map((g) => kontrast(portal['faint-dunkel'], g)))
pruefe(`Portal: «faint-dunkel» hält auf dunklem Grund (${dunkelSchlechteste.toFixed(2)}:1)`,
  dunkelSchlechteste >= SCHWELLE)

// ---------- Die schwachen Vorgänger dürfen nicht zurückkehren ----------
// slate-400 und slate-500 halten auf hellem Grund nicht (2.56 bzw. 4.34:1).
// Im dunklen Rahmen sind sie richtig – dort stehen sie als «faint-dunkel».
const DUNKLER_RAHMEN = ['src/App.tsx', 'src/components/LoginScreen.tsx']
const hellSeiten = [
  ...readdirSync('src/pages').map((d) => `src/pages/${d}`),
  ...readdirSync('src/components').map((d) => `src/components/${d}`),
].filter((d) => d.endsWith('.tsx') && !DUNKLER_RAHMEN.includes(d))

for (const klasse of ['text-slate-400', 'text-slate-500']) {
  const betroffen = hellSeiten.filter((d) => readFileSync(d, 'utf8').includes(klasse))
  pruefe(`«${klasse}» steht auf keiner hellen Seite mehr${betroffen.length ? ' – noch in: ' + betroffen.join(', ') : ''}`,
    betroffen.length === 0)
}

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
