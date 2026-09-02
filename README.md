# SOBE Notfall- & Krisenmanagement

Webapp für das Notfall- und Krisenmanagement des SONNENBERG Kompetenzzentrums (heilpädagogische Schule)
mit den Standorten **Baar (Hauptsitz), Menzingen und Kloten** – inspiriert vom Funktionsumfang von e-mergency®:
Alarmserver, Multikanal-Alarmierung, Notfallszenarien mit Handlungsanweisungen und Alleinarbeiterschutz.

## Funktionsübersicht

### 01 Vorbereitung (Admin-Web)
- **Szenarien & Checklisten (CMS):** 22 vorkonfigurierte, heilpädagogisch-schulische Notfallszenarien (u. a. Brand, Evakuierung, vermisste Schüler:innen/Weglaufen, Krampfanfall/Epilepsie, allergische Reaktion, herausforderndes Verhalten/Eskalation, Medikamenten-Zwischenfall, Unfall Schülertransport, Todesfall, akute psychische Krise, Kindesschutz, Notfall im Therapiebad, Amok, Bombendrohung, IT-Ausfall u. v. m.). Jedes Szenario mit Priorität, Sofort- und Folgemassnahmen, Checkliste, zuständigen Gruppen, Standard-Alarmkanälen und verknüpften Notrufnummern – alles im Editor anpassbar, eigene Szenarien erstellbar.
- **Benutzerverwaltung:** manuelle Erfassung, CSV-Import (`Vorname;Nachname;E-Mail;Telefon;Rolle`), Rollen/Berechtigungen (Admin, Krisenstab, Mitarbeiter), Ferienabwesenheiten und Teilzeit, App-Sprache pro Nutzer (DE/EN/FR/IT).
- **Gruppen & Krisenteams:** Nutzergruppen mit Mitgliederverwaltung, Kennzeichnung als Krisenteam.
- **Standorte:** Baar (Hauptsitz, inkl. Wohngruppen rund um die Uhr), Menzingen und Kloten – mit Betriebszeiten und Geofencing (Koordinaten + Radius) zur automatischen Standortzuweisung.
- **Alarmpläne:** vorkonfigurierte Alarmierung (Szenario, Zielgruppen, Standorte, Kanäle, Quittierungspflicht, Betriebszeiten) mit mehrstufiger Eskalation inkl. Benachrichtigung von Blaulichtorganisationen.
- **Notfallkontakte:** externe Notrufnummern (117, 118, 144, 112, Tox Info 145, Rega 1414, Dargebotene Hand 143, Pro Juventute 147) – erweiterbar.

