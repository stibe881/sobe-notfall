# LoRaWAN-Alarmknöpfe anbinden

Für das **RAK WisGate Edge Lite 2** und den Alarmserver auf
`https://temp-gross-ict.ch`.

---

## 0. Zuerst das Unangenehme

**Ein Gateway allein löst keinen Alarm aus.** Es ist nur die Antenne. Was Sie
zusätzlich brauchen:

| Was | Warum |
| --- | --- |
| **LoRaWAN-Alarmknöpfe** | Das Gateway empfängt nur; gedrückt wird der Knopf. Ohne Knöpfe gibt es nichts zu empfangen. |
| **Ein Netzserver** | Das Gateway reicht rohe Funkpakete weiter. Erst der Netzserver entschlüsselt sie und macht JSON daraus. |
| **Ein Payload-Decoder** | Jeder Hersteller kodiert den Knopfdruck anders. Ohne Decoder kommt ein Uplink an, den niemand deuten kann. |

Haben Sie noch keine Knöpfe: Achten Sie darauf, dass für das Modell ein
Payload-Decoder verfügbar ist (die gängigen Hersteller veröffentlichen ihn) und
dass es ein **EU868**-Gerät ist. Geräte mit Quittierung (das Gerät blinkt oder
vibriert, wenn der Alarm angekommen ist) sind einem Knopf ohne Rückmeldung
vorzuziehen – wer im Ernstfall drückt, will wissen, dass es geklappt hat.

---

## 1. Der Weg eines Knopfdrucks

```
Knopf  --LoRa-Funk-->  WisGate Edge Lite 2  --Internet (ausgehend)-->  Netzserver
                                                                          |
                                                        HTTPS-Webhook     |
                                                                          v
                                    https://temp-gross-ict.ch/api/hooks/lorawan
                                                                          |
                                                    Alarmknopf über DevEUI gefunden
                                                                          v
                                             stiller Alarm, Push/SMS, Eskalation
```

**Das Gateway spricht nie direkt mit dem Alarmserver.** Deshalb ist es kein
Problem, dass das Gateway bei Ihnen steht und der Server bei Hetzner:

- keine Portfreigabe im Router
- keine feste IP-Adresse
- kein VPN

Alle Verbindungen gehen **von innen nach aussen**. Das Gateway braucht nur
Internet; der Alarmserver ist unter seiner öffentlichen Adresse ohnehin
erreichbar – sonst käme die App auch nicht durch.

---

## 2. Die Entscheidung: welcher Netzserver

Genau hier müssen Sie sich festlegen. Beide Wege funktionieren mit diesem
Server; der Unterschied ist betrieblicher Art.

### A) Netzserver im Gateway (empfohlen)

Das WisGate Edge Lite 2 bringt einen eigenen Netzserver mit. Die Knöpfe melden
sich beim Gateway an, das Gateway schickt die fertige Meldung direkt an den
Alarmserver.

**Dafür spricht:** Eine Partei weniger und ein Internet-Weg weniger in einer
Kette, die im Ernstfall halten muss. Die Funkdaten verlassen Ihr Haus nur auf
dem Weg zum eigenen Server – für eine Schule mit besonders schutzbedürftigen
Schüler:innen kein Nebenaspekt.

**Dagegen spricht:** Die Geräteschlüssel liegen nur auf dem Gateway. Geht es
kaputt, müssen alle Knöpfe neu angelernt werden. Notieren Sie darum von jedem
Gerät **DevEUI, AppEUI/JoinEUI und AppKey** (stehen auf dem Etikett oder im
beiliegenden Zettel) und bewahren Sie sie sicher auf.

### B) The Things Stack (TTN)

Das Gateway arbeitet als reiner Paketweiterleiter, der Netzserver läuft in der
Cloud, von dort geht ein Webhook an den Alarmserver.

**Dafür spricht:** Bequemere Geräteverwaltung, sehr gute Live-Ansicht zum
Fehlersuchen, und der Gerätebestand überlebt einen Gateway-Defekt.

**Dagegen spricht – und das ist der Punkt:** Die Community-Edition ist
ausdrücklich ohne Verfügbarkeitszusage und hat eine Fair-Use-Richtlinie. Für
eine Alarmkette, an der ein Notruf hängt, ist das die schwächere Grundlage. Wer
diesen Weg produktiv gehen will, nimmt den kostenpflichtigen Dienst.

