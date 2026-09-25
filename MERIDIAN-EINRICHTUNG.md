# Indoor-Ortung mit Aruba Meridian – Schritt für Schritt

Umsetzung von **Option B** des Konzepts «Indoor-Lokalisierung Aruba AP505»: Die
Access Points senden Bluetooth-Beacons, das **Meridian-SDK** in der App rechnet
daraus Stockwerk und Position auf dem Grundriss. Ein Alarm aus der App trägt
diese Position mit:

- **Im Alarmtext** steht das Stockwerk: «SOS-Alarm von … – Standort: Hauptsitz
  Baar · Hauptgebäude, 2. OG (±3 m)». So steht es in Push, SMS und E-Mail,
  lesbar auch ohne Karte.
- **In der Alarmzentrale** zeigt das Portal den Grundriss mit einer Markierung
  an der Stelle, an der die Person ist.
- **Solange der eigene Alarm läuft**, führt die App die Position nach. Wechselt
  die Person das Stockwerk, erhalten alle Empfänger:innen eine Meldung
  «Position im Gebäude geändert: …». Kleinere Bewegungen verschieben nur die
  Markierung in der Alarmzentrale, ohne dass Telefone klingeln.

**Datenschutz:** Die Position bleibt auf dem Telefon. Übermittelt wird sie nur
mit einem Alarm: beim Auslösen und danach, solange dieser Alarm läuft. Es gibt
keine Bewegungsaufzeichnung und keine Anwesenheitsübersicht.

Rechnen Sie für die Einrichtung mit einem halben Tag. Den grössten Teil davon
brauchen die Grundrisse im Meridian Editor.

> **Ein Vorbehalt zu den Menünamen.** Aruba benennt Menüs in Central und im
> Meridian Editor von Version zu Version etwas anders. Bei jedem Schritt steht
> deshalb, **was Sie suchen**. Findet sich ein Menü nicht unter dem genannten
> Namen, suchen Sie nach diesem Ziel.

---

## Vor dem Start

- [ ] Eine Lizenz **Meridian Blue Dot Navigation** für die Fläche (Konzept: ca.
      0,50–1,00 € pro m² und Jahr) und ein Konto im Meridian Editor
- [ ] Zugang zu **Aruba Central** mit den AP505
- [ ] **Grundrisse** jedes Stockwerks als PDF oder Bild
- [ ] Zugang zum Portal als **Administration**
- [ ] Ein Telefon mit **iOS 16** oder **Android 11** oder neuer

> **Mindestversionen der App.** Das Meridian-SDK 12 läuft erst ab iOS 16 und
> Android 11. Mit der Indoor-Ortung verlangt deshalb die ganze App diese
> Versionen. Telefone mit iOS 15 oder Android 7–10 erhalten keine neue
> App-Version mehr; die bereits installierte läuft dort weiter, aber ohne
> Indoor-Ortung. Prüfen Sie vorher, ob solche Geräte im Einsatz sind.

---

## Schritt 1 – Lizenz und Central mit Meridian verbinden

Quelle: Arubas Anleitungen «HPE Aruba Networking Central Meridian Beacons
Management Configuration Guide» und «AOS 10 Meridian Beacons Management
Configuration Guide» auf docs.meridianapps.com.

### 1a – Lizenz

Die App braucht **«Meridian Blue Dot Navigation»** (HPE-Teilenummer JZ092AAE
für 1 Jahr oder JZ102AAE für 5 Jahre, je 10 000 m²). «Maps with Static
Wayfinding» zeigt nur Karten und liefert keine Position. «Asset Tracking» ist
für Tags und hier nicht nötig. Bezogen wird die Lizenz über den
Aruba-/HPE-Partner. Danach gibt es ein Konto im Meridian Editor; welches
Rechenzentrum es nutzt, steht in der Adresse: `edit-eu.meridianapps.com` oder
`edit.meridianapps.com`.