### 02 Gefahrenabwehr
- **Alarm auslösen:** Szenariowahl, zielgruppenspezifische Alarmierung nach Standort/Gruppe, Kanalwahl.
- **Alarmierungskanäle (simuliert):** Push mit Critical Alerts, SMS, E-Mail, Sprachanruf, Telefonkonferenz, Text-to-Speech-Durchsage, Microsoft Teams.
- **Stiller Alarm** (z. B. Bedrohungslage) und **Aufgebot mit Quittierfunktion** («Ich komme» / «Nicht verfügbar»).
- **Alarmzentrale:** Live-Monitoring mit Zustellstatus pro Empfänger und Kanal, Quittierungsübersicht, Alarmjournal, automatische Eskalationsstufen, Entwarnung.
- **Alarmierung auf dem iPhone:** Nicht stille Alarme werden mit der höchsten Stufe verschickt, die das Gerät zulässt. Beide Stufen – zeitkritisch und Critical Alert – setzen eine Berechtigung voraus, die einmalig einzurichten ist; bis dahin kommen Alarme als normale Mitteilung an. Anleitung: [`mobile/CRITICAL-ALERTS.md`](mobile/CRITICAL-ALERTS.md). Stille Alarme bleiben lautlos.
- **Notfallszenarien:** Neun Szenarien sind für Mitarbeitende freigeschaltet – Brand, Evakuierung, Medizinischer Notfall, Herausforderndes Verhalten, Verdächtige Person auf dem Areal, Todesfall, Notfall im Therapiebad, ICT-Ausfall und Krisenstab einberufen. Jedes führt Schritt für Schritt durch die Akutphase, die Nachbearbeitung und eine Checkliste und nennt die einschlägigen Schweizer Rechtsgrundlagen. Die übrigen Szenarien bleiben in der Verwaltung ausgegraut erhalten und lassen sich dort jederzeit wieder einblenden.
- **Anmeldung:** E-Mail und Passwort, im Webportal wie in der App. Passwörter werden gesalzen und als SHA-256-Hash gespeichert; Administratoren vergeben und setzen Passwörter in der Benutzerverwaltung zurück, jede Person ändert ihr Passwort im Profil. Ein Erstpasswort kann mit erzwungenem Wechsel bei der nächsten Anmeldung vergeben werden. Die Prüfung der Anmeldedaten liegt vollständig in `src/lib/auth.ts` – für eine spätere SSO- oder Backend-Anbindung muss nur `authenticate()` ersetzt werden.
- **Rollen & Portale:** Das Webportal (Verwaltung) ist Admin und Krisenstab vorbehalten – beide sehen alles und haben zusätzlich Zugriff auf die iOS-App (`mobile/`, plus Web-Vorschau über «App-Vorschau (iOS)»). Mitarbeitende haben ausschliesslich Zugriff auf die iOS-App; im Webportal sehen sie nur einen Hinweis-Bildschirm mit Verweis auf die App.
- **App-Vorschau (iOS):** Web-Version der Mitarbeiter-App mit SOS-Taste (Halte-Geste), aktiven Alarmen mit Quittierung, offline verfügbaren Szenarien/Checklisten, eigenem Alleinarbeits-Timer und Notrufkontakten (direkt anrufbar) – öffnet in einem separaten Tab.

### 03 Alleinarbeiterschutz
- **Timer-Funktion:** Überwachung mit Intervall, Lebenszeichen und automatischer Alarmauslösung bei Ablauf – wahlweise still.
- **Physische Alarmknöpfe:** Verwaltung von LoRaWAN- (Batterie > 4 Jahre) und GSM-Knöpfen mit GPS, individuellen Alarmnachrichten, Zielgruppen und automatischer Eskalation an Blaulichtorganisationen.

### System
- **Integrationen:** SMS-Gateway, VoIP, Microsoft Teams, interne Notfallnummer, SSO, Personalsystem-Synchronisation, IP/Webhook-Integration (ein- und ausgehend), Deployment via Zugangscodes, Mehrsprachigkeit, Geofencing.
- **Ereignisprotokoll:** revisionssicheres Journal aller Aktionen mit Filter.

## Technik

- React 18 + TypeScript + Vite + Tailwind CSS (Single-Page-App)
- Zustand wird im `localStorage` persistiert (auch als Demo der Offline-Verfügbarkeit)
- Ein Simulations-Ticker bildet den Alarmserver nach: Zustellstatus (pending → gesendet → zugestellt/fehlgeschlagen), Eskalationsstufen und Alleinarbeits-Timer laufen in Echtzeit
- **Hinweis:** Es werden keine echten SMS/Anrufe/Push-Nachrichten versendet – alle Kanäle sind simuliert. Für den Produktivbetrieb wären entsprechende Gateways (SMS-Provider, Push-Dienste, Telefonie) anzubinden.

## Native Mobile-App (Expo)

Im Ordner **`mobile/`** liegt eine native React-Native-Version der Mitarbeiter-App (Expo SDK 54).
Testen mit **Expo Go**: `cd mobile && npm install && npx expo start`, dann den QR-Code scannen.
Publishen für das Team via **EAS Update** (`eas update --branch preview`). Details: [`mobile/README.md`](mobile/README.md).

## iOS / Smartphone (PWA)

Die App ist eine **Progressive Web App** und lässt sich auf dem iPhone wie eine native App installieren:

1. Die veröffentlichte URL in **Safari** öffnen
2. **Teilen-Symbol** antippen
3. **«Zum Home-Bildschirm»** wählen

