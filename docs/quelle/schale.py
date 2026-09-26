# -*- coding: utf-8 -*-
"""Gemeinsame Hülle und Gestaltung der vier Handbücher.

Folgt dem Corporate Design von SONNENBERG, wie es die Word-Vorlage vorgibt:

  Hausfarbe   #1C504B (Logo, Fusszeile, Titellinie)
  Hausschrift Segoe UI
  Titelseite  grosses Logo rechts, darunter Titelblock mit Linie
  Folgeseiten kleines Logo links oben
  Fusszeile   dreizeilig, zweispaltig, 8 pt in der Hausfarbe
  Seite       A4, Ränder oben/links/rechts 25 mm, unten 20 mm

Segoe UI liegt auf Windows-Rechnern vor. Damit die Handbücher auch auf
anderen Systemen und im Browser stimmig aussehen, folgt Source Sans 3 als
nächstverwandte Rückfallschrift.

Auf dem Telefon gelesen
-----------------------
Mitarbeitende öffnen die Handbücher aus der App heraus, also auf einem
Telefon. Dafür gilt:

  * <meta name="viewport"> ist zwingend. Ohne die Angabe rendert jedes
    Telefon mit 980 Pixeln Breite und verkleinert anschliessend - die Regeln
    für schmale Bildschirme greifen dann gar nicht erst.
  * Nichts darf seitlich überstehen. Lange Pfade, Adressen und Bedienpfade
    brechen um; Befehlsblöcke bekommen einen eigenen rollbaren Kasten.
  * Tabellen ab drei Spalten werden zu Karten, eine Zeile je Karte. Die
    Beschriftung setzt bauen.py aus dem <thead> - von Hand gepflegt würde
    sie sich früher oder später von der Kopfzeile lösen.
  * Der Druck bleibt davon unberührt: dort gelten weiter A4 und echte
    Tabellen.
"""

