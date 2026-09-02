# SOBE Notfall – Alarmserver

Gemeinsamer Datenbestand für Webportal und iOS-App. Ohne diesen Server sind beide
getrennte Welten: Ein im Portal angelegter Benutzer existiert auf dem Telefon nicht,
und ein Alarm erreicht nur das Gerät, auf dem er ausgelöst wurde.

## Was der Server übernimmt

- **Konten und Anmeldung** – E-Mail und Passwort, Sitzungs-Token, Rollenprüfung.
  Passwörter liegen als PBKDF2-SHA256-Hash (210 000 Runden, Zufalls-Salt) in der
  Datenbank und verlassen den Server nie.
- **Gemeinsamer Datenbestand** – Benutzer, Gruppen, Standorte, Szenarien,
  Alarmpläne, Notrufnummern, Alarme, Alleinarbeits-Timer, Ereignisprotokoll.
- **Alarmverarbeitung** – Eskalationsstufen und abgelaufene Alleinarbeits-Timer
  werden serverseitig ausgewertet, auch wenn kein Gerät eingeschaltet ist.
- **Echte Push-Nachrichten** an alle registrierten iPhones über den Expo-Push-Dienst.
- **Live-Aktualisierung** über Server-Sent Events: Jede Änderung erreicht alle
  offenen Portale und Apps sofort, ohne Neuladen.
- **Aktualisierung per Knopfdruck** aus dem Portal – siehe unten.

## Portal und Schnittstelle unter einer Adresse

Liegt unter `SOBE_WEB_ROOT` ein gebautes Portal (`dist/index.html`), liefert der
Server beides aus: das Portal unter `/`, die Schnittstelle unter `/api`. Der
Client erkennt das und spricht dieselbe Adresse an – ohne Einstellung, ohne
CORS, ohne Mixed-Content. Für den Betrieb auf einem Hosting ist das der
empfohlene Aufbau, siehe [`../DEPLOY-HETZNER.md`](../DEPLOY-HETZNER.md).

In der Entwicklung läuft das Portal weiterhin getrennt über Vite auf Port 5173;
dort zeigt der Client wie bisher auf `http://localhost:3001`.

## Starten

```bash
cd server
npm install
npm run dev      # Entwicklung mit automatischem Neustart
npm run build    # Übersetzen nach dist/
npm start        # Produktionsbetrieb
```

Der Server läuft auf `http://localhost:3001`. Die Datenbank ist eine einzelne
Datei unter `server/data/sobe-notfall.sqlite` – zum Sichern genügt es, diese Datei
zu kopieren.

### Einstellungen über die Datei server/.env

Am einfachsten über eine Datei, damit Zugangsdaten nicht in der Kommandozeile
oder in Systemeinstellungen stehen:

```bash
cd server
copy .env.example .env      # Windows
cp .env.example .env        # Linux/macOS
```

Dann die gewünschten Werte eintragen und den Server neu starten. Beim Start
meldet er `[env] Einstellungen aus … geladen`.

`server/.env` ist von der Versionsverwaltung ausgenommen und darf nie
eingecheckt werden. Ausgaben des Update-Laufs werden vor der Anzeige im Portal
von bekannten Geheimnissen bereinigt.

### Einstellungen über Umgebungsvariablen

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `PORT` | Port des Servers | `3001` |
| `HOST` | Netzwerkschnittstelle (`127.0.0.1` = nur lokal) | `0.0.0.0` |
| `SOBE_WEB_ROOT` | Verzeichnis mit dem gebauten Portal | `../dist` |
| `SOBE_DB_PATH` | Pfad der Datenbankdatei | `data/sobe-notfall.sqlite` |
| `SOBE_ADMIN_EMAIL` | Konto des ersten Administrators | `admin@sobe-notfall.local` |
| `SOBE_SEED_PROFILE` | Erstbefüllung: `standard` (neutral, mit Einrichtungsassistent) oder `sonnenberg` | `standard` – bestehende Installationen bleiben automatisch `sonnenberg` |
| `SOBE_ADMIN_PASSWORD` | Erstpasswort dieses Kontos | `SOBE-Start2026!` |
| `SOBE_REPO_ROOT` | Arbeitsverzeichnis für die Aktualisierung | ein Verzeichnis über `server/` |
| `SOBE_AUTO_RESTART` | Neustart nach der Aktualisierung (`false` schaltet ihn ab) | an |
| `SOBE_PUBLIC_URL` | Öffentliche Adresse des Servers – für den LoRaWAN-Endpunkt und die Graph-Rückrufe | wird aus der Anfrage abgeleitet |
| `EXPO_TOKEN` | Zugangstoken von expo.dev, nötig für die App-Builds | – |
| `SOBE_EAS_PLATFORMS` | Plattformen des App-Builds über den Update-Knopf: `ios`, `android` oder `all` | `ios` |