### 1b – Angaben aus dem Meridian Editor

- **Access Token für Central:** *Beacons → Beacons Management → «Generate your
  access token»*, dann kopieren. Nicht verwechseln mit dem Application Token für
  die App aus Schritt 3.
- **Location-ID:** *Settings → Location* oder aus der Adresse
  `https://edit-eu.meridianapps.com/apps/<Location-ID>`.
- **Server-Adresse für Beacons Management:**
  `https://edit-eu.meridianapps.com/api/beacons/manage` (EU) bzw.
  `https://edit.meridianapps.com/api/beacons/manage` (Standard).

### 1c – In Central: Bluetooth der AP505 einschalten

Firmware der AP505 vorher prüfen: **AOS 8 / Instant** oder **AOS 10**. Der
Weg unterscheidet sich ab 1e.

1. Gruppe der AP505 wählen → **Devices** → oben rechts **Config** → **Show
   Advanced** → Reiter **IoT**.
2. Unter **IoT Radio Profiles** auf **+**: Name frei, *Radio Mode* **BLE**,
   *Radio* **Internal**, *BLE operation mode* **Both (Beaconing & Scanning)**,
   den Rest belassen. Speichern.
3. Das Profil ist zunächst aus: mit dem Schalter rechts einschalten.

### 1d – Zertifikat hinterlegen

1. Von <https://pki.goog/repository/> das Root-Zertifikat **GTS Root R1** im
   PEM-Format laden.
2. **Organization → Certificates → +**, Typ **CA**, hochladen.
3. **Gruppe → Config → Security → Certificate Usage → IoT CA Cert**: das
   Zertifikat wählen, speichern.

### 1e – Verbindung zu Meridian (AOS 8 / Instant)

1. Wieder *Devices → Config → Show Advanced → IoT*, unter **IoT Transport
   Streams** auf **+**.
2. *Server URL*: die Beacons-Management-Adresse aus 1b; *Server type*
   **Meridian Beacon Management**; *Device Class* **Aruba Beacons**;
   *Reporting interval* **60** Sekunden; unter *Authentication* das Access
   Token aus 1b. Speichern und mit dem Schalter einschalten.
3. 15–30 Minuten warten.

### 1e – Verbindung zu Meridian (AOS 10, ab Version 10.5.1.0)

1. Unter *IoT → BLE Beacon Service Profiles* auf **+**: *Radio* **Internal**,
   *Beacon Configuration Method* **IoT Operations App**. Den **Profile
   Identifier** notieren, speichern.
2. Einen **IoT Connector** einrichten (VM oder AP-basiert; AP-basiert nur auf
   AP-6xx/7xx) und die AP505 ihm zuweisen.
3. **Applications → IoT Operations → Connectors → Installed Applications →
   Manage → Meridian → Install**. Einzutragen: Access Token, Profile_ID (aus
   Schritt 1), Location_ID; die beiden Server-Adressen für die EU auf
   `edit-eu…` bzw. `tags-eu…` ändern. **Install**.
4. In der Firewall `edit-eu.meridianapps.com` (bzw. `edit.…`) auf Port 443
   freigeben.

**Prüfung:** Im Meridian Editor unter *Beacons* steht der Verbindungsstatus als
verbunden, und die AP505 erscheinen in der Liste (Filter **Access Point
Beacon**). Meridian konfiguriert sie beim ersten Kontakt selbst («APB
Auto-Deploy»); danach haben sie das Kennzeichen «unplaced», bis sie in
Schritt 2 auf eine Karte gesetzt sind. Als Typ muss **Location** eingestellt
sein, nicht Proximity.

> **Genauigkeit:** Meridian empfiehlt für 3–5 m Genauigkeit Beacons im Abstand
> von höchstens 10 m. Access Points hängen meist weiter auseinander; mit den
> AP505 allein ist eher mit Raum- bis Bereichsgenauigkeit zu rechnen.
> Stockwerke erkennt die Ortung zuverlässig. Wo es genauer sein muss, ergänzen
> batteriebetriebene Aruba-Beacons die Access Points.

