# LoRaWAN-Alarmknöpfe anbinden – Schritt für Schritt

Für das **RAK WisGate Edge Lite 2** mit seinem **eingebauten Netzserver** und
den Alarmserver auf `https://temp-gross-ict.ch`.

Rechnen Sie mit **zwei bis drei Stunden** für den ersten Knopf. Jeder weitere
dauert dann zehn Minuten. Jeder Schritt endet mit einer Prüfung, die Sie sehen
können – gehen Sie nicht weiter, solange sie nicht stimmt.

> **Ein Vorbehalt zu den Menünamen.** Ich kenne Ihre Firmware nicht. WisGateOS
> benennt seine Menüs von Version zu Version unterschiedlich. Ich schreibe
> deshalb bei jedem Schritt **was Sie suchen** und den Pfad, der am ehesten
> zutrifft. Heisst es bei Ihnen anders: Das Ziel steht dabei, danach finden Sie
> es. Schicken Sie mir einen Screenshot, wenn Sie nicht weiterkommen – dann
> benenne ich die Schritte für Ihre Version genau.

---

## Vor dem Start

Legen Sie bereit:

- [ ] Das Gateway, ein **LAN-Kabel** und den Handzettel mit den Zugangsdaten
- [ ] Mindestens **einen LoRaWAN-Alarmknopf** für **EU868**
- [ ] Vom Knopf: **DevEUI**, **AppEUI/JoinEUI** und **AppKey** (Etikett, Beipackzettel
      oder QR-Code auf dem Gerät)
- [ ] Den **Payload-Decoder** des Knopfherstellers (Download-Bereich des
      Herstellers, meist eine `.js`-Datei oder ein Textblock zum Kopieren)
- [ ] Zugang zum Portal als **Administration**

> **Ohne Decoder brauchen Sie gar nicht anzufangen.** Ohne ihn kommen beim
> Alarmserver rohe Bytes an, in denen kein Knopfdruck zu erkennen ist. Suchen
> Sie ihn jetzt, nicht in Schritt 6.

Notieren Sie DevEUI, AppEUI und AppKey **schriftlich** und legen Sie das Blatt
zu den Serverunterlagen. Beim eingebauten Netzserver leben diese Schlüssel nur
auf dem Gateway; geht es kaputt, müssen Sie ohne diese Notiz jeden Knopf neu
beschaffen oder auslesen.

---

# Teil 1 · Gateway

## Schritt 1 – Gateway erreichen

**Ziel:** Die Weboberfläche des Gateways im Browser offen haben.

1. Gateway mit Strom versorgen und mit dem LAN-Kabel ans Netz hängen.
2. Zwei Minuten warten, bis die Leuchten stabil sind.
3. Die IP-Adresse finden – am einfachsten in der Geräteliste Ihres Routers
   (der Name beginnt mit `RAK`). Diese Adresse im Browser öffnen.

Geht das nicht, nehmen Sie den Weg über das eigene WLAN des Gateways: Es spannt
ein Netz auf, dessen Name mit `RAK` beginnt; das Passwort steht im Handzettel.
Die Oberfläche liegt dann unter **`http://192.168.230.1`**.

Anmelden mit den Zugangsdaten aus dem Handzettel (bei WisGateOS ist der
Benutzername in der Regel `root`).

**Geprüft, wenn:** Sie die Übersichtsseite mit der **Gateway-EUI** sehen.
Notieren Sie diese EUI – nicht zu verwechseln mit der DevEUI der Knöpfe.

---

## Schritt 2 – Passwort ändern

**Ziel:** Das Gateway ist nicht mehr mit dem Auslieferungspasswort erreichbar.

**Wo:** `System` → `Password` / `Change Password` / `Account`.

Vergeben Sie ein eigenes Passwort und legen Sie es dort ab, wo auch die übrigen
Zugangsdaten der Schule liegen.

**Geprüft, wenn:** Sie sich abmelden und mit dem neuen Passwort wieder anmelden
können.

> **Kein Formalismus.** Das Gateway hängt in Ihrem Schulnetz und ist ab Werk mit
> einem Passwort erreichbar, das in jedem Handbuch im Internet steht. Wer darauf
> kommt, kann den Netzserver umkonfigurieren – und damit die Alarmierung
> abschalten, ohne dass es jemandem auffällt.

---

## Schritt 3 – Frequenzplan EU868

**Ziel:** Das Gateway funkt auf dem in der Schweiz zulässigen Band.

**Wo:** `LoRa` → `Configuration` (je nach Version `Network Settings` oder
`Gateway Settings`).

Als **Frequency Plan / Region** **`EU868`** wählen und speichern.

**Geprüft, wenn:** Auf der Übersichtsseite `EU868` steht.

> Ein Gateway auf dem falschen Frequenzplan empfängt schlicht nichts – und gibt
> keine Fehlermeldung aus. Wenn später kein Uplink ankommt, ist das die erste
> Stelle, an der Sie nachsehen.

---

## Schritt 4 – Betriebsart: eingebauter Netzserver

**Ziel:** Das Gateway verwaltet die Knöpfe selbst, statt sie an einen Dienst im
Internet weiterzureichen.

**Wo:** Im selben LoRa-Bereich gibt es eine **Work Mode**-Auswahl mit etwa
diesen Möglichkeiten:

| Auswahl | Bedeutung |
| --- | --- |
| Packet Forwarder | Gateway reicht rohe Pakete an einen externen Netzserver weiter |
| Basics Station | dasselbe, neueres Verfahren |
| **Built-in Network Server** | **das ist Ihre Wahl** |

Auf **Built-in Network Server** stellen und speichern. Das Gateway startet den
Dienst neu; rechnen Sie mit ein bis zwei Minuten.

**Geprüft, wenn:** Im linken Menü ein neuer Bereich erscheint – **`Network
Server`** oder **`LoRaWAN Network Server`** – mit Unterpunkten wie
`Applications`, `Device Profiles`, `Gateways`.

Ab hier arbeiten Sie nur noch in diesem Bereich.

---

# Teil 2 · Netzserver im Gateway

## Schritt 5 – Anwendung anlegen

**Ziel:** Ein Behälter, in dem Ihre Knöpfe liegen und an dem später die
Verbindung zum Alarmserver hängt.

**Wo:** `Network Server` → `Applications` → `Add` / `Create`.

> **Achtung, hier weicht WisGateOS von ChirpStack ab.** Der Payload-Decoder
> (Schritt 6b) und die HTTP-Integration (Schritt 8) hängen bei diesem Gateway
> **an der Anwendung**, nicht am Geräteprofil und nicht in einem eigenen
> Integrations-Reiter. Sie finden beides im selben Formular, das Sie jetzt vor
> sich haben. Die Schritte 6b und 8 verweisen darauf zurück.

| Bereich | Feld | Eintrag |
| --- | --- | --- |
| Application settings | Application name | `sobe_notfall` |
| Application settings | Application description | `Alarmknöpfe SOBE Notfall` |
| Application settings | Application Type | **`Separate Application keys`** – jeder Knopf bringt seinen eigenen AppKey ab Werk mit. `Unified Application key` gäbe allen Geräten denselben Schlüssel und setzte voraus, dass Sie die Knöpfe selbst umprogrammieren |
| Payload format | **Payload type** | `None` für die Dragino-Geräte – siehe Schritt 6b |
| Payload format | **Only forward data object** | **aus** – siehe Kasten |
| Integration Parameters | Decode Type | `Base 64` |
| Integration Parameters | Report LoRa® Radio Information | **ein** |
| Integration Parameters | Enable HTTP/HTTPS Integration Parameters | **ein** – öffnet die Felder aus Schritt 8 |

> **«Only forward data object» muss ausgeschaltet bleiben.**
>
> Eingeschaltet schickt das Gateway nur die übersetzten Messwerte – ohne den
> Umschlag, in dem die **DevEUI** steht. Genau daran erkennt der Alarmserver
> aber, *welcher* Knopf gedrückt wurde. Ohne Umschlag kommt zwar etwas an, aber
> es lässt sich keinem Gerät zuordnen; in «Letzte Uplinks» stünde
> «Format nicht verstanden».

Speichern.

**Geprüft, wenn:** `sobe_notfall` in der Anwendungsliste steht.

Eine Anwendung genügt für alle Knöpfe aller drei Standorte – die Zuordnung zum
Standort machen Sie später im Portal, nicht hier.

---

## Schritt 6 – Gerätegruppe und Payload-Decoder

**Ziel:** Der Netzserver weiss, wie Ihr Knopfmodell funkt.

> **Kein eigenes Geräteprofil.** Anders als ChirpStack kennt der eingebaute
> Netzserver des WisGate keine Profile als eigene Objekte. Stattdessen legen Sie
> eine **Gerätegruppe** an, und die Profilangaben stehen in deren Formular. Die
> Gruppe ist also das Profil: **eine Gruppe je Modell.**

**Wo:** `Network Server` → `Applications` → `sobe_notfall` → Geräte →
**`New end device`**. Der Assistent hat zwei Schritte; Schritt 6a ist die
erste Seite, Schritt 9 die zweite.

### 6a – Die Funkeigenschaften

| Feld | Eintrag |
| --- | --- |
| Activation Mode | **`OTAA`** |
| End device (group) name | Modellbezeichnung, z. B. `dragino-trackerd` – ohne Umlaute |
| End device description | optional, leer lassen genügt |
| Enable LPTP | **aus** |
| **Application Key** | **den AppKey vom Etikett des Geräts eintippen** – siehe Kasten |
| Class | **`Class A`** |
| Frame Counter Width | `32 bit` |
| **LoRaWAN MAC Version** | **`1.0.3`** (bei neueren Geräten `1.1.0` – laut Datenblatt) |

> **Finger weg von «Autogenerate».**
>
> Der Knopf erzeugt einen neuen, zufälligen Schlüssel. Ihr Gerät kennt ihn
> nicht – es hat seinen eigenen ab Werk, aufgedruckt oder im Beipackzettel.
> Mit einem erzeugten Schlüssel gelingt das Anlernen nie, und die Fehlersuche
> führt in die Irre, weil alles andere richtig aussieht. «Autogenerate» ist für
> Geräte gedacht, die man selbst programmiert.

