# -*- coding: utf-8 -*-
"""Erzeugt die drei Handbücher aus den Inhaltsmodulen und der gemeinsamen Hülle.

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