## Schritt 2 – Grundrisse und Access Points im Meridian Editor

**Ziel:** Jedes Stockwerk ist eine Karte, auf der die Access Points am richtigen
Ort stehen.

1. Legen Sie pro Gebäude eine Gruppe an und darin pro Stockwerk eine Karte;
   laden Sie jeweils den Grundriss hoch.
2. Platzieren Sie die Access Points auf den Karten, dort, wo sie wirklich
   hängen. Die Genauigkeit der Ortung hängt direkt davon ab.
3. Veröffentlichen Sie die Karten.

**Prüfung:** Die Meridian-Beispiel-App oder die Kartenansicht im Editor zeigt
alle Stockwerke.

## Schritt 3 – Location-ID und zwei Tokens

Aus dem Meridian Editor brauchen Sie drei Angaben:

| Angabe | Wo | Wofür |
|---|---|---|
| **Location-ID** | in der Adresse des Editors: `…/w/location/<Location-ID>/…` | App und Portal |
| **Application Token** | *Location → Permissions → Application Token* | Das SDK in der App |
| **API-Token, nur Lesen** | *Location → Permissions* (ein Token nur mit Leserecht) | Grundrisse im Portal |

Notieren Sie ausserdem, in welchem Rechenzentrum Ihr Konto liegt:
`edit-eu.meridianapps.com` (Europa) oder `edit.meridianapps.com` (USA).

> **Nehmen Sie für das Portal unbedingt ein Token nur mit Leserecht.** Es wird
> im Browser verwendet; ein Token mit Schreibrecht erlaubte jedem, der es
> abgreift, Ihre Karten zu ändern. Der Alarmserver gibt es nur an
> Administration und Krisenstab heraus. Das Application Token dagegen steckt
> ohnehin in jeder App und gilt nicht als Geheimnis.

## Schritt 4 – Im Portal eintragen

**Integrationen → App der Mitarbeitenden → Indoor-Ortung (Aruba Meridian)**

1. Schalter **«Position im Gebäude mit Alarmen übermitteln»** ein.
2. Rechenzentrum, Location-ID, Application Token und Lese-Token eintragen,
   **Speichern**.
3. **«Aus Meridian übernehmen»**: Das Portal lädt alle Stockwerke mit ihren
   Namen aus Meridian (z. B. «Hauptgebäude, 2. OG»).
4. Die Namen prüfen und so anpassen, wie sie in einer Alarmmeldung verstanden
   werden. Sie stehen später so im Alarmtext.
5. Jedem Stockwerk den **Standort** zuordnen (Baar, Menzingen, Kloten).
   Löst jemand auf diesem Stockwerk ein SOS aus, gilt dieser Standort, auch
   wenn das Profil der Person einen anderen nennt.
6. **Speichern**.

**Prüfung:** Die Karte zeigt «aktiv · N Stockwerke benannt».

## Schritt 5 – Neue App-Version verteilen

Die Indoor-Ortung ist nativer Code. Sie kommt nur mit einem **neuen App-Build**
auf die Telefone, nicht über ein EAS-Update und nicht in Expo Go.

- Im Portal: **Aktualisierung → «Server und iOS-App»**, oder von Hand
  `eas build --platform all --profile production` im Ordner `mobile/`.
- Beim Build lädt das Config-Plugin `mobile/modules/meridian-indoor` das
  Meridian-SDK direkt bei Aruba (`files.meridianapps.com`) und prüft die
  Prüfsumme. Der Build-Rechner braucht dafür Internetzugang.

Beim ersten Start fragt die App nach dem **Standort** und unter Android 12+
zusätzlich nach **«Geräte in der Nähe»** (Bluetooth-Suche). Beides muss erlaubt
werden, sonst bleibt die Indoor-Ortung aus.