Raten Sie bei der MAC-Version nicht. Stimmt sie nicht, gelingt das Anlernen in
Schritt 9 nicht, und die Fehlermeldung sagt Ihnen nicht warum. Für den
**Dragino TrackerD** und den **PB01** ist es `1.0.3`, Class A, OTAA.

### 6b – Den Decoder: wer übersetzt?

In der Anwendung aus Schritt 5, Bereich **`Payload format`**, Feld
**`Payload type`**. Zur Auswahl stehen dort beim WisGate nur **`None`** und
**`CayenneLPP`** – einen eigenen Decoder kann dieser Netzserver **nicht**
aufnehmen.

Das ist kein Hindernis, sondern verschiebt nur die Zuständigkeit:

| Ihr Gerät | Payload type | Wer übersetzt |
| --- | --- | --- |
| **Dragino TrackerD, Dragino PB01** | **`None`** | der Alarmserver – Modell in Schritt 10 auswählen |
| Gerät, das CayenneLPP spricht | `CayenneLPP` | der Netzserver |
| Anderes Gerät | `None` | niemand – dann geht es nur über einen externen Netzserver (Anhang B) |

Zusätzlich:

- **`Only forward data object`** ausgeschaltet lassen.
- **`Decode Type`** auf **`Base 64`** – der Alarmserver versteht auch
  `HEX string`, aber Base 64 ist das übliche Format.

Für die beiden Dragino-Geräte ist hier also **nichts einzutragen**: `None`
stehen lassen und weiter. Die Übersetzung übernimmt der Alarmserver, sobald in
Schritt 10 das Modell hinterlegt ist. Ein Decoder weniger, der gepflegt werden
muss – und er gilt unverändert weiter, falls das Netz später über einen anderen
Netzserver läuft.

### 6c – Die Übersetzungszeile

Der Alarmserver erkennt einen Knopfdruck an Feldern wie `alarm`, `button`,
`pressed`, `sos`, `panic`, `emergency`, `alert`, `press` – oder an einem
Ereignisfeld mit diesem Inhalt (`event: "sos"`, `type: "button_pressed"`).

Benennt Ihr Hersteller das anders, hängen Sie **unten an den Decoder** eine
Übersetzung an, statt im fremden Code herumzuschneiden:

```js
// ... darüber der unveränderte Decoder des Herstellers ...

// Übersetzung für SOBE Notfall.
// Den Feldnamen links durch den ersetzen, den Ihr Decoder tatsächlich liefert.
if (data.press_type === 'long' || data.alarm_status === 1) {
  data.alarm = true
}
```

**Sie müssen jetzt nicht raten, wie die Felder heissen.** In Schritt 11 zeigt
Ihnen das Portal bei jedem eingetroffenen Uplink die Namen der übersetzten
Felder an. Lassen Sie diesen Block also zunächst weg, drücken Sie in Schritt 11
den Knopf, lesen Sie die Feldnamen ab – und kommen Sie dann hierher zurück.

**Geprüft, wenn:** Das Geräteprofil gespeichert ist und der Codec-Reiter Ihren
Code enthält.

---

# Teil 3 · Portal

## Schritt 7 – Endpunkt einschalten und Token erzeugen

**Ziel:** Der Alarmserver nimmt Uplinks entgegen, und Sie haben Adresse und
Token für Schritt 8 in der Zwischenablage.

**Wo:** Portal → **Integrationen** → Bereich **Drittsysteme & Alarmknöpfe** →
Karte **LoRaWAN-Netz / Alarmknöpfe**.

1. Schalter **«Uplink-Endpunkt für LoRaWAN- und GSM-Alarmknöpfe»** einschalten.
2. **Netzserver:** **`ChirpStack (auch der im Gateway eingebaute Netzserver)`**
   wählen.
3. **Warnen ohne Signal nach (Stunden):** auf das Melde-Intervall Ihrer Knöpfe
   abstimmen. Sendet ein Knopf alle 12 Stunden ein Lebenszeichen, tragen Sie
   nicht 12 ein, sondern 26 – sonst meldet das System bei jedem ausgefallenen
   Funkpaket eine Störung. Im Zweifel: das Doppelte des Intervalls plus zwei
   Stunden.
4. **Warnen bei Batterie unter (%):** 20 ist ein brauchbarer Ausgangswert.
5. **`Token erzeugen`** drücken.
6. **Endpunkt** und **Token** mit den Kopiersymbolen sichern – Sie brauchen
   beide im nächsten Schritt.

Der Endpunkt lautet:

```
https://temp-gross-ict.ch/api/hooks/lorawan
```

**Geprüft, wenn:** Unter dem Token die Liste **«Letzte Uplinks»** erscheint, mit
dem Hinweis, dass noch nichts eingetroffen ist.

> Lassen Sie diesen Browser-Tab ab jetzt offen. Die Liste frischt sich alle zehn
> Sekunden auf und ist Ihr Messgerät für den Rest der Einrichtung.

---

# Teil 4 · Die Verbindung

## Schritt 8 – HTTP-Integration im Gateway

**Ziel:** Der Netzserver im Gateway schickt jeden Uplink an den Alarmserver.

**Wo:** In der Anwendung aus Schritt 5, Bereich **`Integration Parameters`**,
Schalter **`Enable HTTP/HTTPS Integration Parameters`** einschalten. Darunter
erscheinen die Felder.

