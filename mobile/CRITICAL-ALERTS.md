# Alarme hörbar machen: zeitkritische Mitteilungen und Critical Alerts

Nicht stille Alarme sollen auf dem iPhone durchkommen, auch wenn das Gerät
stummgeschaltet ist oder ein Fokus läuft. iOS kennt dafür zwei Stufen, und beide
brauchen eine Berechtigung von Apple.

| Stufe | Fokus / Nicht stören | Stummschalter | Antrag bei Apple |
| --- | --- | --- | --- |
| normal (heute aktiv) | wird zurückgehalten | stumm | – |
| **zeitkritisch** | durchbricht | stumm | nein, aber einmalige Einrichtung |
| **Critical Alert** | durchbricht | **klingelt** | ja, Formular |

Die App schickt bereits die passende Stufe mit. Solange die Berechtigung fehlt,
ignoriert iOS sie schlicht – es gibt keine Fehlermeldung, der Alarm kommt nur
leiser an.

---

## Stufe 1: zeitkritische Mitteilungen

Kein Antrag nötig, aber die Berechtigung muss ins Bereitstellungsprofil. Genau
daran ist ein Build gescheitert:

```
Provisioning profile "…" does not support the Time Sensitive Notifications capability.
Entitlements file defines the value "com.apple.developer.usernotifications.time-sensitive"
which is not registered for profile
```

Grund: Der `EXPO_TOKEN` auf dem Server weist den Server gegenüber **Expo** aus,
nicht gegenüber **Apple**. Er genügt, um einen Build zu starten. Sobald aber
etwas im Apple Developer Portal geändert werden muss – und das Nachtragen einer
Berechtigung ins Bereitstellungsprofil ist genau das –, verlangt Apple eine
Anmeldung mit Zwei-Faktor-Bestätigung. Danach kann der Update-Knopf nicht
fragen, weil er ohne Rückfragen läuft. Er verwendet deshalb das vorhandene
Profil, und dem fehlt die Berechtigung.

### Einmalig einrichten

Der Eintrag steht bereits in `mobile/app.json`:

```json
"entitlements": {
  "com.apple.developer.usernotifications.time-sensitive": true
}
```

Damit ein Build gelingt, muss die Berechtigung noch im Bereitstellungsprofil
verankert werden. Dafür genügt ein einziger Build **mit Rückfragen**: Dabei
meldet sich EAS bei Apple an, trägt die Berechtigung ein und erneuert das
Profil.

**Warum das auch dem Server hilft, wenn Sie es am eigenen Rechner tun:** Die
Bereitstellungsprofile und Zertifikate liegen nicht auf dem Rechner, der den
Build startet, sondern **bei Expo, am Projekt**. Das Verzeichnis `mobile`
enthält keine `credentials.json`, und `eas.json` setzt keine andere Quelle –
damit gilt die Vorgabe: Expo verwaltet sie auf seinen Servern.

Der eine Durchgang mit Rückfragen trägt die Berechtigung also nicht lokal ein,
sondern im Apple Developer Portal und im Projekt bei Expo. Jeder spätere Build
holt sie von dort – auch der vom Webhosting angestossene.

Wo Sie den Durchgang machen, ist deshalb gleichgültig: am eigenen Rechner oder
über SSH auf dem Server. Nötig ist nur, dass jemand dabeisitzt, der den
Apple-Bestätigungscode eingeben kann.

1. Bauen – **ohne** `--non-interactive`:

   ```bash
   cd mobile
   npx eas-cli build --platform ios --profile production --auto-submit
   ```

   Bei der Frage nach den Apple-Zugangsdaten anmelden. EAS meldet dann
   «Syncing capabilities» und erstellt ein neues Profil.

2. Läuft dieser Build durch, funktioniert der Update-Knopf ab sofort auch mit
   der Berechtigung – das erneuerte Profil wird wiederverwendet.

> **Bis dieser eine Build gelaufen ist, schlägt der iOS-Build über den
> Update-Knopf fehl.** «Nur Server» ist davon nicht betroffen.

---

## Übermittlung an TestFlight

Der Update-Knopf baut mit `--auto-submit`: Nach dem Build soll Expo die App
selbständig an TestFlight übergeben. Ohne Rückfragen braucht Expo dafür
**zwei** Dinge:

1. Die Zugangsdaten für App Store Connect beim Projekt (kommen vom einmaligen
   interaktiven Durchgang unten oder vom API-Schlüssel).