STIL = """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap">
<style>
:root {
  /* Hausfarbe aus der Word-Vorlage: Logo #19504B, Fusszeile und Titellinie #1C504B */
  --haus: #1c504b;
  --haus-tief: #123634;
  --haus-hauch: #b9d3d0;
  --haus-schleier: #eef4f3;

  --grund: #f5f7f6;
  --flaeche: #ffffff;
  --flaeche-still: #eaf1ef;
  --tinte: #14201e;
  --tinte-leise: #3f504d;
  --tinte-fein: #6d817e;
  --linie: #dbe6e4;
  --linie-stark: #b7c9c6;
  --rahmen-geraet: #d5e3e1;

  --gut: #0f7051;
  --warnung: #9a5b06;
  --stopp: #b4232b;

  --haus-schrift: "Segoe UI", "Source Sans 3", "Frutiger", "Helvetica Neue", Arial, sans-serif;
  --mass: 68ch;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --haus: #63b5aa;
    --haus-tief: #8bcbc2;
    --haus-hauch: #2c5b56;
    --haus-schleier: #172624;
    --grund: #101715;
    --flaeche: #17211f;
    --flaeche-still: #1a2624;
    --tinte: #e7efed;
    --tinte-leise: #b0c1be;
    --tinte-fein: #839694;
    --linie: #24322f;
    --linie-stark: #3a4b48;
    --rahmen-geraet: #2b3a37;
    --gut: #3fbc8d;
    --warnung: #d9a441;
    --stopp: #f2696e;
  }
}
:root[data-theme="dark"] {
  --haus: #63b5aa;
  --haus-tief: #8bcbc2;
  --haus-hauch: #2c5b56;
  --haus-schleier: #172624;
  --grund: #101715;
  --flaeche: #17211f;
  --flaeche-still: #1a2624;
  --tinte: #e7efed;
  --tinte-leise: #b0c1be;
  --tinte-fein: #839694;
  --linie: #24322f;
  --linie-stark: #3a4b48;
  --rahmen-geraet: #2b3a37;
  --gut: #3fbc8d;
  --warnung: #d9a441;
  --stopp: #f2696e;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--grund);
  color: var(--tinte);
  font-family: var(--haus-schrift);
  font-size: 17px;
  line-height: 1.62;
  -webkit-font-smoothing: antialiased;
  /* iOS bläht Text im Querformat sonst eigenmächtig auf */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* Kein Wort darf die Seite seitlich schieben - auf dem Telefon ist dafür kein Platz */
h1, h2, h3, h4, p, li, td, th, figcaption, dd, dt { overflow-wrap: break-word; }

.blatt { max-width: 980px; margin: 0 auto; padding: 0 28px 96px; }

/* ---------- Logo ---------- */
.logo { display: block; height: auto; }
.logo-hell { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .logo-dunkel { display: none; }
  :root:not([data-theme="light"]) .logo-hell { display: block; }
}
:root[data-theme="dark"] .logo-dunkel { display: none; }
:root[data-theme="dark"] .logo-hell { display: block; }

/* ---------- Titelseite ---------- */
.titelseite { padding: 44px 0 40px; }
.titel-logo { display: flex; justify-content: flex-end; margin-bottom: clamp(48px, 11vw, 128px); }
.titel-logo img { width: clamp(230px, 42vw, 420px); }

.rolle {
  font-weight: 700; font-size: 12.5px; letter-spacing: .17em;
  text-transform: uppercase; color: var(--haus); margin: 0 0 14px;
}
.titelseite h1 {
  font-weight: 700; font-size: clamp(38px, 6.4vw, 64px); line-height: 1.02;
  letter-spacing: -.022em; margin: 0; text-wrap: balance; color: var(--tinte);
}
/* Titel, Linie, Untertitel - der Titelblock aus der Word-Vorlage */
.titel-linie { border: 0; border-top: 1.5px solid var(--haus); margin: 20px 0 14px; }
.untertitel {
  font-weight: 600; font-size: clamp(18px, 2.3vw, 23px);
  color: var(--haus); margin: 0; letter-spacing: -.008em;
}
.vorspann { max-width: var(--mass); margin: 30px 0 0; font-size: 18.5px; color: var(--tinte-leise); }
.stand {
  font-size: 13px; color: var(--tinte-fein); margin-top: 34px;
  display: flex; flex-wrap: wrap; gap: 6px 24px;
}

/* ---------- Inhaltsverzeichnis ---------- */
.inhalt { padding: 40px 0 4px; border-top: 1px solid var(--linie); margin-top: 44px; }
.inhalt h2 {
  font-size: 11.5px; font-weight: 700; letter-spacing: .17em;
  text-transform: uppercase; color: var(--tinte-fein); margin: 0 0 16px;
}
.inhalt ol {
  list-style: none; margin: 0; padding: 0; max-width: none;
  display: grid; gap: 0 40px; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
}
.inhalt a {
  font-size: 15px; font-weight: 400; color: var(--tinte); text-decoration: none;
  display: flex; gap: 12px; align-items: baseline; padding: 7px 8px 7px 0;
  border-bottom: 1px solid var(--linie);
}
.inhalt a:hover, .inhalt a:focus-visible { color: var(--haus); }
.inhalt .zahl { font-variant-numeric: tabular-nums; color: var(--haus); font-weight: 700; min-width: 1.6em; }

/* ---------- Abschnitte ---------- */
section { padding-top: 56px; scroll-margin-top: 24px; }
h2.abschnitt {
  font-weight: 700; font-size: clamp(24px, 3.1vw, 32px); letter-spacing: -.018em;
  margin: 0 0 6px; display: flex; gap: 15px; align-items: baseline; text-wrap: balance;
}
h2.abschnitt .zahl { color: var(--haus); font-variant-numeric: tabular-nums; font-size: .74em; letter-spacing: 0; }
h3 { font-weight: 600; font-size: 20px; letter-spacing: -.01em; margin: 40px 0 8px; text-wrap: balance; }
h4 { font-weight: 600; font-size: 16px; margin: 26px 0 4px; color: var(--tinte); }

p, ul, ol { max-width: var(--mass); }
p { margin: 0 0 14px; }
ul, ol { margin: 0 0 16px; padding-left: 1.35em; }
li { margin-bottom: 7px; }
li::marker { color: var(--haus); }
strong { font-weight: 600; }
a { color: var(--haus-tief); }
code {
  font-weight: 600; font-size: .9em; background: var(--flaeche-still);
  border: 1px solid var(--linie); padding: .06em .38em; border-radius: 3px;
  /* Pfade und Adressen brechen notfalls mitten im Wort statt überzustehen */
  overflow-wrap: anywhere;
}

/* Befehlsblöcke: eigener Kasten, waagrecht rollbar statt überstehend */
pre {
  max-width: var(--mass); margin: 18px 0; padding: 14px 16px;
  background: var(--flaeche-still); border: 1px solid var(--linie); border-radius: 4px;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  font-size: 14.5px; line-height: 1.55;
}
pre code {
  background: none; border: 0; padding: 0; font-size: inherit;
  /* Befehle dürfen nicht mitten im Wort brechen - sie werden abgetippt */
  overflow-wrap: normal; white-space: pre;
}

/* Beschriftung eines Bedienelements aus der Anwendung */
.ui {
  font-weight: 600; color: var(--tinte);
  border-bottom: 2px solid var(--haus-hauch); padding-bottom: .04em; white-space: nowrap;
}

/* ---------- Schrittfolgen ---------- */
ol.schritte { list-style: none; padding: 0; counter-reset: schritt; max-width: var(--mass); }
ol.schritte > li { counter-increment: schritt; position: relative; padding: 0 0 16px 46px; margin: 0; }
ol.schritte > li::before {
  content: counter(schritt); position: absolute; left: 0; top: 1px;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--haus); color: #fff; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums;
}

/* ---------- Hinweiskästen ---------- */
.hinweis {
  max-width: var(--mass); margin: 22px 0; padding: 16px 20px;
  background: var(--haus-schleier); border-left: 3px solid var(--haus); border-radius: 0 3px 3px 0;
}
.hinweis > :last-child { margin-bottom: 0; }
.hinweis .marke-klein {
  font-weight: 700; font-size: 11px; letter-spacing: .15em;
  text-transform: uppercase; color: var(--haus); margin: 0 0 6px;
}
.hinweis--stopp { border-left-color: var(--stopp); background: var(--flaeche-still); }
.hinweis--stopp .marke-klein { color: var(--stopp); }
.hinweis--warnung { border-left-color: var(--warnung); background: var(--flaeche-still); }
.hinweis--warnung .marke-klein { color: var(--warnung); }
.hinweis--gut { border-left-color: var(--gut); background: var(--flaeche-still); }
.hinweis--gut .marke-klein { color: var(--gut); }

/* ---------- Abbildungen ---------- */
figure { margin: 26px 0; }
figure img { display: block; width: 100%; height: auto; }
figcaption { font-size: 13px; line-height: 1.5; color: var(--tinte-fein); margin-top: 9px; max-width: 62ch; }
figcaption b { font-weight: 700; color: var(--haus); font-variant-numeric: tabular-nums; letter-spacing: .03em; }
.bild-breit img { border: 1px solid var(--linie-stark); border-radius: 4px; }
/* Erst ausbrechen, wenn dafür wirklich Platz ist - sonst schiebt die Seite seitlich. */
@media (min-width: 1130px) {
  .bild-breit { margin-left: -60px; margin-right: -60px; }
  .bild-breit figcaption { margin-left: 60px; }
}
.geraet { max-width: 300px; }
.geraet img { border: 8px solid var(--rahmen-geraet); border-radius: 26px; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.geraet-reihe {
  display: grid; gap: 30px; margin: 28px 0;
  grid-template-columns: repeat(auto-fill, minmax(240px, 300px)); justify-content: start;
}
.geraet-reihe figure { margin: 0; }

/* ---------- Tabellen ---------- */
.tabelle-huelle { overflow-x: auto; margin: 22px 0; }
table { border-collapse: collapse; width: 100%; min-width: 480px; font-size: 15.5px; }
caption {
  font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  color: var(--tinte-fein); text-align: left; padding-bottom: 10px;
}
th, td { text-align: left; padding: 10px 14px 10px 0; border-bottom: 1px solid var(--linie); vertical-align: top; }
th { font-weight: 700; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--tinte-fein); border-bottom: 1px solid var(--linie-stark); }
td.ja { color: var(--gut); font-weight: 600; font-size: 14.5px; }
td.nein { color: var(--tinte-fein); font-weight: 600; font-size: 14.5px; }

/* ---------- Adressfuss aus der Vorlage ---------- */
.adressfuss {
  display: grid; grid-template-columns: max-content max-content;
  gap: 1px 34px; font-size: 12.5px; color: var(--haus); line-height: 1.5;
}
.adressfuss span:nth-child(1) { font-weight: 700; }

footer { margin-top: 80px; padding-top: 26px; border-top: 1.5px solid var(--haus); font-size: 13.5px; color: var(--tinte-fein); }
footer p { max-width: var(--mass); margin-bottom: 8px; }
footer .adressfuss { margin-top: 22px; }

:focus-visible { outline: 2px solid var(--haus); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }

/* ---------- Sprung zurück nach oben ----------
   Ein Handbuch von 40 Seiten hat am Telefon sonst keinen Weg zurück zum
   Inhaltsverzeichnis. Reines HTML, kein Skript. */
.nach-oben {
  position: fixed; right: 14px; bottom: 14px; z-index: 5;
  width: 46px; height: 46px; border-radius: 50%;
  display: none; align-items: center; justify-content: center;
  background: var(--haus); color: #fff; text-decoration: none;
  font-size: 19px; line-height: 1; box-shadow: 0 2px 8px rgba(0,0,0,.28);
}
.nach-oben:hover, .nach-oben:focus-visible { background: var(--haus-tief); }

/* Nur am Bildschirm: die A4-Druckbreite liegt in CSS-Pixeln ebenfalls unter 720. */
@media screen and (max-width: 720px) {
  body { font-size: 16.5px; }
  .blatt { padding: 0 18px 64px; }
  h2.abschnitt { flex-direction: column; gap: 2px; }
  .titel-logo { justify-content: flex-start; }

  .nach-oben { display: flex; }
  /* Erst zeigen, wenn es etwas gibt, wohin man zurückspringen kann */
  :root[data-oben] .nach-oben { opacity: 0; pointer-events: none; transition: opacity .18s; }
  :root[data-oben="weg"] .nach-oben { opacity: 1; pointer-events: auto; }

  /* Luft zusammenstreichen: am Telefon zählt jede Bildschirmhöhe */
  .titelseite { padding: 26px 0 26px; }
  .titel-logo { margin-bottom: clamp(28px, 9vw, 60px); }
  .vorspann { font-size: 17px; margin-top: 22px; }
  .stand { margin-top: 24px; gap: 4px 18px; }
  .inhalt { margin-top: 32px; padding-top: 30px; }
  section { padding-top: 40px; }
  h3 { margin-top: 30px; }

  /* Fingerkuppen brauchen mehr als 30 Pixel Höhe */
  .inhalt a { padding: 12px 8px 12px 0; min-height: 44px; align-items: center; }

  /* Ein Pfad wie «Einstellungen & Konfiguration › LoRaWAN-Netz» ist breiter
     als das Telefon - hier muss er umbrechen dürfen. */
  .ui { white-space: normal; }

  .hinweis { padding: 14px 16px; margin: 18px 0; }
  ol.schritte > li { padding-left: 40px; }
  figure { margin: 20px 0; }
  .geraet-reihe { gap: 22px; grid-template-columns: minmax(0, 300px); }
  .geraet { max-width: 100%; }

  /* Die Anschrift stapelt sich, statt zwei Spalten zu erzwingen */
  .adressfuss { grid-template-columns: 1fr; gap: 0; }
  .adressfuss span:nth-child(even) { margin-bottom: 7px; }

  footer { margin-top: 56px; }
}

/* ---------- Tabellen auf schmalen Geräten ----------
   Zwei Spalten passen noch. Drei oder vier werden zu Karten: jede Zeile ein
   Block, jeder Wert mit seiner Spaltenüberschrift davor. Das ist lesbar,
   ohne seitlich zu rollen. Die Beschriftung setzt der Bauschritt als
   data-spalte, damit sie sich nie von der Kopfzeile lösen kann. */
@media screen and (max-width: 620px) {
  table { min-width: 0; font-size: 15px; }
  th, td { padding-right: 10px; }

  .tabelle-huelle:has(table[data-stapeln]) { overflow-x: visible; }
  table[data-stapeln] { display: block; }
  table[data-stapeln] caption { display: block; }
  /* Die Kopfzeile bleibt für Vorlesewerkzeuge erhalten, verschwindet nur optisch */
  table[data-stapeln] thead {
    position: absolute; width: 1px; height: 1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  table[data-stapeln] tbody, table[data-stapeln] tr,
  table[data-stapeln] th, table[data-stapeln] td { display: block; }
  table[data-stapeln] tr {
    background: var(--flaeche); border: 1px solid var(--linie);
    border-radius: 4px; padding: 13px 15px; margin-bottom: 11px;
  }
  table[data-stapeln] th, table[data-stapeln] td { border: 0; padding: 0; }
  /* Die erste Zelle ist der Titel der Karte */
  table[data-stapeln] tbody tr > :first-child {
    font-weight: 700; font-size: 16.5px; color: var(--tinte);
    letter-spacing: -.01em; text-transform: none; margin-bottom: 2px;
  }
  table[data-stapeln] td[data-spalte]::before {
    content: attr(data-spalte); display: block;
    font-size: 11px; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: var(--tinte-fein);
    margin: 10px 0 1px;
  }
  /* Über dem Kartentitel braucht es keine Spaltenüberschrift - er ist der Gegenstand */
  table[data-stapeln] tbody tr > :first-child::before { display: none; }
  table[data-stapeln] td.ja, table[data-stapeln] td.nein { font-size: 15px; }
}

@media print {
  .nach-oben { display: none !important; }
  :root {
    --grund: #fff; --flaeche: #fff; --flaeche-still: #f1f5f4; --haus-schleier: #eef4f3;
    --tinte: #000; --tinte-leise: #1c1c1c; --tinte-fein: #4a5a58;
    --linie: #cfdad8; --linie-stark: #97aaa7; --rahmen-geraet: #dfe8e6;
  }
  /* Seitenmasse der Word-Vorlage; oben und unten bleibt Platz für Logo und Adresse. */
  @page { size: A4; margin: 30mm 25mm 27mm 25mm; }
  body { font-size: 10.5pt; }
  .blatt { max-width: none; padding: 0; }
  .logo-hell { display: none !important; }
  .logo-dunkel { display: block !important; }

  .titelseite { padding-top: 0; break-after: page; }
  .inhalt { margin-top: 0; border-top: 0; break-after: page; }
  section { break-before: auto; padding-top: 16px; }
  h2.abschnitt, h3, h4 { break-after: avoid; }
  /* Auf Papier gibt es kein vw - die Nummer bliebe sonst allein auf einer Zeile. */
  h2.abschnitt { display: block; font-size: 17pt; }
  h2.abschnitt .zahl { font-size: 1em; margin-right: .45em; }
  h3 { font-size: 12.5pt; margin-top: 20px; }
  h4 { font-size: 11pt; }
  p, li { orphans: 2; widows: 2; }
  .hinweis, .tabelle-huelle, ol.schritte > li, figcaption { break-inside: avoid; }
  figure { break-inside: avoid; margin: 14px 0; }
  /* Bildhöhe begrenzen, sonst reisst jede Abbildung eine halbe Leerseite auf. */
  .bild-breit { margin: 16px 0; max-width: 148mm; }
  .geraet { max-width: 56mm; }
  .geraet-reihe { grid-template-columns: repeat(auto-fill, 56mm); gap: 8mm; margin: 16px 0; }
  .geraet img { border-width: 4px; border-radius: 12px; box-shadow: none; }
  footer { margin-top: 40px; }
  footer .adressfuss { font-size: 8pt; }
  a { color: #000; text-decoration: none; }
}
</style>
"""

