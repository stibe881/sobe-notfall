# Neuen Kunden aufsetzen (Mandanten-Betrieb)

SOBE Notfall wird pro Kunde mit einem **eigenen Alarmserver** betrieben – die
**iOS-App bleibt für alle Kunden dieselbe**. Die App verbindet sich mit dem
Server des jeweiligen Kunden und zeigt dessen Namen, Standorte, Szenarien und
Einstellungen. Alles Kundenspezifische liegt auf dem Server und wird im Portal
unter **Integrationen** gepflegt.

```
                    ┌──────────────────────────────┐
   iOS-App  ──────▶ │ notfall.kunde-a.ch  (Server A) │   eigener Datenbestand
   (eine für alle)  ├──────────────────────────────┤
   iOS-App  ──────▶ │ notfall.kunde-b.ch  (Server B) │   eigener Datenbestand
                    └──────────────────────────────┘
```

## 1. Server aufsetzen

Pro Kunde eine eigene Domain, ein eigenes Verzeichnis, eine eigene Datenbank.
Das Vorgehen entspricht [`DEPLOY-HETZNER.md`](DEPLOY-HETZNER.md); mehrere
Kunden können auf derselben Maschine laufen (je ein Port, je eine Domain).

In `server/.env` pro Kunde mindestens setzen:

```bash
PORT=3001                              # pro Instanz ein eigener Port
SOBE_DB_PATH=data/kunde-a.sqlite       # eigene Datenbankdatei
SOBE_ADMIN_EMAIL=admin@kunde-a.ch      # Konto des ersten Administrators
SOBE_ADMIN_PASSWORD=…                  # Erstpasswort (Wechsel wird erzwungen)
SOBE_PUBLIC_URL=https://notfall.kunde-a.ch
```

Ein neuer Server startet **neutral**: die 22 Szenarien, Gruppen,
Alarmplan-Vorlagen und Schweizer Notrufnummern sind da – aber keine Standorte
und keine kundenspezifischen Angaben. (Nur mit `SOBE_SEED_PROFILE=sonnenberg`
entsteht die historische Sonnenberg-Erstbefüllung; bestehende Installationen
behalten sie automatisch.)

## 2. Einrichtungsassistent

Nach der ersten Anmeldung im Portal (Adresse des Servers im Browser öffnen)
erscheint für die Administration der **Einrichtungsassistent**: Name der
Organisation, Kurzname (wird SMS-Absender), interne Notfallnummer und erster
Standort. Danach:

- **Standorte** vervollständigen (Geofencing-Koordinaten, Betriebszeiten)
- **Benutzer** anlegen oder per CSV importieren, Gruppen zuordnen
- **Integrationen** des Kunden eintragen: SMS-Gateway, Microsoft Teams,
  Telefonie, SSO (eigene Entra-ID-App-Registrierung des Kunden mit der
  Callback-Adresse dieses Servers), LoRaWAN
- **Alarmpläne** auf die Standorte des Kunden anpassen

Der Organisationsname erscheint ab sofort auf der Anmeldemaske des Portals und
in der App – die App selbst muss dafür nicht angepasst werden.

## 3. App verbinden (QR-Code)

Unter **Integrationen → App-Verbindung** zeigt das Portal einen QR-Code
mit einem Verbindungs-Link (`sobenotfall://verbinden?server=…`). Mitarbeitende
scannen ihn mit der Kamera ihres iPhones oder Android-Telefons: Die App
übernimmt die Serveradresse (und, falls eingerichtet, den Ausweichserver)
automatisch. Der Link lässt sich auch per E-Mail oder MDM verteilen. Danach
normal mit dem eigenen Konto anmelden.

**Android:** Dieselbe App läuft auch auf Android – verteilt über den Play
Store oder als direkt installierbares APK (Preview-Profil, z. B. per MDM).
Einmalig nötig: Signatur-Schlüssel bei Expo (erster Build interaktiv) und für
Remote-Push ein Firebase-Projekt (FCM) – Anleitung in `mobile/README.md`,
Abschnitt «Android». Danach `SOBE_EAS_PLATFORMS=all` in `server/.env` setzen,
und der Update-Knopf baut iOS und Android zusammen. Laute Alarme laufen auf
Android über den Benachrichtigungskanal «Alarme» (höchste Wichtigkeit,
Umgehung von «Nicht stören») – die Apple-Sonderbewilligung für Critical
Alerts ist ein reines iOS-Thema.