2. Die **Apple-ID der App** in `mobile/eas.json`. Das ist die zehnstellige
   Nummer aus App Store Connect → App → **App-Informationen** → *Apple-ID*
   (nicht die Bundle-ID). Sie steht auch in der Detailansicht einer früheren
   Übermittlung im Expo-Dashboard.

   ```json
   "submit": {
     "production": {
       "ios": {
         "ascAppId": "1234567890"
       }
     }
   }
   ```

   Wichtig: unter `ios`, nicht direkt im Profil – sonst meldet EAS
   «eas.json is not valid», und der Build startet gar nicht.

   Interaktiv fragt EAS diese Nummer bei Apple ab; nicht interaktiv kann es
   das nicht und legt dann **gar keine** Übermittlung an – der Build läuft
   trotzdem durch. Genau so sieht es aus, wenn im Expo-Dashboard neue Builds,
   aber keine neuen Submissions erscheinen.

Fehlt eines davon, sieht es so aus:

- Der Build wird angelegt und läuft bei Expo durch.
- Es entsteht keine Übermittlung, oder der Schritt danach scheitert.
- In TestFlight erscheint nichts.

Sonderfall erste Einrichtung: Steht die `ascAppId` in `eas.json`, aber die
App-Store-Connect-Zugangsdaten sind bei Expo noch gar nicht hinterlegt, bricht
`eas build --auto-submit` ohne Rückfragen schon **vor** dem Build ab («Failed
to set up credentials … Run this command again in interactive mode») – dann
erscheint bei Expo **gar kein** Build. Der Update-Knopf erkennt diesen Abbruch
und startet den Build automatisch ein zweites Mal ohne Übermittlung; der
fertige Build lässt sich danach von Hand übergeben
(`npx eas-cli submit --platform ios --latest`), bis die Zugangsdaten einmalig
interaktiv hinterlegt sind (unten).

Das Portal erkennt alle Fälle: Der Schritt gilt als erfolgreich, darunter
steht ein Hinweis mit dem Grund (fehlende `ascAppId`, fehlende Zugangsdaten
oder die Fehlermeldung von EAS). Der Server startet dann wie vorgesehen neu.

### Einmalig einrichten

Denselben Build **einmal mit Rückfragen** starten. Dabei fragt EAS nach den
Apple-Zugangsdaten, legt die Übermittlungsdaten beim Projekt ab und verwendet
sie danach auch ohne Rückfragen:

```bash
cd mobile
npx eas-cli build --platform ios --profile production --auto-submit
```

Das ist derselbe Lauf, der weiter oben die Berechtigung für zeitkritische
Mitteilungen ins Bereitstellungsprofil einträgt. **Ein Durchgang erledigt
beides.**

Prüfen lässt sich der Stand mit:

```bash
npx eas-cli credentials
```

### Bis dahin von Hand übermitteln

```bash
cd mobile
npx eas-cli submit --platform ios --latest
```

Oder im Expo-Dashboard beim fertigen Build auf «Submit to App Store» gehen.

### Ohne Zwei-Faktor: der App-Store-Connect-Schlüssel

Wer die Rückfrage dauerhaft loswerden will, legt bei Apple einen
API-Schlüssel an – der kommt ohne Zwei-Faktor-Bestätigung aus und lässt sich
deshalb auf einem Server verwenden.

1. In App Store Connect unter **Benutzer und Zugriff → Integrationen** einen
   Schlüssel erstellen. Notieren: Issuer ID, Key ID, und die Datei `.p8`
   herunterladen – sie lässt sich nur einmal laden.
2. Den Schlüssel bei Expo hinterlegen:

   ```bash
   cd mobile
   npx eas-cli credentials
   ```

   Dort iOS wählen und den Schlüssel für die Übermittlung hochladen.

Danach übermittelt der Update-Knopf ohne Rückfragen. Die Datei `.p8` bleibt
bei Expo; sie gehört nicht ins Projektverzeichnis und nicht in die
Versionsverwaltung.

Für den Build selbst bleibt der eine Durchgang mit Apple-Anmeldung nötig,
solange sich am Bereitstellungsprofil etwas ändert – also beim Nachtragen der
Berechtigungen oben. Danach nicht mehr.

---

## Stufe 2: Critical Alerts

Zusätzlich zur zeitkritischen Stufe: Ton auch bei stummgeschaltetem Telefon, mit
eigener Lautstärke.

### Bewilligung beantragen

Formular: <https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/>
mit der Bundle-ID `ch.sonnenberg.notfall`.

**App Type:** Public Safety

**Describe your app**

> SOBE Notfall is the internal emergency alerting app of SONNENBERG
> Kompetenzzentrum, a Swiss special-needs school for children and young people
> with disabilities, operating three sites. Staff use it to raise and receive
> alarms and to follow guided emergency procedures for fire, evacuation, medical
> emergencies, incidents in the therapy pool and security incidents. It is
> distributed only to the school's employees.

**What type of notifications will you send as Critical Alerts?**