> **Empfehlung:** Weg A. Bei drei Standorten und einem Gateway ist der
> eingebaute Netzserver der kürzere und ehrlichere Weg. Weg B lohnt sich, sobald
> mehrere Gateways zentral verwaltet werden sollen.

Die folgenden Schritte beschreiben **Weg A**. Für Weg B stellen Sie das Gateway
stattdessen auf *Packet Forwarder* bzw. *Basics Station* mit dem Server
`eu1.cloud.thethings.network` und richten den Webhook aus Schritt 6 in der
TTN-Konsole unter **Integrations → Webhooks → Custom webhook** ein; alles
Übrige ist gleich.

---

## 3. Gateway erreichen und einrichten

1. Gateway mit Strom und – am einfachsten – mit dem LAN-Kabel ans Netz.
2. Oberfläche im Browser öffnen. Ohne Kabel spannt das Gerät ein eigenes WLAN
   auf (Name beginnt mit `RAK`); die Oberfläche liegt dann unter
   `http://192.168.230.1`. Die Zugangsdaten stehen im Handzettel des Geräts.
3. **Passwort sofort ändern.** Das Gateway hängt in Ihrem Schulnetz.
4. Unter den LoRa-Einstellungen den **Frequenzplan EU868** wählen – für die
   Schweiz der einzig zulässige.
5. Betriebsart auf **Built-in Network Server** (je nach Firmware *Network
   Server* oder *LoRaWAN Network Server*) umstellen und speichern.

**Prüfen:** Die Statusseite meldet den Netzserver als laufend, und der
Frequenzplan steht auf EU868.

### Wo das Gateway stehen sollte

LoRa ist reichweitenstark, aber kein Zauberwerk. Das Gateway gehört möglichst
hoch und frei – nicht in den Technikschrank im Keller. Massive Betondecken,
Aufzugsschächte und Metallschränke kosten jeweils spürbar Reichweite. Bei drei
Standorten wird **ein** Gateway kaum alle drei abdecken; prüfen Sie das mit
einem Knopf vor Ort, bevor Sie sich darauf verlassen.

---

## 4. Anwendung, Geräteprofil und Decoder anlegen

Im Netzserver des Gateways:

1. Eine **Anwendung** anlegen, z. B. `sobe-notfall`.
2. Ein **Geräteprofil** anlegen: LoRaWAN-Version und Regionalparameter nach
   Datenblatt des Knopfs, Aktivierung in der Regel **OTAA**.
3. Im Geräteprofil den **Payload-Decoder** des Herstellers eintragen
   (JavaScript-Funktion `decodeUplink` bzw. `Decode`).

> **Schritt 3 ist nicht optional.** Ohne Decoder kommt der Uplink zwar an, aber
> ohne übersetzte Nutzlast. Der Alarmserver erkennt das inzwischen, weist den
> Uplink mit einer Fehlermeldung ab und schreibt einen Eintrag ins
> Ereignisprotokoll – ein Knopfdruck löste sonst stillschweigend nichts aus.

Der Decoder muss ein Feld liefern, an dem ein Knopfdruck zu erkennen ist. Der
Alarmserver wertet `alarm`, `button`, `pressed`, `sos`, `panic`, `emergency`,
`alert`, `press` und ähnliche Namen aus, ebenso Ereignisfelder wie
`event: "sos"` oder `type: "button_pressed"`.

Zusätzlich verwertet werden, wenn vorhanden: `battery` (Prozent oder Anteil)
sowie `latitude`/`longitude`. Alles Weitere wird ignoriert.

### Wenn der Decoder des Herstellers andere Namen benutzt

Nehmen Sie den Decoder unverändert und hängen Sie **eine Übersetzungszeile**
an. So bleibt er bei einem Update des Herstellers austauschbar:

```js
// ... hier steht der unveränderte Decoder des Herstellers ...

// Übersetzung für SOBE Notfall: heisst das Feld beim Hersteller anders,
// hier den richtigen Namen einsetzen.
if (data.press_type === 'long' || data.alarm_status === 1) {
  data.alarm = true
}
```

Welche Felder Ihr Decoder tatsächlich liefert, müssen Sie nicht raten: Das
Portal zeigt es unter **Integrationen → LoRaWAN → Letzte Uplinks** bei jedem
eingetroffenen Uplink an (Schritt 7).