Beim ersten Start werden Standorte, Gruppen, Szenarien, Alarmplan-Vorlagen und
Notrufnummern angelegt sowie ein Administratorkonto mit erzwungenem
Passwortwechsel. Beispiel-Benutzer gibt es bewusst keine – der Server ist der
Live-Betrieb.

Es existiert immer mindestens ein anmeldefähiger Administrator: Der letzte lässt
sich weder löschen noch herabstufen, und fehlt er, wird er beim Start wiederhergestellt.

## Vom Telefon aus erreichbar machen

> Die App muss aus einem Build stammen, der die Serveranbindung enthält
> (ab Commit «iOS-App: Live-Modus läuft über den Alarmserver»). Ältere
> TestFlight-Builds prüfen die Anmeldung noch auf dem Gerät und kennen die
> Konten des Servers nicht – dort meldet die App «E-Mail-Adresse oder Passwort
> ist falsch», obwohl das Konto auf dem Server existiert. In diesem Fall ist ein
> neuer Build nötig.


Im selben Netz genügt die IP-Adresse des Rechners, auf dem der Server läuft:

```
# Windows
ipconfig        # IPv4-Adresse suchen, z. B. 192.168.1.42
```

In der App wird dann `http://192.168.1.42:3001` als Serveradresse eingetragen –
auf der Anmeldemaske unter «Alarmserver».

Damit iOS diese Verbindung überhaupt zulässt, trägt `mobile/app.json` zwei
Einträge in die Info.plist ein: `NSAppTransportSecurity.NSAllowsLocalNetworking`
erlaubt unverschlüsselte Verbindungen ins lokale Netz (nicht ins Internet), und
`NSLocalNetworkUsageDescription` liefert den Text für die Nachfrage, die iOS beim
ersten Zugriff aufs lokale Netz stellt. Diese Nachfrage muss bestätigt werden –
wird sie abgelehnt, bleibt der Server für die App unerreichbar (Einstellungen →
SOBE Notfall → Lokales Netzwerk).
Für den Betrieb ausserhalb des Schulnetzes gehört der Server hinter HTTPS
(Reverse Proxy mit Zertifikat) – Passwörter und Token dürfen nicht unverschlüsselt
über fremde Netze gehen.

## Wenn die Anmeldung nicht klappt

Im Live-Modus kommen alle Konten vom Server – ohne laufenden Server gibt es keine
Anmeldung. Die Anmeldemaske sagt das inzwischen ausdrücklich und zeigt bei einer
frischen Installation Konto und Erstpasswort an.

Zwei Werkzeuge helfen weiter:

```bash
npm run accounts                                   # welche Konten kennt der Server?
npm run reset-admin                                # erstes Administratorkonto, neues Zufallspasswort
npm run reset-admin -- name@schule.ch              # bestimmtes Konto
npm run reset-admin -- name@schule.ch Neu2026sicher
```

`accounts` zeigt für jedes Konto, ob ein Passwort gesetzt ist, ob ein Wechsel
offen ist und wann die letzte Anmeldung war. `reset-admin` setzt ein neues
Passwort, beendet alle bestehenden Anmeldungen des Kontos und erzwingt den
Wechsel bei der nächsten Anmeldung.

Häufige Ursachen:

| Meldung | Ursache |
| --- | --- |
| «Der Alarmserver … ist nicht erreichbar» | Server läuft nicht oder die Adresse stimmt nicht – Adresse auf der Anmeldemaske prüfen |
| «E-Mail-Adresse oder Passwort ist falsch» | Passwort wurde bereits geändert, oder es ist eine andere Datenbankdatei im Einsatz (`SOBE_DB_PATH`) |
| «Für dieses Konto ist noch kein Passwort gesetzt» | Konto wurde ohne Passwort angelegt – in der Benutzerverwaltung eines vergeben |

