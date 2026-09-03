# SOBE Notfall – Mobile App (Expo)

Native React-Native-Version der Mitarbeiter-App (Expo SDK 54): SOS mit Halte-Geste und Live-Status,
22 Notfallszenarien mit Sofortmassnahmen/Checklisten, Alleinarbeits-Timer mit automatischer
Alarmauslösung und Notrufnummern (direkt anrufbar). Der Alarmserver wird lokal auf dem Gerät
simuliert (Zustellungen, Rückmeldungen der Einsatzkräfte, Eskalation) – es werden keine echten
Benachrichtigungen versendet.

## Mit Expo Go testen

1. **Expo Go** aus dem App Store / Play Store installieren
2. Auf dem Computer (gleiches WLAN wie das Handy):

   ```bash
   cd mobile
   npm install
   npx expo start
   ```

3. Den angezeigten **QR-Code scannen** – iPhone: mit der Kamera-App, Android: in Expo Go –
   die App startet direkt auf dem Gerät. Änderungen am Code erscheinen live (Fast Refresh).

Falls Handy und Computer nicht im selben Netz sind: `npx expo start --tunnel`.

## Mit EAS publishen (für Teamkolleg:innen ohne laufenden Dev-Server)

Einmalig (kostenloses Expo-Konto nötig):

```bash
npm install -g eas-cli
eas login
cd mobile
eas init                # verknüpft das Projekt mit deinem Expo-Konto (setzt projectId)
eas update:configure    # richtet expo-updates ein
```

Publishen:

```bash
eas update --branch preview --message "Erste Version"
```

Die CLI zeigt danach einen Link/QR-Code. Wer mit demselben Expo-Konto (oder als eingeladenes
Teammitglied) in **Expo Go** eingeloggt ist, öffnet die publizierte App darüber – ganz ohne
lokalen Server.

## Push-Benachrichtigungen

**Lokale Benachrichtigungen (funktionieren sofort in Expo Go):**

- Beim ersten Start fragt die App nach der Mitteilungs-Berechtigung.
- **Alleinarbeits-Timer:** 5 Minuten vor Ablauf kommt eine Warnung, bei Ablauf die Alarm-Meldung –
  auch bei gesperrtem Bildschirm oder wenn die App im Hintergrund ist. «Lebenszeichen» und
  «Arbeit sicher beendet» verschieben bzw. löschen die geplanten Meldungen.
- **SOS/Alarme:** Beim Auslösen erscheint ein Benachrichtigungs-Banner (ausser bei stillen Alarmen).
- Status und Berechtigung sind im **Profil-Tab** unter «Push-Benachrichtigungen» sichtbar.

**Remote-Pushs (jemand anderes alarmiert → dein iPhone klingelt):**

Expo Go unterstützt seit SDK 53 **keine** Remote-Pushs mehr – dafür braucht es einen eigenen Build:

```bash
eas login && eas init          # verknüpft das Projekt (projectId) – danach zeigt der Profil-Tab den Push-Token
eas build --profile development --platform ios   # Development-Build (Apple-Developer-Konto nötig)
```