| Feld | Eintrag |
| --- | --- |
| **Uplink data URL** | `https://temp-gross-ict.ch/api/hooks/lorawan` |
| **Join notification URL** | **dieselbe Adresse** |
| **Ack notification URL** | **dieselbe Adresse** |
| **Device-status notification URL** | **dieselbe Adresse** |
| Maximum number of concurrent connections / queue | `16` / `64` so lassen |

> **Alle vier Adressfelder ausfüllen – auch die, die Sie nicht brauchen.**
>
> Bleibt eines leer, weist das WisGate-Formular die ganze Anwendung mit
> «There are invalid fields» ab, **ohne zu sagen, welches Feld es meint**. Man
> sucht dann stundenlang bei der Kopfzeile, beim Namen oder bei der Adresse.
>
> Die zusätzlichen Meldungen schaden nicht: Der Alarmserver verbucht Beitritt,
> Quittung und Gerätezustand als Lebenszeichen. Ein Alarm kann daraus nicht
> entstehen – dafür braucht es eine echte Funknutzlast. Die Meldung über den
> **Gerätezustand** ist sogar nützlich: Sie liefert den Batteriestand, ohne dass
> ihn das Gerät in seiner Nutzlast mitschicken müsste.

Für das **Token** gibt es drei Wege, in dieser Reihenfolge zu versuchen:

**Weg 1 – Kopfzeile.** Im Bereich `Headers`:

| Header name | Header value |
| --- | --- |
| `Authorization` | `Bearer IHR-TOKEN` |

**Weg 2 – Kopfzeile ohne «Bearer».** Lehnt das Formular den Wert ab, tragen Sie
**nur das Token** ein, ohne `Bearer` und ohne Leerzeichen:

| Header name | Header value |
| --- | --- |
| `Authorization` | `IHR-TOKEN` |

Der Alarmserver akzeptiert beides. Manche Gateways prüfen Kopfzeilen-Werte gegen
ein Muster, das kein Leerzeichen zulässt – dann scheitert Weg 1 am Leerzeichen
hinter `Bearer`, und zwar oft mit einer Fehlermeldung, die das Feld nicht nennt.

**Weg 3 – in der Adresse.** Geht die Kopfzeile gar nicht, hängen Sie das Token
an **beide** URL-Felder:

```
https://temp-gross-ict.ch/api/hooks/lorawan?token=IHR-TOKEN
```

Funktioniert gleichwertig, ist aber die schlechteste der drei Möglichkeiten: Das
Token steht dann in Protokolldateien. Erneuern Sie es dann gelegentlich über
**`Neues Token erzeugen`** im Portal – und tragen Sie es danach hier nach.

> **«There are invalid fields» ohne Angabe des Feldes?**
>
> Schalten Sie `Enable HTTP/HTTPS Integration Parameters` probeweise aus und
> speichern Sie. Geht es dann durch, liegt es an diesem Block – und dort zuerst
> am Leerzeichen im Kopfzeilen-Wert (Weg 2). Lässt sich die Anwendung auch ohne
> den Block nicht speichern, nehmen Sie Umlaute und Sonderzeichen aus Name und
> Beschreibung: Diese Oberfläche läuft auf OpenWRT und prüft Textfelder teils
> gegen reines ASCII.

Gibt es mehrere Ereignisarten (`uplink`, `join`, `status`, `ack`, `error`): Es
genügt **`uplink`**. Die übrigen schaden nicht, der Alarmserver ignoriert sie.

**Geprüft, wenn:** Die Integration gespeichert ist. Ob sie funktioniert, sehen
Sie erst in Schritt 11 – oder sofort über Anhang A.

---

# Teil 5 · Der erste Knopf

## Schritt 9 – Knopf anlernen

**Ziel:** Der Knopf hat sich beim Netzserver angemeldet.

**Wo:** Zweite Seite desselben Assistenten – `Adding end devices`.

Hier kommen die **DevEUI** der Geräte hinein, die zu dieser Gruppe gehören.
Mehrere Geräte desselben Modells lassen sich in einem Zug erfassen oder aus
einer CSV-Datei einlesen.

Bietet die Seite je Gerät ein eigenes Feld für den **Application Key**, tragen
Sie dort den Schlüssel **dieses** Geräts ein; der Schlüssel aus Schritt 6a
gilt dann nur als Vorgabe. Zwei Geräte desselben Modells haben **verschiedene**
AppKeys – deshalb steht die Anwendung auf `Separate Application keys`.

Speichern. Dann den Knopf **anlernen**. Wie, sagt das Datenblatt des Modells –
verwechseln Sie es nicht mit der Alarmauslösung:

| Gerät | Anlernen (Beitritt) | Alarm auslösen |
| --- | --- | --- |
| **Dragino TrackerD** | **kurzer Tastendruck** – das Gerät meldet sich damit am Netz an. Es läuft, sobald der Akku geladen oder USB angeschlossen ist | rote Taste **länger als 5 Sekunden** halten |
| **Dragino PB01** | Tastendruck | Tastendruck |

Beim TrackerD zeigen die Leuchten, was geschieht:

| Leuchte | Bedeutung |
| --- | --- |
| Grün, ein kurzes Blitzen (200 ms) | Beitrittsanfrage gesendet – das Gerät funkt |
| **Grün, 5 Sekunden an** | **Beitritt gelungen** |
| Blau, blinkend | sucht GPS – im Gebäude meist vergeblich. Der Alarm ist da längst gesendet |
| Grün, zweimal | Position gefunden und übertragen |
| Rot, zweimal | keine Position gefunden – kein Fehler, nur kein Satellitenempfang |
| gar nichts | Gerät aus, Akku leer oder im Tiefschlaf |

**Geprüft, wenn:** Beim Gerät `Last seen` gesetzt ist oder unter `LoRaWAN
frames` / `Device data` ein Beitritt steht.

### Wenn «Last seen» auf «Never» bleibt

Arbeiten Sie diese Reihenfolge ab – sie trennt Geräteseite von Netzserverseite:

1. **Strom.** Fabrikneue Geräte sind leer. USB anschliessen; der TrackerD läuft,
   sobald er Strom hat.
2. **Tiefschlaf?** Der TrackerD geht schlafen, wenn man die Taste zehn Sekunden
   hält und dann dreimal kurz drückt – beim Herumprobieren schnell passiert.
   **Reset-Taste** drücken, dann ist er wieder wach.
3. **Leuchtet es grün beim Tastendruck?**
   - **Nein** → Das Gerät funkt gar nicht. Zurück zu 1 und 2.
   - **Ja, kurz, aber kein Fünf-Sekunden-Grün** → Das Gerät funkt, bekommt aber
     keine Antwort. Weiter mit 4.
4. **Frequenzband.** Der TrackerD wird als EU868, US915, AU915 und AS923
   verkauft – **das Band steckt in der Firmware und lässt sich nicht umstellen.**
   Auf dem Etikett nachsehen: Steht dort nicht EU868, funktioniert das Gerät in
   der Schweiz nicht.
5. **Application Key.** Der häufigste Fehler: 32 Zeichen, und eine Verwechslung
   von `0`/`O` oder `1`/`I` genügt. **Wurde er versehentlich mit «Autogenerate»
   erzeugt, ist er garantiert falsch** – dann den Schlüssel vom Etikett
   eintragen und erneut anlernen.
6. **Funkprotokoll des Gateways** (`LoRaWAN frames`, `Live data`, `Packet
   Logger`). Stehen dort Beitrittsanfragen, das Gerät bleibt aber «Never», ist
   es der Schlüssel. Steht dort nichts, ist es Band, Strom oder Reichweite.

Legen Sie das Gerät für den ersten Versuch **neben das Gateway**. Den Empfang am
vorgesehenen Montageort prüfen Sie erst, wenn der Beitritt steht.

---

## Schritt 10 – Knopf im Portal registrieren

**Ziel:** Der Alarmserver weiss, was beim Druck auf diesen Knopf geschehen soll.

> **Nicht die aufgedruckte Seriennummer.**
>
> Auf dem Gehäuse steht meist eine Artikel- oder Seriennummer wie
> `TRAC6270727`. Die kennt der Netzserver nicht – er meldet ausschliesslich die
> **DevEUI**, sechzehn Hex-Zeichen, im Gateway unter `EUI` zu sehen. Steht im
> Portal etwas anderes, findet der Alarmserver den Knopf nicht, und «Letzte
> Uplinks» meldet «Gerät nicht registriert».

> **Kleiner Umweg, der Ihnen Tippfehler erspart:** Drücken Sie den Knopf **jetzt
> schon einmal**. Der Uplink wird abgewiesen – aber unter **«Letzte Uplinks»**
> im Portal steht dann «Gerät nicht registriert» und **daneben die exakte
> Kennung mit einem Kopiersymbol**. Diese Kennung ist verlässlicher als das
> Abtippen vom Etikett.

**Wo:** Portal → **Alarmknöpfe** → **`Knopf registrieren`**.

| Feld | Eintrag |
| --- | --- |
| **Bezeichnung** | derselbe Ort wie im Netzserver, z. B. `Eingang Weststrasse` |
| **Typ** | `LoRaWAN` |
| **Modell** | `Dragino TrackerD` bzw. `Dragino PB01`. Damit übersetzt der Alarmserver die Nutzlast selbst – nötig, weil der Netzserver im Gateway das nicht kann. Für Geräte mit Decoder im Netzserver bleibt es bei `Netzserver übersetzt` |
| **DevEUI / Seriennummer** | **die DevEUI** aus dem Netzserver – kopiert aus «Letzte Uplinks» oder aus der Geräteliste des Gateways. Gross-/Kleinschreibung und Bindestriche sind egal |
| **Standort** | der Standort, für den der Alarm gilt |
| **Zugewiesene Person** | nur bei einem tragbaren Knopf; beim fest montierten leer lassen |
| **Individuelle Alarmnachricht** | was die Empfangenden lesen. Schreiben Sie, **wo** und **was** – nicht «Alarm», sondern `Stiller Alarm Eingang Weststrasse – bitte sofort hingehen` |
| **Ausgelöstes Szenario** | welche Schritte die Alarmierten angezeigt bekommen |
| **Alarmierte Personengruppen** | wer den Alarm erhält |
| **Krisenstab aufbieten nach … Min. ohne Quittierung** | Regler. 5 Minuten sind ein üblicher Ausgangswert |

