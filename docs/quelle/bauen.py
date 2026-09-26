# -*- coding: utf-8 -*-
"""Erzeugt die vier Handbücher aus den Inhaltsmodulen und der gemeinsamen Hülle.

    python3 docs/quelle/bauen.py                 -> docs/handbuch-*.html (Bilder aus docs/bilder/)
    python3 docs/quelle/bauen.py <verzeichnis>   -> zusätzlich eine Fassung mit eingebetteten
                                                    Bildern, die als einzelne Datei weitergegeben
                                                    werden kann
"""
import base64, io, itertools, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
EINGEBETTET = sys.argv[1] if len(sys.argv) > 1 else None

import schale, handbuch1, handbuch2, handbuch3, handbuch4

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATEIEN = [
    ('handbuch-1-administration', handbuch1),
    ('handbuch-2-krisenstab', handbuch2),
    ('handbuch-3-mitarbeitende', handbuch3),
    ('handbuch-4-installation', handbuch4),
]

# Ab so vielen Spalten wird eine Tabelle auf schmalen Geräten zur Karte.
# Zwei Spalten passen auch auf ein Telefon noch als Tabelle.
STAPELN_AB_SPALTEN = 3


def tabellen_beschriften(html):
    """Gibt jeder Körperzelle ihre Spaltenüberschrift als data-spalte mit.

    Auf schmalen Geräten löst die Gestaltung die Tabelle in Karten auf; dort
    steht die Überschrift dann über dem Wert. Von Hand gepflegt würde sich
    diese Beschriftung früher oder später von der Kopfzeile lösen - deshalb
    liest der Bauschritt sie jedes Mal neu aus dem <thead>.
    """
    def je_tabelle(treffer):
        tabelle = treffer.group(0)
        kopf = re.search(r'<thead>(.*?)</thead>', tabelle, re.S)
        if not kopf:
            return tabelle
        namen = [re.sub(r'<[^>]+>', '', z).replace('&nbsp;', '').strip()
                 for z in re.findall(r'<th[^>]*>(.*?)</th>', kopf.group(1), re.S)]
        if len(namen) < STAPELN_AB_SPALTEN:
            return tabelle

        koerper = re.search(r'<tbody>(.*?)</tbody>', tabelle, re.S)
        if not koerper:
            return tabelle

        def je_zeile(zeile_treffer):
            spalte = iter(namen)

            def je_zelle(zellen_treffer):
                marke, rest = zellen_treffer.group(1), zellen_treffer.group(2)
                name = next(spalte, '')
                # Die erste Zelle wird zum Titel der Karte und braucht keine
                # Beschriftung; leere Kopfzellen ebenso wenig.
                if not name or '"' in name:
                    return zellen_treffer.group(0)
                return f'<{marke} data-spalte="{name}"{rest}'

            return re.sub(r'<(td|th)((?:\s[^>]*)?>)', je_zelle, zeile_treffer.group(0))

        neuer_koerper = re.sub(r'<tr>.*?</tr>', je_zeile, koerper.group(1), flags=re.S)
        tabelle = tabelle.replace(koerper.group(1), neuer_koerper)
        return tabelle.replace('<table>', '<table data-stapeln>', 1)

    return re.sub(r'<table.*?</table>', je_tabelle, html, flags=re.S)


def einbetten(html):
    def ersetze(treffer):
        pfad = os.path.join(WURZEL, treffer.group(1))
        with open(pfad, 'rb') as f:
            daten = base64.b64encode(f.read()).decode('ascii')
        return f'src="data:image/webp;base64,{daten}"'
    return re.sub(r'src="(bilder/[^"]+)"', ersetze, html)

for name, modul in DATEIEN:
    koerper = (modul.KOERPER
               .replace('{TITELSEITE}', schale.titelseite(**modul.TITELSEITE))
               .replace('{ADRESSE}', schale.ADRESSE))
    seite = schale.seite(modul.TITEL, koerper)

    # Abbildungen fortlaufend nummerieren, damit sich beim Einfügen einer
    # weiteren Abbildung nichts von Hand nachziehen lässt.
    zaehler = itertools.count(1)
    seite = re.sub(r'<b>Abb\.</b>', lambda _: f'<b>Abb. {next(zaehler)}</b>', seite)

    seite = tabellen_beschriften(seite)

    fehlend = [b for b in re.findall(r'src="(bilder/[^"]+)"', seite)
               if not os.path.exists(os.path.join(WURZEL, b))]
    if fehlend:
        print('FEHLENDE BILDER in', name, fehlend)
        sys.exit(1)

    with io.open(f'{WURZEL}/{name}.html', 'w', encoding='utf-8') as f:
        f.write(seite)
    if EINGEBETTET:
        eingebettet = einbetten(seite)
        with io.open(f'{EINGEBETTET}/{name}.html', 'w', encoding='utf-8') as f:
            f.write(eingebettet)
        print(f'{name:34s} {len(seite)//1024:4d} KB · mit eingebetteten Bildern {len(eingebettet)//1024:5d} KB')
    else:
        print(f'{name:34s} {len(seite)//1024:4d} KB')