ADRESSE = """<div class="adressfuss">
  <span>SONNENBERG</span><span>T +41 41 767 78 33</span>
  <span>Landhausstrasse 20</span><span>info@sonnenberg-baar.ch</span>
  <span>6340 Baar</span><span>www.sonnenberg-baar.ch</span>
</div>"""

LOGO_KLEIN = """<img class="logo logo-dunkel" src="bilder/logo-sonnenberg.png" alt="SONNENBERG Kompetenzzentrum">
<img class="logo logo-hell" src="bilder/logo-sonnenberg-hell.png" alt="">"""


def titelseite(rolle, titel, untertitel, vorspann, stand='August 2026'):
    """Titelblock nach der Word-Vorlage: Logo rechts, dann Titel, Linie, Untertitel."""
    return f"""<header class="titelseite">
  <div class="titel-logo">{LOGO_KLEIN}</div>
  <p class="rolle">{rolle}</p>
  <h1>{titel}</h1>
  <hr class="titel-linie">
  <p class="untertitel">{untertitel}</p>
  <p class="vorspann">{vorspann}</p>
  <p class="stand"><span>Baar &middot; Menzingen &middot; Kloten</span><span>Stand: {stand}</span></p>
</header>"""


def seite(titel, koerper):
    # Ohne ausdrückliches charset raten Browser bei file:// und einfachen
    # Webservern windows-1252 - aus «Für» würde «FÃ¼r».
    #
    # Ohne viewport rendert jedes Telefon die Seite mit 980 Pixeln Breite und
    # verkleinert sie anschliessend: Die Schrift wird unlesbar klein und die
    # Regeln für schmale Bildschirme greifen gar nicht erst.
    kopf = (
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="color-scheme" content="light dark">\n'
        '<meta name="theme-color" content="#1c504b">\n'
        f'<title>{titel}</title>'
    )
    return f'{kopf}\n{STIL}\n<span id="oben"></span>\n{koerper}\n{NACH_OBEN}'


# Springt zurück zum Inhaltsverzeichnis. Das Handbuch hat sonst keinen Weg
# dorthin, sobald man einmal unten ist.
#
# Die vier Zeilen Skript blenden ihn aus, solange man oben steht. Fällt das
# Skript aus, bleibt der Knopf dauerhaft sichtbar und voll benutzbar - dieser
# Ausfall kostet also nichts.
NACH_OBEN = r'''<a class="nach-oben" href="#oben" aria-label="Zurück zum Seitenanfang" title="Zurück zum Seitenanfang">&uarr;</a>
<script>
  var wurzel = document.documentElement
  wurzel.dataset.oben = ''
  addEventListener('scroll', function () { wurzel.dataset.oben = scrollY > 600 ? 'weg' : '' }, { passive: true })
</script>'''