Speichern.

**Geprüft, wenn:** Der Knopf in der Liste steht. Ein Alarm über diesen Knopf ist
immer **still und quittierpflichtig** – das ist so gewollt und nicht einstellbar.

> **Was die Eskalation tut und was nicht:** Quittiert niemand rechtzeitig, wird
> der **Krisenstab** per Sprachanruf und SMS aufgeboten. **Polizei, Feuerwehr
> und Rettungsdienst werden nicht automatisch alarmiert** – das System hat keine
> Schnittstelle zu einer Einsatzleitzentrale. Der Notruf wird von Hand gewählt.

---

## Schritt 11 – Drücken und die Liste beobachten

**Ziel:** Die Kette steht.

Portal offen lassen bei **Integrationen → LoRaWAN-Netz / Alarmknöpfe →
«Letzte Uplinks»**. Dann den Knopf drücken. Innert Sekunden erscheint ein
Eintrag. Was dort steht, sagt Ihnen genau, wo Sie stehen:

| Eintrag | Bedeutung | Was zu tun ist |
| --- | --- | --- |
| **Alarm ausgelöst** | Die Kette steht. | Weiter mit Schritt 12. |
| **Statusmeldung** mit aufgeführten Feldern | Der Uplink kam an, aber kein Feld sah nach Alarm aus. | Die angezeigten Feldnamen ablesen und in Schritt 6c die Übersetzungszeile eintragen. |
| **Gerät nicht registriert** | Die DevEUI im Portal weicht ab. | Kennung aus der Liste kopieren und in Schritt 10 als Seriennummer eintragen. |
| **ohne übersetzte Nutzlast** | Niemand hat die Bytes übersetzt. | Bei den Dragino-Geräten: In Schritt 10 das **Modell** auswählen. Sonst: Decoder im Netzserver, Schritt 6b. |
| **Token abgewiesen** | Das Gateway sendet ein anderes Token. | Zurück zu Schritt 8, Token neu kopieren. |
| **Format nicht verstanden** | Die Integration schickt kein JSON. | In Schritt 8 Payload marshaler auf `JSON` stellen. |
| **zum laufenden Alarm gezählt** | Der Alarm dieses Knopfs läuft noch. | Gewollt – ein zweiter Alarm entsteht erst nach dem Beenden in der Alarmzentrale. |
| **gar nichts** | Der Uplink hat den Alarmserver nie erreicht. | Nicht im Portal suchen. Im Gateway nachsehen: Steht «Last seen» beim letzten Alarm still, sendet das Gerät nicht mehr – Tiefschlaf oder leerer Akku, siehe Anhang D. Sonst: Was meldet die HTTP-Integration als Antwort? |

Steht **Alarm ausgelöst**, läuft im Portal ein stiller Alarm, die alarmierten
Personen bekommen ihn aufs Telefon, und im **Ereignisprotokoll** steht
«Alarmknopf ausgelöst».

**Beenden Sie diesen Testalarm** in der Alarmzentrale, sonst läuft die
Eskalation weiter und bietet nach der eingestellten Zeit den Krisenstab auf.

> Zwei Drücke innerhalb von zwei Minuten gelten absichtlich als **ein**
> Ereignis. Warten Sie zwischen zwei Versuchen also kurz.

---

## Schritt 12 – Scharfstellen

**Ziel:** Der Knopf hängt dort, wo er hingehört, und funktioniert auch da.

1. **Am richtigen Ort prüfen.** Knopf montieren und **von dort aus** drücken.
   Die Funkabdeckung am Montageort ist eine andere als neben dem Gateway. Das
   gilt besonders für Untergeschoss, Technikraum und Therapiebad – dort ist der
   Empfang am schlechtesten und der Knopf am wichtigsten.
2. **Die Beteiligten einweihen.** Wer in den alarmierten Gruppen ist, muss
   wissen, dass dieser Knopf existiert, was er bedeutet und dass quittiert
   werden muss.
3. **Testalarm beenden** und im Ereignisprotokoll nachsehen, ob alles
   nachvollziehbar steht.
4. **Nach 24 Stunden** unter **Alarmknöpfe** nachsehen: «letztes Signal» muss
   frisch sein. Ist es das nicht, sendet der Knopf keine Lebenszeichen – dann
   wüssten Sie im Ernstfall nicht, ob er noch lebt.

Für jeden weiteren Knopf: Schritte 9 bis 12 wiederholen. Gleiches Modell heisst
gleiches Geräteprofil – Schritt 6 entfällt.

---

# Anhang A · Zwischenprüfung ohne Knopf

Sie können Schritt 7 und die Erreichbarkeit des Servers prüfen, bevor
überhaupt ein Knopf da ist. Von einem beliebigen Rechner mit Internet:

```bash
curl -sS -X POST "https://temp-gross-ict.ch/api/hooks/lorawan?token=IHR-TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"devEUI":"0102030405060708","rxInfo":[],"object":{"battery":95}}'
```