Danach startet sie vollbildig mit eigenem App-Symbol (roter Warndreieck auf dunklem Grund) und funktioniert dank Service Worker auch **offline** (App-Shell und Szenarien werden lokal zwischengespeichert). Voraussetzung: Hosting über HTTPS im Wurzelpfad einer Domain.

**Native iOS-App (App Store):** Der Weg dazu führt über [Capacitor](https://capacitorjs.com) – das bestehende Web-Frontend wird dabei unverändert in eine native Hülle verpackt (`npx cap add ios`), in Xcode gebaut und mit einem Apple-Developer-Konto (CHF ~99/Jahr) signiert und eingereicht. Erst die native Hülle ermöglicht echte Critical-Alert-Pushes, die die Stummschaltung übersteuern (Apple-Sonderberechtigung nötig).

## Starten

```bash
npm install
npm run dev      # Entwicklung: http://localhost:5173
npm run build    # Produktions-Build nach dist/
npm run preview  # Produktions-Build lokal testen
```

## Betrieb auf einem Server

Im Produktivbetrieb liefert der Alarmserver auch das Portal aus – eine Adresse
für beides. Die Anleitung für das Hetzner-Hosting steht in
[`DEPLOY-HETZNER.md`](DEPLOY-HETZNER.md).

## Mehrere Kunden & Redundanz

Die Plattform ist mandantenfähig nach dem Modell **eine App, ein Server pro
Kunde**: Jeder Kunde erhält einen eigenen Alarmserver (eigene Domain, eigene
Datenbank); die iOS-App bleibt für alle dieselbe und verbindet sich über einen
QR-Code aus dem Portal mit dem richtigen Server. Ein neuer Server startet
neutral mit einem Einrichtungsassistenten; Name und Auftritt der Organisation
werden im Portal gepflegt und erscheinen automatisch in Portal und App. Pro
Kunde kann jederzeit ein **zweiter Alarmserver (Standby)** angebunden werden –
er spiegelt den Datenbestand laufend, die App weicht bei einem Ausfall
selbständig dorthin aus. Anleitung: [`KUNDEN-SETUP.md`](KUNDEN-SETUP.md).

## Betriebsarten

| | Demo | Live |
| --- | --- | --- |
| Daten | Beispieldaten auf dem Gerät | Alarmserver (`server/`) |
| Zustellung | simuliert | echte Push-Nachrichten an registrierte iPhones |
| Geräte | jedes Gerät für sich | Portal und App sehen denselben Bestand |
| Netz | nicht nötig | Server muss erreichbar sein |

Der Live-Modus braucht den Alarmserver – ohne ihn haben Webportal und App
getrennte Datenbestände, und ein im Portal angelegtes Konto existiert auf dem
Telefon nicht. Zum Starten siehe [`server/README.md`](server/README.md):

```bash
cd server && npm install && npm run dev
```

Die Serveradresse lässt sich auf der Anmeldemaske eintragen (im Portal wie in
der App) – im Schulnetz die IP-Adresse des Rechners, auf dem der Server läuft.
Läuft der Server nicht, sagt die Maske das ausdrücklich; bei einer frischen
Installation zeigt sie Konto und Erstpasswort an. Kommt niemand mehr hinein:
`cd server && npm run accounts` beziehungsweise `npm run reset-admin`.

**Aktualisieren ohne Kommandozeile:** Administratoren finden im Portal in der
Seitenleiste den Knopf **Aktualisierung** und wählen dort zwischen «Nur Server»
und «Server und iOS-App» (Letzteres stösst auch den TestFlight-Build an). Jeder
Schritt wird mit Protokoll angezeigt. Die Voraussetzungen – Dienstverwalter für
den Neustart, Git-Zugang, `EXPO_TOKEN` – stehen in
[`server/README.md`](server/README.md).

## Szenarien und Rechtsgrundlagen

Sichtbar für Mitarbeitende sind:

| Szenario | Auslöseart | Zuständig |
| --- | --- | --- |
| Brand / Feuer | laut, alle am Standort | alle |
| Evakuierung | laut, alle am Standort | alle |
| Medizinischer Notfall | laut | Ersthelfende |
| Herausforderndes Verhalten | still | pädagogisches Deeskalationsteam |
| Verdächtige Person auf dem Areal | still | Sicherheit, Krisenstab |
| Todesfall | still | Krisenstab |
| Notfall im Therapiebad | laut | Ersthelfende |
| ICT-Ausfall / Cyberangriff | laut | ICT, Krisenstab |
| Krisenstab einberufen | laut, mit Quittierung | Krisenstab |

Jedes dieser Szenarien führt unter «Rechtsgrundlagen» die einschlägigen Schweizer
Bestimmungen und Normen auf – etwa StGB Art. 128 (Unterlassung der Nothilfe),
ZGB Art. 383–385 (bewegungseinschränkende Massnahmen), StPO Art. 253
(aussergewöhnlicher Todesfall), DSG Art. 24 (Meldung von Verletzungen der
Datensicherheit), VKF-Brandschutzrichtlinie 16-15 und ArGV 3 Art. 36.

> Diese Angaben sind eine Orientierungshilfe und keine Rechtsberatung.
> Verbindlich sind die kantonalen Vorgaben, das Notfallkonzept der Trägerschaft
> und die Beurteilung der Sicherheitsverantwortlichen. Der Text ist vor dem
> Produktivbetrieb durch die zuständigen Stellen zu prüfen und freizugeben.

Ausgeblendete Szenarien bleiben vollständig erhalten. In der Verwaltung stehen
sie ausgegraut mit dem Vermerk «ausgeblendet»; ein Klick auf das Augensymbol
blendet sie wieder ein. Sie erscheinen weder in der App noch bei der
Alarmauslösung.

## Anmeldung

| Modus | Konto | Passwort |
| --- | --- | --- |
| Demo | alle zehn Beispielkonten, z. B. `stefan.gross@sonnenberg-baar.ch` (Admin), `anna.mueller@sonnenberg-baar.ch` (Krisenstab), `lea.weber@sonnenberg-baar.ch` (Mitarbeiterin) | `sobe2026` |
| Live | `stefan.gross@sonnenberg-baar.ch` (einziges Konto beim ersten Start des Servers) | `SOBE-Start2026!`, muss bei der ersten Anmeldung geändert werden |

Weitere Live-Konten werden im Portal unter **Benutzer** angelegt; sie liegen auf
dem Server und gelten damit sofort auch in der App auf dem Telefon.

Die Demo-Zugänge stehen zum Hineinklicken auf der Anmeldemaske; im Live-Modus erscheinen sie nicht.
Demo- und Live-Modus haben getrennte Datenbestände und damit auch getrennte Anmeldungen – der Modus lässt
sich deshalb direkt auf der Anmeldemaske umschalten.

Ein Datenbestand kann sich nicht dauerhaft aussperren: Existiert kein anmeldefähiges Konto, erhalten alle
Administratoren das Erstpasswort mit erzwungener Änderung; fehlt auch ein Administrator, wird das Konto aus
der Grundkonfiguration wiederhergestellt. Der letzte verbliebene Administrator kann weder gelöscht noch in
eine andere Rolle versetzt werden.

> Im Demo-Modus liegen die Passwort-Hashes auf dem Gerät – das genügt für Vorführung und Test, ersetzt aber
> keine serverseitige Prüfung. Im Live-Modus prüft der Alarmserver die Anmeldung; dort liegen die Passwörter
> als PBKDF2-SHA256-Hash und verlassen den Server nie.

## Bedienung (Schnellstart)

1. **Alarm auslösen** → Szenario wählen (Kanäle und zuständige Gruppen werden automatisch vorbefüllt) → prüfen → auslösen.
2. In der **Alarmzentrale** den Live-Zustellstatus und das Alarmjournal beobachten.
3. In der **Benutzeransicht (App)** über Profil → «Demo: Ansicht als andere Person» einen Mitarbeiter wählen und den Alarm quittieren.
4. Unter **Alleinarbeit** einen kurzen Timer (1 Min.) starten und ablaufen lassen – der automatische Alarm erscheint in der Alarmzentrale.
5. Über **Ereignisprotokoll → Demo zurücksetzen** lässt sich der Ausgangszustand wiederherstellen.