## 4. Redundanz: zweiter Alarmserver (optional, jederzeit nachrüstbar)

Pro Kunde kann ein zweiter Server die Ausfallsicherheit übernehmen – von
Anfang an oder nachträglich. Idealerweise läuft er auf einer anderen Maschine
(anderes Rechenzentrum).

**Einrichtung:**

1. Zweiten Server wie unter Schritt 1 aufsetzen (eigene Domain, z. B.
   `notfall2.kunde-a.ch`). Einrichtungsassistent dort einfach schliessen –
   die Daten kommen gleich vom Hauptserver.
2. Auf dem **Hauptserver** unter Integrationen → Redundanz: einschalten,
   Rolle **Hauptserver**, Adresse des Partners eintragen, speichern – das
   erzeugte **Geheimnis kopieren**.
3. Auf dem **zweiten Server** unter Integrationen → Redundanz: einschalten,
   Rolle **Standby**, Adresse des Hauptservers und das kopierte Geheimnis
   eintragen, speichern.

**Achtung:** Beim Speichern als Standby wird dessen Datenbestand vollständig
durch den des Hauptservers ersetzt – auch Konten und Sitzungen. Man meldet
sich dort anschliessend mit den Konten des Hauptservers an.

**Verhalten im Betrieb:**

- Der Standby spiegelt alle 30 Sekunden den vollständigen Datenbestand –
  inklusive Konten, Sitzungen und Push-Registrierungen. Angemeldete Geräte
  bleiben deshalb auch auf dem Standby angemeldet.
- Die App kennt beide Adressen (über den QR-Code oder automatisch nach der
  ersten Verbindung) und **weicht bei Ausfall selbständig aus** – und kehrt
  zurück, sobald der Hauptserver wieder antwortet.
- Solange der Hauptserver lebt, ist der Standby **passiv**: Er versendet
  keine Eskalationen, SMS oder Testmeldungen (sonst ginge alles doppelt raus).
- Ist der Hauptserver länger als 90 Sekunden weg, **übernimmt der Standby**:
  Alarme können ausgelöst, quittiert und eskaliert werden. Kommt der
  Hauptserver zurück, meldet der Standby die in der Zwischenzeit erfassten
  Alarme, Protokolleinträge und Alleinarbeits-Timer an ihn zurück und wird
  wieder passiv.
- Für das **Portal** gibt es keine automatische Umleitung: Im Ausfall die
  Portal-Adresse des Standby öffnen (am besten beim Krisenstab hinterlegen).

**Grenzen:** Während eines Ausfalls auf dem Standby geänderte *Verwaltungsdaten*
(Benutzer, Szenarien, Einstellungen) werden beim nächsten Abgleich vom Stand
des Hauptservers überschrieben – zurückgemeldet werden Alarme, Protokoll und
Alleinarbeits-Timer. Verwaltungsarbeit deshalb immer auf dem Hauptserver
erledigen.

## Checkliste pro Kunde

- [ ] Domain(s) + Zertifikat, Server-Instanz(en) mit eigener `.env` und Datenbank
- [ ] Erstanmeldung, Passwort gewechselt, Einrichtungsassistent abgeschlossen
- [ ] Standorte, Benutzer, Gruppen, Alarmpläne erfasst
- [ ] Integrationen (SMS, Teams, SSO …) mit den Zugangsdaten des Kunden getestet
- [ ] Redundanz eingerichtet und Failover einmal geprobt (Hauptserver kurz stoppen)
- [ ] QR-Code an die Mitarbeitenden verteilt, Testalarm mit Quittierung durchgeführt
- [ ] Sicherung eingerichtet (`server/scripts/sicherung.mjs`, siehe Server-README)