## Aktualisierung per Knopfdruck

Administratoren finden im Portal in der Seitenleiste den Knopf **Aktualisierung**.
Dort ist der aktuelle Stand sichtbar (Branch, Commit, ob Änderungen offen sind),
und es gibt zwei Möglichkeiten:

| Auswahl | Was passiert | Dauer |
| --- | --- | --- |
| **Nur Server** | `git fetch` → `git pull --ff-only` → Abhängigkeiten von Portal und Server → beide bauen → Server neu starten | wenige Minuten |
| **Server und iOS-App** | zusätzlich Abhängigkeiten der App und `eas build --platform ios --profile production --auto-submit --no-wait` | ein bis zwei Minuten |

Der iOS-Build wird nur angestossen: Er läuft auf den Servern von Expo weiter und
geht von dort automatisch an TestFlight. Der Lauf im Portal wartet bewusst nicht
darauf – sonst hinge er eine dreiviertel Stunde, der Server könnte nicht neu
starten, und ein Verbindungsabbruch sähe wie ein Fehlschlag aus. Der Fortschritt
ist über den Link zum Build bei Expo einsehbar.

Jeder Schritt wird mit Status und vollständiger Ausgabe angezeigt, auch wenn
etwas fehlschlägt. Bricht ein Schritt ab, werden die folgenden übersprungen und
es wird nicht neu gestartet.

Die Befehle liegen fest im Server (`src/update.ts`); der Client wählt nur den
Umfang. Die Endpunkte sind Administratoren vorbehalten.

### Voraussetzungen

**Neustart.** Der Server beendet sich nach einer erfolgreichen Aktualisierung
mit Code 0. Damit er mit dem neuen Stand wieder hochkommt, muss er unter einem
Dienstverwalter laufen:

```bash
npm run serve                  # Linux/macOS: mitgelieferte Neustart-Schleife
scripts\run.cmd                # Windows: dasselbe als Batch-Datei
```

Für den Dauerbetrieb ist systemd besser – eine Vorlage liegt unter
`scripts/sobe-notfall.service` (mit `Restart=always`). Alternativ pm2:

```bash
pm2 start dist/index.js --name sobe-notfall
```

Ohne Dienstverwalter setzen Sie `SOBE_AUTO_RESTART=false`; die Aktualisierung
läuft dann durch, der Neustart erfolgt von Hand.

**npm und git im Suchpfad.** Der Update-Lauf ruft `git`, `npm` und `npx` auf.
Diese müssen für den Benutzer erreichbar sein, unter dem der Server läuft – wird
er als Dienst gestartet, ist der Suchpfad oft ein anderer als in der eigenen
Sitzung. Fehlt etwas, nennt das Protokoll den Befehl und den Grund.

**Git-Zugang.** `git pull` läuft unter dem Benutzer des Servers. Für ein
privates Repository muss dort ein Deploy-Key (SSH) oder ein Token im
Anmeldespeicher hinterlegt sein – sonst scheitert der Schritt mit einer
Zugriffsmeldung im Protokoll.

**iOS-Build.** Der Build läuft mit `EAS_NO_VCS=1`. Ohne das verlangt eas-cli im
nicht interaktiven Betrieb ein sauberes Git-Verzeichnis – nach `npm install`
sind die Lock-Dateien aber häufig verändert, und der Build bräche nach allen
anderen Schritten ab. Mit dieser Einstellung packt EAS das Arbeitsverzeichnis
direkt und beachtet dabei weiterhin `.gitignore` und `.easignore`.

Zusätzlich braucht der Server ein Zugangstoken von expo.dev als `EXPO_TOKEN`:

