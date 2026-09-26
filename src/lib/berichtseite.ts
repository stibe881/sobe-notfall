import { bilanz, type Ereignisbericht } from './ereignisbericht'

/**
 * Der Ereignisbericht als eigenständiges HTML-Dokument.
 *
 * Bewusst eine einzelne Datei ohne Fremdbezüge: Sie lässt sich ablegen, per
 * Mail weitergeben und in fünf Jahren noch öffnen – auch wenn es dieses
 * System dann nicht mehr gibt. Aus dem Browser heraus wird daraus mit
 * «Drucken» ein PDF, wie bei den Handbüchern.
 */

const zeit = (ms: number): string =>
  new Date(ms).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })

/** Fremdtext darf die Seite nicht zerlegen – Meldungen kommen von Menschen */
function sicher(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const STIL = `
  :root { --linie: #d9e2e0; --leise: #5b6b7f; --haus: #1c504b; }
  * { box-sizing: border-box; }
  body { font: 15px/1.6 "Segoe UI", "Source Sans 3", Arial, sans-serif; color: #14201e;
         max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .12em; color: var(--haus);
       margin: 34px 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid var(--haus); }
  .kopf { border-bottom: 1.5px solid var(--haus); padding-bottom: 14px; }
  .kopf p { margin: 2px 0; color: var(--leise); font-size: 14px; }
  .marke { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .1em;
           text-transform: uppercase; padding: 3px 9px; border-radius: 3px; margin-bottom: 8px; }
  .marke-uebung { background: #fef3c7; color: #92400e; }
  .marke-fehlalarm { background: #fff1f1; color: #b4232b; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 4px; }
  th, td { text-align: left; padding: 7px 10px 7px 0; border-bottom: 1px solid var(--linie); vertical-align: top; }
  th { font-size: 11.5px; text-transform: uppercase; letter-spacing: .09em; color: var(--leise); }
  td.zeit { white-space: nowrap; color: var(--leise); font-variant-numeric: tabular-nums; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 22px; margin: 0; font-size: 14.5px; }
  dt { color: var(--leise); }
  dd { margin: 0; }
  .zahlen { display: flex; flex-wrap: wrap; gap: 26px; margin: 10px 0 0; }
  .zahl b { display: block; font-size: 24px; line-height: 1.1; }
  .zahl span { font-size: 12.5px; color: var(--leise); }
  .offen { background: #f5f7f6; border-left: 3px solid var(--haus); padding: 12px 16px; margin-top: 8px; }
  .offen ul { margin: 6px 0 0; padding-left: 1.2em; }
  footer { margin-top: 44px; padding-top: 14px; border-top: 1px solid var(--linie);
           font-size: 12.5px; color: var(--leise); }
  @media print {
    body { max-width: none; padding: 0; font-size: 11pt; }
    @page { size: A4; margin: 20mm 18mm; }
    h2 { break-after: avoid; }
    tr { break-inside: avoid; }
  }
`

export function berichtHtml(b: Ereignisbericht, organisation: string, erzeugtAm = Date.now()): string {
  const z = bilanz(b)
  const titel = `Ereignisbericht ${b.szenario} ${new Date(b.ausgeloestAm).toLocaleDateString('de-CH')}`

  const zeilen = (inhalt: string[][]) => inhalt.map((sp) => `<tr>${sp.join('')}</tr>`).join('\n      ')

  return `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${sicher(titel)}</title>
<style>${STIL}</style>

<div class="kopf">
  ${b.uebung ? '<span class="marke marke-uebung">Übung – kein Ereignis</span>' : ''}
  ${b.fehlalarmGemeldet ? '<span class="marke marke-fehlalarm">Fehlalarm gemeldet</span>' : ''}
  <h1>Ereignisbericht</h1>
  <p>${sicher(organisation)}</p>
  <p>${sicher(b.szenario)} &middot; ${zeit(b.ausgeloestAm)}</p>
</div>

<h2>Das Ereignis</h2>
<dl>
  <dt>Szenario</dt><dd>${sicher(b.szenario)}</dd>
  <dt>Ausgelöst</dt><dd>${zeit(b.ausgeloestAm)}</dd>
  <dt>Ausgelöst von</dt><dd>${sicher(b.ausgeloestVon)}</dd>
  <dt>Ausgelöst über</dt><dd>${sicher(b.ausgeloestUeber)}</dd>
  <dt>Standort</dt><dd>${sicher(b.standorte)}</dd>
  <dt>Meldungstext</dt><dd>${sicher(b.meldung)}</dd>
  <dt>Art</dt><dd>${b.still ? 'stiller Alarm (ohne Ton)' : 'lauter Alarm'}</dd>
  <dt>Beendet</dt><dd>${b.beendetAm ? `${zeit(b.beendetAm)} (Dauer ${b.dauerMinuten} Minuten)` : '<i>noch aktiv</i>'}</dd>
  ${b.beendetHinweis ? `<dt>Hinweis zur Entwarnung</dt><dd>${sicher(b.beendetHinweis)}</dd>` : ''}
  <dt>Kennung</dt><dd>${sicher(b.kennung)}</dd>
</dl>

<h2>Alarmierung</h2>
<dl>
  <dt>Aufgebotene Gruppen</dt><dd>${sicher(b.gruppen)}</dd>
  <dt>Kanäle</dt><dd>${sicher(b.kanaele) || '<i>keine</i>'}</dd>
</dl>
<div class="zahlen">
  <div class="zahl"><b>${z.alarmiert}</b><span>alarmiert</span></div>
  <div class="zahl"><b>${z.zugesagt}</b><span>zugesagt</span></div>
  <div class="zahl"><b>${z.abgesagt}</b><span>abgesagt</span></div>
  <div class="zahl"><b>${z.ohneAntwort}</b><span>ohne Antwort</span></div>
</div>

<h2>Rückmeldungen</h2>
${b.rueckmeldungen.length === 0 ? '<p><i>Niemand wurde alarmiert.</i></p>' : `<table>
  <thead><tr><th>Person</th><th>Kanäle</th><th>Zustellung</th><th>Rückmeldung</th><th>Zeit</th></tr></thead>
  <tbody>
      ${zeilen(b.rueckmeldungen.map((r) => [
        `<td>${sicher(r.person)}</td>`,
        `<td>${sicher(r.kanaele)}</td>`,
        `<td>${r.zugestellt ? 'zugestellt' : 'nicht bestätigt'}</td>`,
        `<td>${r.antwort}</td>`,
        `<td class="zeit">${r.zeit ? zeit(r.zeit) : '–'}</td>`,
      ]))}
  </tbody>
</table>`}

<h2>Verlauf</h2>
${b.verlauf.length === 0 ? '<p><i>Keine Einträge.</i></p>' : `<table>
  <thead><tr><th>Zeit</th><th>Art</th><th>Eintrag</th></tr></thead>
  <tbody>
      ${zeilen(b.verlauf.map((v) => [
        `<td class="zeit">${zeit(v.zeit)}</td>`,
        `<td>${v.quelle}</td>`,
        `<td>${sicher(v.text)}</td>`,
      ]))}
  </tbody>
</table>`}

<h2>Von Hand zu ergänzen</h2>
<div class="offen">
  <p>Diese Angaben kennt das System nicht. Für eine behördliche Vorlage gehören
     sie dazu und sind vor der Weitergabe zu ergänzen:</p>
  <ul>${b.offeneFelder.map((f) => `<li>${sicher(f)}</li>`).join('')}</ul>
</div>

<footer>
  <p>Erzeugt am ${zeit(erzeugtAm)} aus dem Alarmjournal von SOBE Notfall.</p>
  <p>Der Bericht gibt wieder, was das System aufgezeichnet hat. Vorgänge
     ausserhalb der App &ndash; Telefonate, Entscheide vor Ort, Einsätze von
     Blaulichtorganisationen &ndash; sind darin nicht enthalten.</p>
</footer>
</html>`
}

/** Dateiname zum Ablegen: sortierbar und ohne Sonderzeichen */
export function berichtDateiname(b: Ereignisbericht): string {
  const d = new Date(b.ausgeloestAm)
  const zweistellig = (n: number) => String(n).padStart(2, '0')
  const datum = `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`
  const thema = b.szenario.toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `ereignisbericht-${datum}-${thema || 'alarm'}.html`
}
