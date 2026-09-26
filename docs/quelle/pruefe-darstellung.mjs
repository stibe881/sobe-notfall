/**
 * Prüft die App-Ansicht auf schmalen Geräten.
 *
 * Anlass: Im Kopf der App standen Logo, Name, Standort und Auslöseknopf in
 * einer Zeile. Auf einem 360-Pixel-Telefon lief der Untertitel unter den
 * Knopf und verdeckte den Standort – ausgerechnet die Angabe, die bestimmt,
 * wer alarmiert wird. Auf dem Entwicklerbildschirm war davon nichts zu
 * sehen; aufgefallen ist es erst auf einem echten Gerät.
 *
 * Geprüft wird nur die App-Vorschau (#/app). Sie spiegelt die Oberfläche,
 * die Mitarbeitende auf dem Telefon sehen; das Verwaltungsportal ist ein
 * Werkzeug für den Rechner und wird hier bewusst ausgelassen.
 *
 * WAS DIESE PRÜFUNG NICHT KANN
 * ----------------------------
 * Sie hätte den Fehler, der sie ausgelöst hat, nicht gefunden. Im Browser
 * war die Vorschau nie kaputt: Das CSS `truncate` (overflow:hidden) hat den
 * Untertitel sauber abgeschnitten. React Native kennt diesen Vorgabewert
 * nicht – dort steht `overflow: visible`, und ein <Text> schrumpft nicht
 * von selbst. Der Fehler bestand deshalb ausschliesslich in der gebauten
 * App und war nur auf einem echten Gerät zu sehen.
 *
 * Diese Prüfung ersetzt den Blick auf ein Telefon also nicht. Sie fängt,
 * was im Browser sichtbar ist – zu kleine Antippflächen, überstehende
 * Kästen, Überdeckungen innerhalb derselben Leiste. Für die App bleibt:
 * einen Entwicklungs-Build auf ein Gerät spielen und hinschauen.
 *
 * Drei Dinge, die man nur gerendert sieht:
 *   1. steht etwas seitlich über?
 *   2. überdeckt ein Bedienelement einen Text?
 *   3. ist eine Antippfläche kleiner als 24 Pixel hoch (WCAG 2.2 AA)?
 *
 * Voraussetzung: Alarmserver läuft, playwright-core ist vorhanden, und eine
 * Sitzungsdatei liegt vor (Playwright storageState nach einer Anmeldung).
 *
 *   npm run dev --prefix server
 *   SOBE_URL=http://localhost:3001 SOBE_SITZUNG=sitzung.json \
 *     node docs/quelle/pruefe-darstellung.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const BASIS = process.env.SOBE_URL ?? 'http://localhost:3001'
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium'
const SITZUNG = process.env.SOBE_SITZUNG
const BREITEN = [320, 360, 390, 430]
const REITER = ['Start', 'Szenarien', 'Alleinarbeit', 'Notruf', 'Profil']
/**
 * WCAG 2.2, Erfolgskriterium 2.5.8 «Target Size (Minimum)», Stufe AA.
 * 44 Pixel wären das Ideal (Stufe AAA und Apples Richtlinie); 24 ist das,
 * was verbindlich gilt. Die Prüfung meldet nur echte Verstösse – eine
 * Prüfung, die bei jedem Chip Alarm schlägt, wird bald ignoriert.
 */
const MINDESTHOEHE = 24

/** Im Browser ausgeführt */
function messen(MIN) {
  const sichtbar = (el) => {
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.1) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const rollbarUeber = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if (o === 'auto' || o === 'scroll') return true
    }
    return false
  }
  // Nur innerhalb der App-Vorschau messen, nicht im Rahmen des Portals
  const wurzel = document.querySelector('header')?.parentElement ?? document.body
  const inApp = (el) => wurzel.contains(el)
  const breite = wurzel.getBoundingClientRect().right
  const funde = []

  for (const el of wurzel.querySelectorAll('*')) {
    if (!sichtbar(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right > breite + 1.5 && !rollbarUeber(el)) {
      funde.push(`steht über: ${el.tagName.toLowerCase()} bis ${Math.round(r.right)}px (Rand ${Math.round(breite)}) – "${(el.textContent || '').trim().slice(0, 34)}"`)
    }
  }

  /**
   * Der nächste klebende oder feste Vorfahre.
   *
   * Nur Elemente mit demselben Vorfahren dürfen verglichen werden: Ein
   * klebender Kopf liegt zwangsläufig über gerolltem Inhalt – das ist sein
   * Zweck, kein Fehler. Ein Knopf, der seinen Nachbarn in derselben
   * klebenden Leiste verdeckt, ist dagegen genau der Fehler, um den es hier
   * geht.
   */
  const rahmen = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position
      if (pos === 'fixed' || pos === 'sticky') return p
    }
    return null
  }

  const bedienung = [...wurzel.querySelectorAll('button, a[href], [role=button]')].filter(sichtbar)
  const texte = [...wurzel.querySelectorAll('*')].filter(
    (el) => sichtbar(el) && inApp(el) &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) &&
      !el.closest('button, a[href], [role=button]'))

  for (const b of bedienung) {
    const br = b.getBoundingClientRect()
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30)
    if (br.height < MIN) funde.push(`zu klein (${Math.round(br.height)}px, nötig ${MIN}): "${name}"`)
    const bRahmen = rahmen(b)
    for (const t of texte) {
      if (rahmen(t) !== bRahmen) continue
      const tr = t.getBoundingClientRect()
      if (br.left < tr.right - 1 && tr.left < br.right - 1 && br.top < tr.bottom - 1 && tr.top < br.bottom - 1) {
        funde.push(`überdeckt: "${name}" liegt auf "${t.textContent.trim().slice(0, 34)}"`)
      }
    }
  }
  return [...new Set(funde)]
}

if (!SITZUNG || !existsSync(SITZUNG)) {
  console.error('SOBE_SITZUNG fehlt oder zeigt ins Leere – ohne Anmeldung gibt es keine App-Vorschau.')
  process.exit(2)
}

const browser = await chromium.launch({ executablePath: BROWSER })
let gesamt = 0

for (const w of BREITEN) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 900 }, isMobile: true, hasTouch: true, storageState: SITZUNG,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASIS}/#/app`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  for (const reiter of REITER) {
    const ziel = page.locator(`text="${reiter}"`).last()
    if (await ziel.count()) { await ziel.click().catch(() => {}); await page.waitForTimeout(700) }
    // Ans Seitenende rollen: Eine feste Reiterleiste liegt zwangsläufig über
    // mittigem Inhalt – das ist ihr Zweck. Ein Fehler ist es erst, wenn der
    // letzte Inhalt nicht darunter hervorkommt.
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const funde = await page.evaluate(messen, MINDESTHOEHE)
    gesamt += funde.length
    console.log(`${String(w).padStart(3)}px ${reiter.padEnd(13)} ${funde.length === 0 ? 'OK' : funde.length + ' Befund(e)'}`)
    funde.slice(0, 4).forEach((f) => console.log('         ' + f))
  }
  await ctx.close()
}

await browser.close()
console.log(`\n${gesamt === 0 ? `Keine Befunde (${BREITEN.join(', ')} Pixel; Antippflächen ab ${MINDESTHOEHE}px).` : gesamt + ' Befund(e) insgesamt.'}`)
process.exit(gesamt === 0 ? 0 : 1)