| Antwort | Bedeutung |
| --- | --- |
| `{"ok":true,"alarm":null}` | Alles richtig – sofern Sie einen Knopf mit dieser Kennung angelegt haben |
| `Kein Alarmknopf … registriert` | **Auch gut:** Server erreichbar, Token stimmt, nur das Gerät ist unbekannt |
| `Ungültiges Zugangstoken` | Token falsch kopiert |
| `Der LoRaWAN-Endpunkt ist … nicht aktiviert` | Schalter aus Schritt 7.1 fehlt |
| keine Antwort / Zeitüberschreitung | Der Alarmserver ist von aussen nicht erreichbar – dann funktioniert auch die App nicht |

Der Aufruf erscheint anschliessend in **«Letzte Uplinks»**, genau wie ein
echter Uplink.

---

# Anhang B · Wenn Sie es später doch über The Things Stack machen

Der Weg bleibt derselbe, nur die Teile 1 und 2 ändern sich: Gateway in Schritt 4
auf **Packet Forwarder** bzw. **Basics Station** stellen und auf
`eu1.cloud.thethings.network` richten, Gateway und Geräte in der TTN-Konsole
anlegen, und den Webhook aus Schritt 8 dort unter **Integrations → Webhooks →
Custom webhook** einrichten. Im Portal in Schritt 7.2 dann
**The Things Network / The Things Stack** wählen.

Bedenken Sie: Die Community-Edition ist ausdrücklich ohne Verfügbarkeitszusage
und hat eine Fair-Use-Richtlinie. Für eine Alarmkette, an der ein Notruf hängt,
ist das die schwächere Grundlage.

---

# Anhang D · Die beiden Dragino-Geräte

## Gemeinsames

Beide sprechen **LoRaWAN 1.0.3, Class A, OTAA** – das sind die Werte für das
Geräteprofil in Schritt 6a. Beide melden die Batterie als **Spannung**, nicht
in Prozent: der TrackerD im Feld `BAT` in Volt, der PB01 in Millivolt. Der
Alarmserver rechnet das um; ohne diese Umrechnung stünde im Portal dauerhaft
«4 %» und eine Batteriewarnung, die nie verstummt.

> **Zur Prozentangabe:** Sie ist aus der Spannung geschätzt, und die
> Entladekurve hängt an der Zelle. Beim PB01 wird der angezeigte Wert deshalb
> **zu tief** liegen. Für die Frage «bald wechseln?» reicht es trotzdem: Leer
> ist bei beiden Zelltypen um 3,0 V, und dort landet die Warnschwelle richtig.
> Als Restlaufzeit taugt der Wert nicht.

Der Alarmserver erkennt das Alarmfeld unabhängig von der Schreibweise – der
TrackerD schreibt `ALARM` gross, der PB01 `alarm` klein.

## TrackerD – der Alarmzustand bleibt

**Einschalten und anlernen:** Der TrackerD läuft, sobald der Akku geladen oder
USB angeschlossen ist; ein **kurzer Tastendruck** meldet ihn am Netz an. Grünes
Blitzen heisst «funkt», grünes Dauerlicht für fünf Sekunden heisst «beigetreten».

**Auslösen:** rote Taste **länger als 5 Sekunden** halten.

Danach sendet das Gerät den Alarm **bis zu sechzigmal im Minutentakt weiter**.
Das ist kein Fehler, sondern gewollt – aber es heisst:

- **Solange der Alarm im Portal läuft, wird jede Wiederholung demselben
  Ereignis zugeschlagen.** Es gibt keine Alarmlawine.
- **Beenden Sie den Alarm im Portal, ohne den Alarmzustand am Gerät zu
  verlassen, löst die nächste Wiederholung einen neuen Alarm aus.** Das ist
  richtig so: Das Gerät meldet weiterhin Alarm.
- **Beim Entwarnen deshalb zuerst das Gerät zurücksetzen:** rote Taste
  **zehnmal schnell** drücken. Die rote Leuchte bleibt fünf Sekunden an – dann
  ist der Alarmzustand verlassen. Erst danach den Alarm im Portal beenden.

> **Vorsicht, zwei Handgriffe liegen gefährlich nahe beieinander.**
>
> | Ziel | Handgriff |
> | --- | --- |
> | Alarm auslösen | Taste **über 5 Sekunden** halten |
> | Alarmzustand verlassen | **zehnmal kurz** drücken – **ohne vorher zu halten** |
> | **Tiefschlaf** (Gerät verstummt ganz) | Taste **10 Sekunden** halten, **dann** kurz drücken |
>
> Wer die Taste zum Auslösen zu lange hält und danach die schnellen Drücke
> folgen lässt, schickt das Gerät in den **Tiefschlaf** statt aus dem
> Alarmzustand. Es sendet dann gar nichts mehr, und im Gateway bleibt
> «Last seen» beim letzten Alarm stehen.
>
> **Abhilfe: die Reset-Taste drücken.** Danach meldet sich das Gerät wieder.
> Lassen Sie beim Auslösen die Taste los, sobald der Alarm gesendet ist –
> länger als nötig zu halten bringt nichts und kostet im schlimmsten Fall das
> ganze Gerät für den Moment.

Nehmen Sie diesen Handgriff in die Einweisung auf. Wer ihn nicht kennt, endet
mit einem Alarm, der sich nicht abstellen lässt.