## Schritt 6 – Prüfen

1. **Profil in der App:** Unter dem Standort steht «Im Gebäude: Hauptgebäude,
   2. OG (±3 m)». Gehen Sie ein Stockwerk höher: Nach einigen Sekunden wechselt
   die Anzeige.
2. **Übungsalarm:** Lösen Sie im Szenario einen Alarm mit «Übung» aus. Der
   Alarmtext endet mit dem Stockwerk, und in der Alarmzentrale erscheint der
   Grundriss mit der Markierung.
3. **Bewegung:** Wechseln Sie während der Übung das Stockwerk. Alle
   Empfänger:innen erhalten «Position im Gebäude geändert: …».
4. Übung beenden.

Zeigt das Profil «keine Access Points in Reichweite», obwohl Sie im Gebäude
sind: Schritt 1 und 2 prüfen (BLE an? Access Points auf der Karte platziert?
Karte veröffentlicht?).

---

## Wie es sich verhält

- **Wann die App ortet:** solange sie im Vordergrund ist (dort wird ein Alarm
  ausgelöst) und darüber hinaus, solange ein eigener Alarm läuft. Im
  Hintergrund ohne Alarm sucht sie nicht, das schont den Akku.
- **Wie alt eine Position sein darf:** Beim Auslösen nimmt die App nur eine
  Position mit, die höchstens 2 Minuten alt ist; der Server nimmt keine an,
  die älter als 10 Minuten ist. Eine veraltete Position ist schlechter als
  keine: Sie schickt Helfende an den falschen Ort.
- **Ohne Position** geht der Alarm genauso raus, dann nur mit dem Standort.
  Gelingt die Ortung nach dem Auslösen, reicht die App die Position nach
  («Position im Gebäude: …» an alle).
- **Alleinarbeits-Timer** lösen auf dem Server aus. War die App dann im
  Hintergrund, fehlt die Position zunächst; beim nächsten Öffnen der App wird
  sie nachgereicht.
- **Genauigkeit:** Meridian nennt einen maximalen Fehler in Metern. Er steht im
  Alarmtext («±3 m»). Stockwerke unterscheidet die Ortung zuverlässiger als
  benachbarte Räume.

## Fehlerbehebung

| Anzeige im Profil | Ursache | Abhilfe |
|---|---|---|
| «Standortzugriff fehlt» | Standort in den Einstellungen verweigert | Einstellungen → SOBE Notfall → Standort erlauben |
| «Bluetooth ist ausgeschaltet» | Bluetooth aus | Bluetooth einschalten |
| «in dieser App-Version nicht enthalten» | alte App oder Expo Go | neue App-Version installieren |
| «keine Access Points in Reichweite» | kein Beacon empfangen | BLE auf den AP505, Karte veröffentlicht, Location-ID und Token prüfen |

**Grundriss im Portal fehlt** («Grundriss nicht verfügbar»): Lese-Token oder
Location-ID falsch oder das falsche Rechenzentrum gewählt. Das Portal lädt die
Karte direkt bei Meridian; der Browser muss `edit-eu.meridianapps.com` bzw.
`edit.meridianapps.com` erreichen.

## SDK aktualisieren

Die SDK-Version ist an zwei Stellen festgelegt:

- `mobile/modules/meridian-indoor/plugin/index.js`: Version, Adresse und
  SHA-256-Prüfsumme der iOS- und der Android-Datei. Die iOS-Prüfsumme steht in
  `Package.swift` von
  [github.com/arubanetworks/meridian-ios-sdk](https://github.com/arubanetworks/meridian-ios-sdk);
  für Android die Datei laden und `shasum -a 256` rechnen.
- `mobile/modules/meridian-indoor/android/build.gradle`: die Versionsnummer
  der Abhängigkeit und die Begleitbibliotheken laut Aruba-Beispielprojekt
  (`MeridianSamples/app/build.gradle` im Android-SDK-Paket).