1. Auf [expo.dev](https://expo.dev) unter *Account settings → Access tokens*
   ein Token erstellen.
2. Auf dem Server hinterlegen, z. B. in der systemd-Unit:
   `Environment=EXPO_TOKEN=...`
3. Server neu starten.

Ohne Token bleibt die Auswahl «Server und iOS-App» gesperrt und nennt den Grund.
Die Apple-Zugangsdaten für die Übermittlung an TestFlight verwaltet EAS selbst
(einmalig über `eas credentials` eingerichtet).

## Schnittstelle

Alle Endpunkte unter `/api`, Authentifizierung über `Authorization: Bearer <token>`.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| POST | `/auth/login` | Anmelden, liefert Token und Konto |
| POST | `/auth/logout` | Abmelden |
| GET | `/auth/me` | Eigenes Konto |
| POST | `/auth/password` | Eigenes Passwort ändern |
| GET | `/state` | Vollständiger Datenbestand |
| GET | `/events?token=` | Live-Aktualisierung (SSE) |
| POST/DELETE | `/users`, `/users/:id` | Benutzerverwaltung (nur Administration) |
| POST/DELETE | `/groups`, `/locations` | Stammdaten (nur Administration) |
| POST/DELETE | `/scenarios`, `/plans`, `/contacts`, `/buttons` | Konfiguration (Administration und Krisenstab) |
| POST | `/integrations` | Gateways und Webhooks (nur Administration) |
| POST | `/integrations/sms/test`, `/integrations/teams/test`, `/integrations/telephony/test` | Verbindungstests der Gateways (nur Administration) |
| GET/POST | `/integrations/lorawan`, `/integrations/lorawan/token` | LoRaWAN-Endpunkt: Adresse und Zugangstoken (nur Administration) |
| POST | `/hooks/lorawan` | Uplink der Alarmknöpfe (Token statt Anmeldung; TTN v3, ChirpStack v4 oder generisches JSON) |
| POST | `/graph/callback` | Rückrufe der Microsoft-Graph-Anrufschnittstelle |
| POST | `/geo/report` | Geofencing: Aufenthaltsmeldung der App (nur Standort-Name oder null) |
| GET | `/auth/sso/start`, `/auth/sso/callback` | Single Sign-On über Microsoft Entra ID (`?target=web` oder `app`) |
| POST | `/integrations/sso/test` | Verbindungstest SSO (nur Administration) |
| POST | `/alarms` | Alarm auslösen |
| POST | `/alarms/:id/ack` | Quittieren oder ablehnen |
| POST | `/alarms/:id/end` | Entwarnung (Administration und Krisenstab) |
| POST | `/lone-work`, `/lone-work/:id/extend`, `/lone-work/:id/complete` | Alleinarbeit |
| POST | `/push/register`, `/push/unregister` | Push-Token eines Geräts |
| GET | `/setup` | Öffentlich: ist der Server frisch eingerichtet? (für die Anmeldemaske) |
| GET | `/update/status` | Stand und laufende Aktualisierung (nur Administration) |
| GET | `/update/job` | Fortschritt der laufenden Aktualisierung |
| POST | `/update` | Aktualisierung starten (`scope`: `server` oder `server+ios`) |

## Integrationen

Alle Integrationen sind umgesetzt und werden ausschliesslich im
Administrationsportal unter **Integrationen** konfiguriert:

- **Single Sign-On (Microsoft Entra ID)** – Anmeldung mit dem Microsoft-Konto
  im Portal und in der App (OpenID Connect, Authorization Code mit PKCE; der
  Server ist vertraulicher Client und tauscht den Code direkt mit seinem
  Geheimnis). Konfiguration: Mandant, Anwendungs-ID, Geheimnis; als
  Umleitungs-URI gehört `<Serveradresse>/api/auth/sso/callback` (Typ «Web»)
  in die App-Registrierung, die App nutzt zusätzlich das Schema
  `sobenotfall://auth`. Unbekannte Microsoft-Konten werden auf Wunsch beim
  ersten Login automatisch als Mitarbeitende angelegt; über die Objekt-IDs
  zweier Entra-Gruppen lassen sich die Rollen Administration und Krisenstab
  zuweisen (der letzte Administrator wird nie herabgestuft, leere
  Gruppenfelder verändern keine Rollen). Die Passwort-Anmeldung bleibt als
  Rückfall bestehen.

- **SMS-Gateway** – eCall oder ASPSMS (Schweizer Anbieter) mit Zugangsdaten und
  Absenderkennung, alternativ ein eigenes HTTP-Gateway über eine URL-Vorlage
  mit `{to}`, `{text}`, `{from}`. Versand bei Alarm, Lagemeldung und Entwarnung
  an alle Empfänger mit Kanal «SMS»; Zustellstatus je Person in der
  Alarmzentrale, Kostenzähler im Portal, Test-SMS an die eigene Nummer.
- **Microsoft Teams** – Karte in einen Kanal des Krisenstabs über eine
  Workflows-/Incoming-Webhook-URL. Alarm (rot), Lagemeldung und Entwarnung
  (grün) erscheinen als Adaptive Card mit Fakten und Testknopf im Portal.
- **Sprachanruf & Telefonkonferenz über Teams** – App-Registrierung in
  Microsoft Entra ID (Mandant, Anwendungs-ID, Geheimnis) mit den
  Anwendungsberechtigungen `OnlineMeetings.ReadWrite.All` und
  `Calls.Initiate.All`. Kanal «Sprachanruf» lässt die Empfänger in Teams
  klingeln; Kanal «Telefonkonferenz» eröffnet eine Teams-Besprechung im Namen
  des hinterlegten Organisators und verteilt den Beitrittslink per Push und in
  den Teams-Kanal.
- **Geofencing (Alarmierung nach Aufenthaltsort)** – Schalter unter
  Integrationen, Radius je Standort unter Standorte. Die App überwacht die
  Standort-Geofences und meldet beim Betreten oder Verlassen nur den
  Standort-Namen (nie GPS-Koordinaten) an `/api/geo/report`. Wer sich gerade an
  einem alarmierten Standort aufhält, wird zusätzlich alarmiert; der
  Profilstandort fällt nie aus der Alarmierung heraus (Aufenthalt erweitert die
  Auswahl nur). Meldungen zählen 12 Stunden, ältere werden automatisch
  gelöscht – es entsteht keine Bewegungshistorie. Die Bereitschaftsübersicht
  zeigt pro Standort, wie viele Personen laut App vor Ort sind.
- **LoRaWAN-Netz / Alarmknöpfe** – der Endpunkt `/api/hooks/lorawan` nimmt
  Uplinks von The Things Network (v3), ChirpStack (v4) oder generischem JSON
  entgegen, geschützt durch ein Zugangstoken aus dem Portal. Statusmeldungen
  aktualisieren Batterie und «letztes Signal» der registrierten Knöpfe
  (Zuordnung über Seriennummer/DevEUI); ein Knopfdruck löst den am Knopf
  hinterlegten stillen Alarm mit Eskalation aus, doppelte Drücke werden
  zusammengefasst.

Geheimnisse (Gateway-Passwörter, Webhook-URL, Client Secret, Token) speichert
der Server im Klartext nur in der Datenbank; an die Clients gehen sie
ausschliesslich maskiert, und ein zurückgeschickter Platzhalter lässt den
gespeicherten Wert unverändert.

## Tests

```bash
npm run dev                                    # in einem Fenster
SOBE_TEST_URL=http://localhost:3001 npm test   # in einem zweiten
```

113 Integrationstests über Anmeldung, Rechte, Benutzerverwaltung, Alarme,
Alleinarbeit, Push-Registrierung, Integrationen (Geheimnis-Maskierung,
Verbindungstests), den LoRaWAN-Endpunkt, das Geofencing und das Single
Sign-On. Die Aktualisierung ist zusätzlich gegen ein eigenes Testrepository
geprüft (Ablauf, Fehlschlag, Rechte, iOS-Sperre).

## Push-Nachrichten

Der Server sendet über `https://exp.host/--/api/v2/push/send`. Damit ein Telefon
Nachrichten empfängt, muss die App ihr Push-Token über `/push/register` melden.
Das funktioniert nur in einem eigenen App-Build (TestFlight oder App Store);
Expo Go kann seit SDK 53 keine Remote-Push-Nachrichten mehr empfangen.

**Nicht stille Alarme gehen als Critical Alert hinaus** – sie klingeln auch bei
stummgeschaltetem Telefon. Weil Apple dafür eine Bewilligung verlangt, meldet
jedes Gerät bei der Registrierung, ob es Critical Alerts empfangen darf
(`criticalAlerts`). Der Server setzt die Stufe daraufhin pro Gerät:

| Gerät | Stufe |
| --- | --- |
| Critical Alerts bewilligt | `critical` – klingelt trotz Stummschalter |
| sonst | `time-sensitive` – durchbricht Fokus-Modi, respektiert den Stummschalter |

Stille Alarme lösen unverändert gar keinen Push aus. Wie die Bewilligung
beantragt und aktiviert wird, steht in
[`mobile/CRITICAL-ALERTS.md`](../mobile/CRITICAL-ALERTS.md).