Nach der Installation des Builds zeigt der Profil-Tab den **Expo-Push-Token**; damit lässt sich unter
[expo.dev/notifications](https://expo.dev/notifications) sofort ein Test-Push aufs Gerät schicken.
Für den produktiven Versand ruft ein Backend die Expo-Push-API mit den Tokens der Empfänger auf.
**Critical Alerts** (übersteuern die Stummschaltung) benötigen zusätzlich eine Sonderberechtigung von Apple.

## App-Store-Build (später)

```bash
eas build --platform ios --profile preview     # .ipa für interne Verteilung (TestFlight)
eas build --platform ios --profile production  # Store-Build
eas submit --platform ios                      # Einreichung (Apple-Developer-Konto nötig)
```

Hinweis: Echte Critical-Alert-Pushes (übersteuern die Stummschaltung) erfordern den nativen
Build plus eine Apple-Sonderberechtigung – in Expo Go sind keine Remote-Pushes möglich.

## Android

Der Code ist plattformgemeinsam – dieselbe App läuft auf Android, mit eigenen Gegenstücken
zu den iOS-Spezialitäten:

- **Laute Alarme (Gegenstück zu Critical Alerts):** Der Benachrichtigungskanal **«Alarme»**
  hat die höchste Wichtigkeit, umgeht «Nicht stören» und spielt den Ton über den
  **Alarm-Audiokanal** – wie ein Wecker klingt er damit auch bei Lautlos- und
  Vibrationsmodus (massgeblich ist die Wecker-Lautstärke). Die App legt den Kanal beim
  Start an, der Server adressiert ihn beim Versand. Stille Alarme nutzen den lautlosen
  Kanal «Stille Alarme und Entwarnung».
- **Alleinarbeits-Countdown (Gegenstück zur Live-Aktivität):** Während einer laufenden
  Alleinarbeit zeigt eine dauerhafte, nicht wegwischbare Benachrichtigung den Countdown
  bis zum Ablauf – auch auf dem Sperrbildschirm (Notifee-Chronometer, `src/androidTimer.ts`).

**Bauen** (im Verzeichnis `mobile/`; `npx --yes eas-cli@latest` funktioniert ohne globale
Installation – wer die CLI global hat, kürzt auf `eas …` ab; Anmeldung über `EXPO_TOKEN`
oder `npx --yes eas-cli@latest login`):

```bash
npx --yes eas-cli@latest build --platform android --profile preview     # .apk zur Direktinstallation / MDM
npx --yes eas-cli@latest build --platform android --profile production  # .aab für den Play Store
```

Beim ersten Build erzeugt und verwahrt EAS den Signatur-Schlüssel (Keystore) – dafür den ersten
Lauf **interaktiv** ausführen. Der Update-Knopf des Portals baut Android automatisch mit, sobald
der Play-Store-Schlüssel als `mobile/play-service-account.json` auf dem Server liegt (siehe
unten); `SOBE_EAS_PLATFORMS=ios|android|all` in `server/.env` übersteuert diese Automatik.

**Remote-Push auf Android (einmalig):** Expo versendet an Android über Firebase Cloud Messaging.

1. Firebase-Projekt anlegen (console.firebase.google.com), Android-App mit dem Paketnamen
   `ch.sonnenberg.notfall` registrieren.
2. `google-services.json` herunterladen und nach `mobile/` legen – mehr nicht:
   `app.config.js` bindet die Datei automatisch ein, sobald sie da ist. Sie darf
   **nicht** in `.gitignore` stehen (EAS packt das Arbeitsverzeichnis nach diesen
   Regeln – eine ignorierte Datei käme nie beim Build an).
3. Den FCM-Service-Account-Schlüssel bei Expo hinterlegen: `eas credentials` → Android →
   *Google Service Account Key (FCM V1)*.

Ohne diese Einrichtung funktionieren lokale Benachrichtigungen (Timer, SOS), aber keine
Remote-Alarme.

**Play Store (einmalig):** Google-Play-Console-Konto anlegen (einmalig USD 25), dann:

1. In der Google Cloud Console ein **Dienstkonto** erstellen und in der Play Console unter
   *Nutzer und Berechtigungen* mit Release-Rechten einladen.
2. Den JSON-Schlüssel des Dienstkontos als `mobile/play-service-account.json` auf den Server
   legen (die Datei ist in `.gitignore` und wird nie committet; `eas.json` verweist unter
   `submit.production.android` darauf, Ziel-Track: `internal`).
3. Das **erste** `.aab` einmal von Hand in der Play Console hochladen (interner Test) – vorher
   lehnt Google automatische Übermittlungen mit «Package not found» ab.

Ab dann baut und übermittelt der Update-Knopf des Portals Android automatisch mit. Für die
firmeninterne Verteilung genügt oft das APK aus dem Preview-Profil (per MDM oder Download).

## Struktur

- `App.tsx` – Einstieg: Header, Tab-Navigation, Toasts
- `src/screens.tsx` – die fünf Screens (Start/SOS, Szenarien, Alleinarbeit, Notruf, Profil)
- `src/store.tsx` – Zustand mit AsyncStorage-Persistenz und Alarmserver-Simulation
- `src/seed.ts`, `src/types.ts` – Kopie der Daten/Typen aus der Web-App (`../src`)
- `src/ui.tsx` – Farben, Badges, Halte-Button