**GPS in Gebäuden:** Der TrackerD ist ein Ortungsgerät. Der Alarm geht über
LoRaWAN und funktioniert auch drinnen – die Position nicht oder nur veraltet.
Nach dem Auslösen blinkt das Gerät blau und sucht Satelliten; drinnen endet das
meist mit zweimal Rot. Für die Alarmierung spielt das keine Rolle: Sie ist zu
diesem Zeitpunkt bereits zugestellt. Der Alarmserver wertet die Koordinaten des
TrackerD bewusst nicht aus.
Verlassen Sie sich im Gebäude auf den im Portal hinterlegten Standort des
Knopfs, nicht auf die mitgeschickten Koordinaten.

### Haltezeit der Alarmtaste ändern

Ab Werk muss die rote Taste **fünf Sekunden** gehalten werden. Das lässt sich
zwischen 0 und 10 Sekunden einstellen:

| Weg | Befehl |
| --- | --- |
| Über Funk (Downlink) | `BA` + ein Byte mit den Sekunden – `BA02` für zwei Sekunden |
| Über USB-C (115200 Baud) | `AT+EAT=2` |

Der Funkweg ist der bequemere: Im Gateway beim Gerät auf den Reiter
**`Downlink`**, dort die Hex-Bytes eintragen und senden.

Den Befehl müssen Sie nicht von Hand ausrechnen: Im Portal steht beim Knopf
unter **Haltezeit der Alarmtaste** ein Feld für die gewünschte Zeit, daneben
die fertigen Hex-Bytes zum Kopieren. Senden müssen Sie sie weiterhin im
Gateway – **der Alarmserver kann das nicht**, denn das Gateway steht hinter
Ihrem Router, er beim Hoster, und alle Verbindungen gehen von innen nach
aussen.

> **Ein Downlink erreicht das Gerät erst nach dem nächsten Uplink.** Ein
> Class-A-Gerät hört nur kurz nach dem eigenen Senden zu. Der Befehl bleibt
> also in der Warteschlange, bis das Gerät sich das nächste Mal meldet –
> drücken Sie danach einmal die Taste, dann kommt er an.

**Welche Zeit ist richtig?** Eine Abwägung, die Ihnen gehört:

- **Kurz (1–2 s):** schneller im Ernstfall, aber ein Gerät in der Hosentasche
  löst leichter versehentlich aus.
- **Lang (5 s):** kaum Fehlalarme, aber fünf Sekunden sind lang, wenn man
  bedrängt wird.

Zwei bis drei Sekunden sind für ein getragenes Gerät ein brauchbarer
Mittelweg. Bedenken Sie dabei, was ein Fehlalarm kostet: Nach der eingestellten
Zeit ohne Quittierung wird der Krisenstab aufgeboten. Ein Irrtum lässt sich in
der App als **Fehlalarm** melden – aber erst, nachdem er alle erreicht hat.

## PB01 – der einfache Fall

**Auslösen:** Taste drücken. Das Gerät sendet sofort einen Uplink mit gesetztem
Alarmfeld – keine Wiederholung, kein Zurücksetzen nötig.

Für den festen Platz an der Wand ist das das passendere Gerät.

**Haltezeit:** Auch der PB01 kennt eine Mindestdauer, hier in **Millisekunden**:

| Weg | Befehl |
| --- | --- |
| Über Funk (Downlink) | `A2` + zwei Byte – `A201F4` für 500 ms |
| Über Kabel (9600 Baud, Passwort `123456`) | `AT+STIME=500` |

Die Herstellerdokumentation nennt als Bereich 0 bis 1000 Millisekunden, also
höchstens eine Sekunde; an anderer Stelle widerspricht sie sich. Probieren Sie
den gewünschten Wert am Gerät aus, statt sich auf die Angabe zu verlassen.

Anders als beim TrackerD geht es hier nicht um einen Notfallgriff, sondern um
eine Entprellung: Sie verhindert, dass ein Streifen an der Wand einen Alarm
auslöst.

---

# Anhang C · Was dieser Weg nicht leistet

Das gehört auf den Tisch, bevor sich jemand darauf verlässt.

- **Ohne Internet am Standort kommt kein Alarm durch.** Die Kette führt über
  Ihre Leitung zum Server beim Hoster. Fällt die Leitung aus, hilft auch das
  Gateway im Haus nichts.
- **Keine Rückmeldung an den Knopf.** Wer drückt, erfährt vom Gerät nicht, dass
  der Alarm angekommen ist. Ein Knopf, der das könnte, bräuchte einen Downlink –
  vorgemerkt, aber nicht gebaut.
- **Ein Gateway ist eine einzelne Stelle, an der alles hängt.** Kein zweites
  Gerät fängt seinen Ausfall auf. Ein zweites Gateway ergäbe ohne jede
  Konfiguration Redundanz: LoRaWAN funktioniert als Rundruf, der Netzserver
  verwirft die Duplikate.
- **Die Überwachung meldet einen stummen Knopf erst nach der eingestellten
  Stundenzahl**, nicht sofort.
- **Ein Gateway deckt kaum drei Standorte ab.** Messen Sie, bevor Sie planen.

Ein LoRaWAN-Knopf ist eine gute **Ergänzung** zur App – für Räume ohne
Mobilfunk, für Personen ohne Diensttelefon, für den festen Platz an der Wand.
Als alleiniger Alarmweg ist er der schwächere.