> Only alarms requiring an immediate physical response: fire and building
> evacuation, medical emergencies including cardiac arrest, drowning in the
> therapy pool, and situations requiring the crisis team. All other
> notifications are sent at normal priority. Alarms that must stay inaudible for
> the safety of those involved are delivered silently by design.

**How frequently will you send Critical Alerts?** Die seltenste zutreffende
Option wählen – echte Notfälle sind selten.

**Explain why you need this entitlement**

> Staff supervise children with severe disabilities during lessons and therapy
> and keep their phones silenced so as not to disturb the group. Many work alone
> in therapy rooms, in the pool or in outlying buildings where they cannot hear
> a building alarm. The people affected cannot help themselves: children with
> impaired mobility depend on a named staff member to evacuate them, and a
> drowning or cardiac arrest allows only minutes to act. A missed alarm
> therefore directly endangers lives. Critical Alerts are used exclusively for
> these emergencies, never for information or reminders.

### Nach der Bewilligung

> **Stand: Apple hat die Bewilligung für `ch.sonnenberg.notfall` am 3.9.2026
> erteilt.** Der zweite Eintrag steht seither in `app.json` – es fehlt nur noch
> der eine Build mit Rückfragen (wie oben), damit die Berechtigung ins
> Bereitstellungsprofil kommt.

Zweiter Eintrag (bereits ergänzt) und wieder **einmal mit Rückfragen** bauen:

```json
"entitlements": {
  "com.apple.developer.usernotifications.time-sensitive": true,
  "com.apple.developer.usernotifications.critical-alerts": true
}
```

Beim ersten Start fragt iOS zusätzlich nach der Zustimmung für kritische
Hinweise – diese muss bestätigt werden.

> **Falls der Dialog nicht erscheint**, obwohl der installierte Build die
> Berechtigung enthält (etwa nach mehreren TestFlight-Updates über ältere
> Stände hinweg): die App auf dem Gerät **löschen und aus TestFlight bzw. dem
> App Store neu installieren**. Bei einer frischen Installation stellt iOS
> alle Berechtigungsfragen garantiert neu. Es geht nichts verloren – alle
> Daten liegen auf dem Alarmserver, nur die Anmeldung ist neu nötig.

---

## Wie die App damit umgeht

Am Code ist nichts zu ändern. Die App fragt beim Start nach der Berechtigung und
prüft danach, ob sie erteilt wurde:

- **erteilt** → `interruptionLevel: 'critical'`, Systemton `defaultCritical`; das
  Gerät meldet dem Alarmserver, dass es Critical Alerts empfangen darf, und
  bekommt Pushs mit derselben Stufe.
- **nicht erteilt** → `timeSensitive` mit normalem Ton.

Der Server entscheidet pro Gerät. Ein Gerät ohne Berechtigung bekommt nie einen
Critical Alert – Apple würde die Nachricht abweisen.

**Stille Alarme** bleiben unverändert stumm und lösen gar keinen Push aus.

## Android

Der Kanal `alarme` wird beim Start mit höchster Wichtigkeit angelegt und umgeht
«Nicht stören». Dort braucht es keine Bewilligung.

---

## Live-Aktivität für die Alleinarbeit

Ein laufender Alleinarbeits-Timer erscheint als Live-Aktivität auf dem
Sperrbildschirm und in der Dynamic Island (iOS 16.2 oder neuer). Dafür sorgt
das Paket `expo-live-activity` mit seinem Config-Plugin; es legt beim Build
ein zweites Ziel `LiveActivity` mit der Bundle-ID
`ch.sonnenberg.notfall.LiveActivity` an. Die Bilder dafür liegen unter
`assets/liveActivity/` und dürfen je höchstens 4 KB gross sein.

Folgen für den Build:

- Das neue Ziel braucht ein eigenes Bereitstellungsprofil. EAS legt es an,
  muss dafür aber einmal bei Apple anmelden können. **Der erste Build nach
  dieser Änderung ist deshalb interaktiv zu starten**, wie oben beschrieben:

  ```bash
  cd mobile
  npx eas-cli build --platform ios --profile production --auto-submit
  ```

  Danach verwenden auch die Builds vom Update-Knopf das Profil wieder.
- Die App meldet die URL-Vorlage `sobenotfall://` an; Antippen der Aktivität
  öffnet die Alleinarbeit.
- Auf Android und in Expo Go passiert nichts – das Modul fehlt dort, die App
  läuft trotzdem.

Das Paket ist beim Hersteller als nicht mehr gepflegt markiert. Es
funktioniert mit Expo SDK 54; beim nächsten SDK-Wechsel ist der Ersatz durch
`expo-widgets` von Expo selbst vorgesehen, das ab SDK 57 dieselbe Aufgabe
übernimmt.

