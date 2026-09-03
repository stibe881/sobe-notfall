# Benutzerhandbücher

Vier Handbücher, je eines pro Rolle – als PDF zum Ausdrucken und Verteilen und
als HTML zum Lesen im Browser.

| Für wen | Handbuch |
| --- | --- |
| Schulleitung, Systemverantwortliche | [handbuch-1-administration.html](handbuch-1-administration.html) |
| Krisenstabsmitglieder | [handbuch-2-krisenstab.html](handbuch-2-krisenstab.html) |
| alle Mitarbeitenden | [handbuch-3-mitarbeitende.html](handbuch-3-mitarbeitende.html) |
| Systemverantwortliche, technischer Betrieb | [handbuch-4-installation.html](handbuch-4-installation.html) |

Der Alarmserver liefert diesen Ordner unter `/handbuecher` mit aus; das Portal
verlinkt die Handbücher unter **Hilfe → Handbücher**. **Deshalb gilt: Nach jeder
inhaltlichen Änderung an `quelle/handbuch*.py` müssen die gebauten HTML-Dateien
neu erzeugt und mit committet werden** (`python3 docs/quelle/bauen.py`) – sonst
zeigt das Portal einen alten Stand.

Die PDF zum Ausdrucken und Verteilen entstehen mit einem Befehl (siehe unten)
und liegen bewusst nicht in der Versionsverwaltung: Sie sind erzeugt, wiegen
zusammen rund 19 MB, und jede Neuerzeugung bliebe für immer in der Historie.

Die Bildschirmfotos liegen in `bilder/` und stammen aus dem Demo-Modus – dort
sind keine echten Personendaten sichtbar.

## Corporate Design

Übernommen aus der Word-Vorlage der Schule:

| | |
| --- | --- |
| Hausfarbe | `#1C504B` – Logo, Fusszeile, Linie unter dem Titel |
| Hausschrift | Segoe UI; auf Systemen ohne Segoe UI folgt Source Sans 3 |
| Logo | `bilder/logo-sonnenberg.png`, dazu `-hell.png` für dunkle Untergründe |
| Titelseite | Logo rechts, darunter Titel, Linie, Untertitel |
| Folgeseiten | kleines Logo links oben |
| Fusszeile | Adressblock zweispaltig, 7 pt in der Hausfarbe, Seitenzahl rechts |
| Seite | A4, Ränder 25 mm; oben und unten kommt der Streifen für Logo und Adresse dazu |

Kopf- und Fusszeile stehen bewusst **nicht** im Stylesheet: Chrome legt beim
Drucken fest positionierte Elemente nicht in den Seitenrand, sondern über den
Text. Sie entstehen deshalb in `quelle/pdf-erzeugen.mjs` über Chromes eigene
Kopf- und Fusszeilenvorlagen. Wer die HTML-Fassung mit «Drucken» sichert,
bekommt dieselben Inhalte, aber ohne laufendes Logo – für ein Handbuch zum
Verteilen ist die PDF gedacht.

## Neu erzeugen

Der Text steht in `quelle/handbuch1.py` bis `quelle/handbuch4.py`, die
gemeinsame Gestaltung in `quelle/schale.py`. Abbildungsnummern vergibt das
Bauskript – eine Abbildung lässt sich also mitten im Dokument einfügen, ohne
den Rest nachzuziehen.

```bash
python3 docs/quelle/bauen.py          # -> docs/handbuch-*.html
node docs/quelle/pdf-erzeugen.mjs     # -> docs/handbuch-*.pdf
```

Für eine HTML-Fassung, die sich als einzelne Datei weitergeben lässt (Bilder
eingebettet, kein Ordner nötig):

```bash
python3 docs/quelle/bauen.py /pfad/zum/zielordner
```

## Bildschirmfotos neu aufnehmen

Nötig, sobald sich die Oberfläche ändert. Das Portal muss dafür laufen.

```bash
npm i -D playwright-core                      # einmalig
npm run dev                                   # in einem eigenen Fenster
node docs/quelle/bilder-aufnehmen.mjs         # -> docs/bilder/roh/*.png
python3 docs/quelle/bilder-verkleinern.py     # -> docs/bilder/*.webp
python3 docs/quelle/bauen.py && node docs/quelle/pdf-erzeugen.mjs
```

Das Skript meldet sich der Reihe nach als Administrator, Krisenstabsmitglied und
Mitarbeiterin an und klickt die Abläufe durch. Die Adresse des Portals lässt
sich mit `SOBE_URL`, der Pfad zum Browser mit `PLAYWRIGHT_CHROMIUM` vorgeben.
`bilder-verkleinern.py` braucht Pillow (`pip install Pillow`),
`pdf-erzeugen.mjs` zusätzlich `pdfinfo`, `pdfseparate` und `pdfunite` aus
Poppler.

Die Live-Bilder (`web-21` bis `web-28`) zeigen Zustände, die es nur gegen
einen laufenden Alarmserver gibt: Erstinbetriebnahme, erzwungener
Passwortwechsel, Live-Dashboard, der Dialog «Aktualisierung», der
Einrichtungsassistent, die Karten Organisation/Redundanz und App-Verbindung
sowie der Standby-Server mit laufendem Abgleich (für `web-26`/`web-28` sind
zwei gekoppelte Instanzen nötig). Sie entstehen von Hand gegen frisch
aufgesetzte Server und ändern sich selten.