---

## 5. Knopf zweimal anlegen

Der Knopf muss an zwei Stellen bekannt sein.

**Im Netzserver des Gateways:** Gerät mit DevEUI, AppEUI/JoinEUI und AppKey vom
Etikett anlegen, dem Geräteprofil und der Anwendung zuordnen. Dann den Knopf
anlernen (meist langer Tastendruck); das Gerät erscheint als beigetreten.

**Im Portal** unter **Alarmknöpfe → Neuer Knopf**:

| Feld | Inhalt |
| --- | --- |
| Bezeichnung | sprechender Ort, z. B. «Eingang Weststrasse» |
| Typ | LoRaWAN |
| **Seriennummer** | **die DevEUI** – Schreibweise egal, Trennzeichen und Gross-/Kleinschreibung werden ignoriert |
| Standort | der Standort, für den der Alarm gilt |
| Individuelle Alarmnachricht | was die Empfangenden lesen |
| Ausgelöstes Szenario, Personengruppen, Eskalation | wie gewünscht |

Die Zuordnung läuft ausschliesslich über die DevEUI. Stimmt sie nicht, antwortet
der Endpunkt mit «Kein Alarmknopf mit der Seriennummer … registriert».

---

## 6. Endpunkt einschalten und Webhook eintragen

Im Portal unter **Integrationen → LoRaWAN-Netz / Alarmknöpfe**:

1. Schalter **Uplink-Endpunkt** einschalten.
2. Netzserver auf **ChirpStack** stellen (der eingebaute Netzserver ist
   ChirpStack; bei Weg B auf TTN).
3. **Token erzeugen** und kopieren. Adresse und Token stehen darunter:
   ```
   https://temp-gross-ict.ch/api/hooks/lorawan
   ```
4. Warnschwellen prüfen: «ohne Signal nach Stunden» auf das Melde-Intervall
   Ihrer Knöpfe abstimmen, «Batterie unter %» nach Bedarf.

Im Netzserver des Gateways bei der Anwendung eine **HTTP-Integration**
einrichten und die Adresse aus Schritt 3 als Ziel für Uplink-Ereignisse
eintragen. Für das Token gibt es zwei Wege:

- **Bevorzugt:** Kopfzeile `Authorization: Bearer IHR-TOKEN`.
- **Falls die Oberfläche keine eigenen Kopfzeilen erlaubt:** das Token an die
  Adresse hängen – `…/api/hooks/lorawan?token=IHR-TOKEN`. Funktioniert genauso,
  steht aber in Protokolldateien; dann das Token gelegentlich erneuern.

---

## 7. Prüfen

Lassen Sie beim Einrichten im Portal **Integrationen → LoRaWAN-Netz /
Alarmknöpfe** offen. Unter **Letzte Uplinks** erscheint dort jeder eintreffende
Uplink innert zehn Sekunden – **auch ein abgewiesener**, mit dem Grund im
Klartext und der Gerätekennung zum Kopieren. Das ist die Antwort auf die Frage,
die man sonst nicht beantworten kann: Liegt es am Gateway oder am Portal?

**a) Endpunkt von aussen erreichbar** (von einem beliebigen Rechner):

```bash
curl -sS -X POST "https://temp-gross-ict.ch/api/hooks/lorawan?token=IHR-TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"devEUI":"IHRE-DEVEUI","rxInfo":[],"object":{"battery":95}}'
```

Erwartet: `{"ok":true,"alarm":null}`. Im Portal steht bei **Alarmknöpfe** jetzt
ein frisches «letztes Signal» und 95 % Batterie.

Andere Antworten:

| Antwort | Bedeutung |
| --- | --- |
| `403` nicht aktiviert | Schalter in Schritt 6.1 fehlt |
| `401` ungültiges Token | Token falsch kopiert oder inzwischen erneuert |
| `404` kein Alarmknopf … | DevEUI im Portal stimmt nicht mit der gesendeten überein |
| `422` ohne übersetzte Nutzlast | Payload-Decoder fehlt (Schritt 4.3) |

**b) Echter Knopfdruck.** Knopf drücken. Unter **Letzte Uplinks** muss innert
Sekunden ein Eintrag erscheinen. Steht dort:

- **«Alarm ausgelöst»** – fertig, die Kette steht.
- **«Statusmeldung»** mit aufgeführten Feldern – der Uplink kam an, aber kein
  Feld sah nach Alarm aus. Die angezeigten Feldnamen sagen Ihnen, was Sie in der
  Übersetzungszeile aus Schritt 4 einsetzen müssen.
- **«Gerät nicht registriert»** – die angezeigte Kennung kopieren und unter
  **Alarmknöpfe** als Seriennummer eintragen.
- **«ohne übersetzte Nutzlast»** – der Payload-Decoder fehlt.
- **«Token abgewiesen»** – der Netzserver schickt ein anderes Token.
- **gar nichts** – der Uplink hat den Alarmserver nie erreicht. Weiter im
  Netzserver des Gateways: Kommt der Uplink dort an, und was meldet die
  HTTP-Integration als Antwort?

Läuft alles, steht im Portal ein stiller Alarm und im **Ereignisprotokoll**
«Alarmknopf ausgelöst».

Zwei Drücke innerhalb von zwei Minuten gelten absichtlich als **ein** Ereignis –
sonst löst ein nervöser Daumen drei Alarme aus.

**c) Der Weg als Ganzes.** Lassen Sie jemanden am vorgesehenen Ort drücken,
während Sie am Portal sitzen. Erst dieser Durchlauf zeigt, ob die Funkabdeckung
an genau dieser Stelle reicht.

---

## 8. Was dieser Weg nicht leistet

Das gehört auf den Tisch, bevor sich jemand darauf verlässt.

- **Ohne Internet am Standort kommt kein Alarm durch.** Die Kette führt über
  Ihre Leitung zum Server bei Hetzner. Fällt die Leitung aus, hilft auch das
  Gateway im Haus nichts. Wer das abdecken will, braucht einen Alarmserver vor
  Ort oder ein Gateway mit Mobilfunk als Rückfallebene.
- **Keine Rückmeldung an den Knopf.** Der Server bestätigt dem Netzserver den
  Empfang, schickt aber keinen Downlink an das Gerät. Ein Knopf, der nach
  erfolgreicher Alarmierung blinken soll, braucht diese Erweiterung – sie ist
  vorgemerkt, aber nicht gebaut.
- **Ein Gateway ist eine einzelne Stelle, an der alles hängt.** Kein zweites
  Gerät fängt seinen Ausfall auf. Die Überwachung im Portal meldet stumme
  Knöpfe – nach Ablauf der eingestellten Stundenzahl, nicht sofort.
- **Funkabdeckung ist nicht garantiert.** LoRa im 868-MHz-Band unterliegt
  zudem Sendezeitbeschränkungen; für einzelne Knopfdrücke unkritisch, für
  häufige Statusmeldungen nicht.

Ein LoRaWAN-Knopf ist eine gute **Ergänzung** zur App – für Räume ohne
Mobilfunk, für Personen ohne Diensttelefon, für den festen Platz an der Wand.
Als alleiniger Alarmweg ist er der schwächere.

---

## 9. Fehlersuche

Erste Anlaufstelle ist immer **Integrationen → LoRaWAN → Letzte Uplinks**. Steht
dort nichts, hat der Alarmserver nie etwas gesehen – dann liegt es am Gateway
oder am Netzserver, nicht am Portal.

| Beobachtung | Wo zuerst nachsehen |
| --- | --- |
| Knopf erscheint im Netzserver nicht | Anlernen wiederholen; AppKey prüfen; Gateway zu weit weg |
| Uplink im Netzserver, aber nichts im Portal | HTTP-Integration: Adresse, Token, Antwortcode der letzten Zustellung |
| `422` ohne übersetzte Nutzlast | Payload-Decoder im Geräteprofil fehlt oder wirft einen Fehler |
| Uplink kommt an, aber kein Alarm | Decoder liefert kein erkennbares Feld – `data.alarm = true` ergänzen |
| `404` kein Alarmknopf | DevEUI im Portal gegen die des Geräts halten |
| Alarm zu selten | Zwei Drücke in zwei Minuten sind ein Ereignis – so gewollt |
| «Knopf meldet sich nicht mehr» im Protokoll | Batterie, Funkabdeckung, oder Stundenschwelle zu knapp eingestellt |
