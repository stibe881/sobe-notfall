# Styleguide

Kurzreferenz für Farben, Abstände und wiederkehrende Bausteine im Webportal
(`src/`) und der App (`mobile/src/`). Beide pflegen ihre Werte getrennt
(Tailwind-Config bzw. `colors`-Objekt in `mobile/src/ui.tsx`) – dieses
Dokument fasst zusammen, was dort schon einzeln (und mit Begründung)
festgehalten ist, damit es nicht bei jeder neuen Stelle neu erfunden wird.

## Farben

| Zweck | Web (Tailwind) | App (`colors.*`) | Hinweis |
|---|---|---|---|
| Hausfarbe / Akzent | `brand-500..700` (CSS-Variablen, kundenspezifisch) | `brand` `#1c504b` | Web: läuft über CSS-Variablen, damit die Akzentfarbe pro Kunde zur Laufzeit übernommen werden kann (`src/lib/branding.ts`). App: fest, da kein Laufzeit-Branding. |
| Alarm/Notfall | `alarm-500..700` | `alarm` `#c81e1e` | **Nur** für Alarmieren reserviert: SOS, Auslöseknöpfe, aktive Alarme, Notruf. Nicht für andere „wichtige“ Zustände zweckentfremden. |
| Text, leiseste Stufe | `text-faint` `#5b6b7f` | `colors.faint` | Hält **mindestens 4.5:1 (WCAG AA)** auf Weiss, Seitengrund und stiller Fläche. Der Vorgänger (`slate-400`, 2.56:1) galt als zu leise für ein Kompetenzzentrum mit Sehschwerpunkt – siehe Commit „Kontrast: alle Texte halten jetzt WCAG AA“. |
| Text, mittlere Stufe | `text-muted` `#475569` | `colors.muted` | Ebenfalls ≥4.5:1 auf allen drei Untergründen. |
| Text auf dunklem Grund | – | `faint-dunkel` `#a0aec0` (Web-Äquivalent: `slate-400` bleibt dort erlaubt) | Dunkler Grund braucht hellere, nicht dunklere Schrift für denselben Kontrast. |
| Erfolg / quittiert | `emerald-*` | `colors.green` `#047857` | Dient auch als **Textfarbe** („3 kommen“) – deshalb bewusst dunkler als ein reines UI-Grün. |
| Achtung / Übung | `amber-*` | `colors.amber` `#a9500a` | Gleicher Grund: als Text lesbar, nicht nur als Fläche. |
| Fehlermeldung/-hinweis | `violet-*` | `colors.violet` | Für Lagemeldungen, Fehlalarm-Kontext – nicht mit `alarm` verwechseln. |

**Regel, keine Ausnahme:** Eine Farbe, die auch als Textfarbe vorkommt
(„X kommen“, „Fehlalarm gemeldet“), muss für sich allein 4.5:1 Kontrast auf
Weiss, Seitengrund *und* der jeweiligen `*Bg`-Fläche halten. Vor einer neuen
Farbe: mit einem Kontrastrechner gegen alle drei Untergründe prüfen, nicht
nur gegen Weiss.

## Abstände, Ecken, Rahmen

- Karten: `rounded-2xl` (Web) / `borderRadius: 16` (App), `border` in
  `border-slate-200` bzw. `colors.border` (`#e2e8f0`).
- Kleinere Elemente (Chips, Badges, Eingabefelder): `rounded-xl` bzw.
  `rounded-full` für Pillen/Badges.
- Innenabstand von Karten: `p-4` (Web) / `padding: 16` (App) als Standard,
  `p-3`/`padding: 12` für dichtere Listen.
- Zwischen Abschnitten: `space-y-6` (Web-Seiten) bzw. `gap: 8`–`16` (App).

## Bausteine

- **`Card`** – die Grundfläche für alles, was optisch zusammengehört
  (Alarmkarten, Formularabschnitte). Kein eigenes Aussehen erfinden, wenn
  `Card` reicht.
- **`Badge`** – kurzer, farbiger Status-Chip (`aktiv`/`inaktiv`/`ÜBUNG`
  usw.). Fünf Farben (`slate`, `green`, `red`, `violet`, `amber`) – für einen
  neuen Zustand eine passende davon wählen, nicht die Palette erweitern,
  ausser der Zustand ist wirklich neuartig.
- **`Toggle`** (Web) – Ein/Aus-Schalter für Einstellungen. Für Checklisten
  und einmalige Bestätigungen stattdessen das Checkbox-Muster aus
  `styles.checkRow`/`styles.checkbox` (App) bzw. eine einfache
  `<input type="checkbox">`-Ersatzfläche (Web) verwenden – `Toggle` ist für
  dauerhafte Einstellungen gedacht, nicht für einmalige Aktionen.
- **`HoldButton`** – Halte-Geste statt Antippen für alles, was einen echten
  Alarm auslöst oder beendet (SOS, Krisenteam aufbieten, Alarmieren). *Nie*
  für harmlose Aktionen verwenden – die Halte-Geste signalisiert selbst
  schon „das hier ist folgenreich“. Zeigt während des Haltens die
  Restsekunden an (nicht nur „Halten…“), damit niemand aus Unsicherheit
  losslässt oder erneut drückt. Die Füllanimation läuft nativ
  (`useNativeDriver: true` bzw. `requestAnimationFrame`), nie über eine
  JS-Thread-abhängige Breiten-Animation – sonst wirkt der Knopf unter Last
  träge, was zu Mehrfachauslösung verleitet (siehe Bugfix „HoldButton löste
  bei doppeltem PressIn denselben Alarm mehrfach aus“).

## Leere Zustände

Vorbild ist `src/pages/Soforthilfe.tsx`: Ein leerer/unkonfigurierter Zustand
bekommt einen eigenen, freundlichen Hinweistext, der erklärt, *warum* es
leer ist und was als Nächstes zu tun ist – nicht einfach eine leere Liste
oder ein technisches „Keine Daten“.

## Sprache

- Durchgehend Deutsch, „Sie“-Form, keine Anglizismen wo ein deutsches Wort
  ebenso klar ist.
- Kommentare im Code erklären das *Warum*, nie das *Was* – Variablennamen
  und Funktionsnamen sind selbst schon auf Deutsch und sprechend.
