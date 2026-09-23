# -*- coding: utf-8 -*-
TITEL = 'SOBE Handbuch Installation & Konfiguration'
TITELSEITE = dict(
    rolle='SOBE Notfall &middot; Handbuch 4 von 4',
    titel='Installation &amp; Konfiguration',
    untertitel='Für Systemverantwortliche und den technischen Betrieb',
    vorspann='Sie setzen den Alarmserver auf, nehmen ihn in Betrieb und halten ihn am Laufen &ndash; für einen Standort oder für mehrere Kunden, mit oder ohne zweiten Server für die Ausfallsicherheit. Dieses Handbuch führt von der leeren Maschine bis zum geprobten Failover.',
    stand='September 2026',
)

KOERPER = r"""
<div class="blatt">

{TITELSEITE}

<nav class="inhalt" aria-label="Inhalt">
  <h2>Inhalt</h2>
  <ol>
    <li><a href="#a1"><span class="zahl">1</span> Das System im Überblick</a></li>
    <li><a href="#a2"><span class="zahl">2</span> Voraussetzungen</a></li>
    <li><a href="#a3"><span class="zahl">3</span> Alarmserver installieren</a></li>
    <li><a href="#a4"><span class="zahl">4</span> Einstellungen (server/.env)</a></li>
    <li><a href="#a5"><span class="zahl">5</span> Erstinbetriebnahme</a></li>
    <li><a href="#a6"><span class="zahl">6</span> Grundkonfiguration</a></li>
    <li><a href="#a7"><span class="zahl">7</span> Organisation und Integrationen</a></li>
    <li><a href="#a8"><span class="zahl">8</span> Die App verteilen und verbinden</a></li>
    <li><a href="#a9"><span class="zahl">9</span> Alarmknöpfe anbinden</a></li>
    <li><a href="#a10"><span class="zahl">10</span> Redundanz: zweiter Alarmserver</a></li>
    <li><a href="#a11"><span class="zahl">11</span> Weitere Kunden aufsetzen</a></li>
    <li><a href="#a12"><span class="zahl">12</span> Aktualisierung und Sicherung</a></li>
    <li><a href="#a13"><span class="zahl">13</span> Wenn etwas nicht geht</a></li>
  </ol>
</nav>

<main>

<section id="a1">
  <h2 class="abschnitt"><span class="zahl">1</span> Das System im Überblick</h2>
  <p>
    SOBE Notfall besteht aus drei Bausteinen. Zwei davon liefert der Alarmserver
    unter <b>einer</b> Adresse aus &ndash; ein Zertifikat, keine CORS-Fragen, und die
    App braucht nur eine Adresse.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Die Bausteine</caption>
      <thead><tr><th>Baustein</th><th>Was er tut</th><th>Wo er läuft</th></tr></thead>
      <tbody>
        <tr><td><b>Alarmserver</b> (<code>server/</code>)</td><td>Konten, Datenbestand, Alarmverarbeitung, Eskalationen, Push-Versand, Schnittstelle unter <code>/api</code></td><td>Node.js-Prozess auf Ihrem Server</td></tr>
        <tr><td><b>Webportal</b> (<code>src/</code>)</td><td>Verwaltung und Alarmzentrale im Browser</td><td>wird vom Alarmserver unter <code>/</code> mit ausgeliefert</td></tr>
        <tr><td><b>iOS-App</b> (<code>mobile/</code>)</td><td>Alarme empfangen und auslösen, Szenarien, Alleinarbeit</td><td>auf den iPhones der Mitarbeitenden</td></tr>
      </tbody>
    </table>
  </div>
  <p>
    Das Betriebsmodell heisst <b>eine App, ein Server pro Kunde</b>: Die App ist für
    alle Kunden dieselbe und wird nie angepasst. Alles Kundenspezifische &ndash; Name,
    Standorte, Konten, Szenarien, angebundene Dienste &ndash; liegt auf dem Alarmserver
    des jeweiligen Kunden und wird im Portal gepflegt. Die App verbindet sich über
    eine Serveradresse, die sie per QR-Code übernimmt (Abschnitt 8).
  </p>
  <div class="hinweis">
    <p class="marke-klein">Gut zu wissen</p>
    <p>
      Die Daten liegen in einer einzigen SQLite-Datei. Es braucht keine externe
      Datenbank, keinen weiteren Dienst &ndash; sichern heisst: eine Datei sichern
      (Abschnitt 11).
    </p>
  </div>
</section>

<section id="a2">
  <h2 class="abschnitt"><span class="zahl">2</span> Voraussetzungen</h2>
  <p>Drei Dinge müssen stimmen, bevor Sie beginnen.</p>
  <div class="tabelle-huelle">
    <table>
      <caption>Vor der Installation prüfen</caption>
      <thead><tr><th>Was</th><th>Warum</th><th>Wie prüfen</th></tr></thead>
      <tbody>
        <tr><td><b>Node.js 22 oder 24</b></td><td>Die Datenbank (<code>better-sqlite3</code>) bringt fertige Binärdateien nur für diese Versionen mit</td><td><code>node -v</code></td></tr>
        <tr><td><b>Eigene Domain mit HTTPS</b></td><td>Ohne HTTPS gingen Passwörter im Klartext durchs Netz; die App verlangt eine https-Adresse</td><td>Zertifikat im Hosting-Panel (z.&nbsp;B. Let's&nbsp;Encrypt)</td></tr>
        <tr><td><b>SSH-Zugang und Git</b></td><td>Installiert wird per <code>git clone</code>; nur so funktioniert später der Update-Knopf im Portal</td><td><code>ssh benutzer@server</code>, <code>git --version</code></td></tr>
      </tbody>
    </table>
  </div>
  <p>
    Für den <b>iOS-Build über den Update-Knopf</b> (Abschnitt 11) braucht der Server
    zusätzlich ein Zugangstoken von expo.dev (<code>EXPO_TOKEN</code>); für die
    Verteilung der App ein Apple-Developer-Konto. Beides ist für den Serverbetrieb
    selbst nicht nötig.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Wichtig</p>
    <p>
      Ein reines PHP-Webhosting genügt nicht: Der Alarmserver ist ein dauerhaft
      laufender Node-Prozess. Es braucht ein Hosting, das eigene Node-Anwendungen
      veröffentlichen kann, oder einen eigenen (virtuellen) Server.
    </p>
  </div>
</section>

<section id="a3">
  <h2 class="abschnitt"><span class="zahl">3</span> Alarmserver installieren</h2>
  <p>
    Die Schritte gelten für jedes Linux-Hosting; die ausführliche, geprüfte
    Fassung für das Hetzner-Webhosting steht in <code>DEPLOY-HETZNER.md</code> im
    Projektverzeichnis. Rechnen Sie mit 60 bis 90 Minuten.
  </p>
  <ol class="schritte">
    <li>
      <b>Projekt klonen</b> &ndash; in das Verzeichnis, das die Domain ausliefert
      (es muss leer sein):
      <br><code>git clone -b main https://github.com/stibe881/sobe-notfall.git .</code>
    </li>
    <li>
      <b>Portal bauen</b> &ndash; im Projektverzeichnis:
      <br><code>npm install</code> und <code>npm run build</code> &ndash; das Ergebnis liegt in <code>dist/</code>.
    </li>
    <li>
      <b>Server bauen</b> &ndash; im Unterverzeichnis <code>server/</code>:
      <br><code>npm install</code> und <code>npm run build</code>.
    </li>
    <li>
      <b>Einstellungen anlegen</b> &ndash; <code>cp .env.example .env</code> im Verzeichnis
      <code>server/</code>, dann die Werte aus Abschnitt 4 eintragen.
    </li>
    <li>
      <b>Starten</b> &ndash; für den Dauerbetrieb über die mitgelieferte
      Startschleife <code>bash scripts/run.sh</code> (sie startet den Server nach
      einer Aktualisierung selbständig neu) oder als systemd-Dienst nach der
      Vorlage <code>server/scripts/sobe-notfall.service</code>.
    </li>
    <li>
      <b>Prüfen</b> &ndash; <code>https://ihre-domain.ch/api/health</code> muss
      <code>{"ok":true}</code> antworten, und unter <code>https://ihre-domain.ch</code>
      erscheint die Anmeldemaske des Portals.
    </li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Gut zu wissen</p>
    <p>
      Beim ersten Start legt der Server die Datenbank selbst an und befüllt sie:
      22 Notfallszenarien, Gruppen, Alarmplan-Vorlagen, die Schweizer Notrufnummern
      und genau ein Administratorkonto. Standorte und alles Kundenspezifische fragt
      danach der Einrichtungsassistent im Portal ab (Abschnitt 5).
    </p>
  </div>
</section>

<section id="a4">
  <h2 class="abschnitt"><span class="zahl">4</span> Einstellungen (server/.env)</h2>
  <p>
    Alle Einstellungen des Servers stehen in der Datei <code>server/.env</code> &ndash;
    so geraten Zugangsdaten nie in die Kommandozeile oder in die Versionsverwaltung
    (<code>.env</code> ist davon ausgenommen). Nach jeder Änderung den Server neu starten;
    beim Start meldet er <code>[env] Einstellungen aus &hellip; geladen</code>.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Die wichtigsten Einstellungen</caption>
      <thead><tr><th>Variable</th><th>Bedeutung</th><th>Standard</th></tr></thead>
      <tbody>
        <tr><td><code>PORT</code></td><td>Port des Servers &ndash; pro Instanz ein eigener</td><td><code>3001</code></td></tr>
        <tr><td><code>SOBE_DB_PATH</code></td><td>Pfad der Datenbankdatei</td><td><code>data/sobe-notfall.sqlite</code></td></tr>
        <tr><td><code>SOBE_WEB_ROOT</code></td><td>Verzeichnis mit dem gebauten Portal</td><td><code>../dist</code></td></tr>
        <tr><td><code>SOBE_ADMIN_EMAIL</code></td><td>Konto des ersten Administrators</td><td><code>admin@sobe-notfall.local</code></td></tr>
        <tr><td><code>SOBE_ADMIN_PASSWORD</code></td><td>Erstpasswort dieses Kontos (Wechsel wird erzwungen)</td><td><code>SOBE-Start2026!</code></td></tr>
        <tr><td><code>SOBE_PUBLIC_URL</code></td><td>Öffentliche Adresse des Servers &ndash; für SSO-Rücksprünge und den LoRaWAN-Endpunkt</td><td>aus der Anfrage abgeleitet</td></tr>
        <tr><td><code>SOBE_SEED_PROFILE</code></td><td>Erstbefüllung: <code>standard</code> (neutral, mit Einrichtungsassistent) oder <code>sonnenberg</code></td><td><code>standard</code></td></tr>
        <tr><td><code>SOBE_BACKUP_DIR</code></td><td>Ordner der Sicherungen (Abschnitt 11)</td><td><code>~/sicherung</code></td></tr>
        <tr><td><code>EXPO_TOKEN</code></td><td>Zugangstoken von expo.dev &ndash; nur für den App-Build nötig</td><td>&ndash;</td></tr>
        <tr><td><code>GITHUB_TOKEN</code></td><td>Zugangstoken fürs Repository &ndash; empfohlen auf Shared Hostings, sonst drosselt GitHub das Holen gelegentlich (Abschnitt 12)</td><td>&ndash;</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Wichtig</p>
    <p>
      Setzen Sie <code>SOBE_ADMIN_EMAIL</code> auf eine echte Adresse der Kundin oder
      des Kunden, bevor der Server das erste Mal startet &ndash; das Konto entsteht beim
      ersten Start. Das Erstpasswort gilt nur bis zur ersten Anmeldung; das System
      erzwingt dann ein eigenes.
    </p>
  </div>
</section>

<section id="a5">
  <h2 class="abschnitt"><span class="zahl">5</span> Erstinbetriebnahme</h2>
  <p>
    Öffnen Sie das Portal, stellen Sie oben auf <span class="ui">Live</span> und melden
    Sie sich an. Solange nur das ausgelieferte Administratorkonto mit unverändertem
    Erstpasswort besteht, nennt die Anmeldemaske beides &ndash; ein Klick auf den
    Hinweis füllt die Felder.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-21-anmeldung-live.webp" alt="Anmeldemaske mit Hinweis auf das Administratorkonto und das Erstpasswort">
    <figcaption><b>Abb.</b> &nbsp; Die Anmeldemaske bei der Erstinbetriebnahme. Der Hinweis verschwindet, sobald ein eigenes Passwort gesetzt ist.</figcaption>
  </figure>
  <p>
    Unmittelbar nach der Anmeldung verlangt das System ein eigenes Passwort
    (mindestens acht Zeichen, davon eine Ziffer). Danach begrüsst Sie der
    <b>Einrichtungsassistent</b>: Name der Organisation, Kurzname, interne
    Notfallnummer und der erste Standort &ndash; mehr braucht es für den Start nicht,
    alles lässt sich später anpassen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-25-einrichtung.webp" alt="Einrichtungsassistent mit den Feldern Organisation, Kurzname, Notfallnummer und erster Standort">
    <figcaption><b>Abb.</b> &nbsp; Der Einrichtungsassistent nach der ersten Anmeldung. Der Kurzname wird zugleich SMS-Absenderkennung; <span class="ui">Später</span> verschiebt die Einrichtung auf die nächste Anmeldung.</figcaption>
  </figure>
  <p>
    Der Name der Organisation erscheint ab jetzt auf der Anmeldemaske des Portals,
    in der Seitenleiste und in der App, sobald sie mit diesem Server verbunden ist.
  </p>
</section>

<section id="a6">
  <h2 class="abschnitt"><span class="zahl">6</span> Grundkonfiguration</h2>
  <p>
    Die fachliche Einrichtung geschieht vollständig im Portal und ist in
    <b>Handbuch 1 (Administration)</b> beschrieben. Für die Inbetriebnahme hat sich
    diese Reihenfolge bewährt:
  </p>
  <ol class="schritte">
    <li><b>Standorte</b> vervollständigen: Adressen, Betriebszeiten und &ndash; für das Geofencing &ndash; den Umriss des Areals auf der Karte.</li>
    <li><b>Gruppen</b> prüfen: Die mitgelieferten Gruppen (Krisenstab, Ersthelfende, Evakuationshelfende &hellip;) an die Organisation anpassen.</li>
    <li><b>Benutzende</b> anlegen &ndash; von Hand oder per CSV-Import (<code>Vorname;Nachname;E-Mail;Telefon;Rolle</code>) &ndash; und den Gruppen und Standorten zuordnen.</li>
    <li><b>Szenarien</b> durchsehen: Texte anpassen, nicht benötigte deaktivieren, eigene ergänzen.</li>
    <li><b>Alarmpläne</b> auf die Standorte beziehen und die Eskalationsstufen prüfen.</li>
    <li>Einen <b>Testalarm als Übung</b> auslösen und die Zustellung in der Alarmzentrale beobachten.</li>
  </ol>
</section>

<section id="a7">
  <h2 class="abschnitt"><span class="zahl">7</span> Organisation und Integrationen</h2>
  <p>
    Unter <span class="ui">Integrationen</span> binden Sie die Dienste des Kunden an.
    Zugangsdaten werden maskiert gespeichert und verlassen den Server nie im
    Klartext; zu jeder Anbindung gehört ein Verbindungstest.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-26-organisation-redundanz.webp" alt="Seite Integrationen mit den Karten Organisation und Auftritt sowie Redundanz">
    <figcaption><b>Abb.</b> &nbsp; Oben links <span class="ui">Organisation &amp; Auftritt</span> (Name und Kurzname), rechts die Redundanz (Abschnitt 10). Darunter folgen App-Verbindung, SMS-Gateway, Teams, Telefonie, SSO und LoRaWAN.</figcaption>
  </figure>
  <h3>Logo und Akzentfarbe</h3>
  <p>
    Unter <span class="ui">Organisation &amp; Auftritt</span> lassen sich pro Kunde ein
    <b>Logo</b> hochladen (PNG, JPEG, SVG oder WebP, höchstens rund 300&nbsp;KB, am besten
    mit transparentem Hintergrund) und eine <b>Akzentfarbe</b> wählen. Beides erscheint
    auf der Anmeldemaske, in der Portal-Navigation und in der App &ndash; ohne dass die App
    angepasst werden müsste. Das <b>Alarmrot bleibt bewusst bei allen Kunden gleich</b>:
    Signalfarben für Alarme und SOS sind nicht umfärbbar. App-Icon und Name im
    App&nbsp;Store bzw. Play&nbsp;Store gehören zum Build und sind für alle Kunden identisch.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Was Sie pro Anbindung brauchen</caption>
      <thead><tr><th>Anbindung</th><th>Vom Kunden nötig</th></tr></thead>
      <tbody>
        <tr><td><b>SMS-Gateway</b></td><td>Konto bei eCall oder ASPSMS (Schweiz) mit Zugangsdaten &ndash; oder ein eigenes HTTP-Gateway mit URL-Vorlage</td></tr>
        <tr><td><b>Microsoft Teams: Kanalmeldungen</b></td><td>Workflow «Bei Webhookanforderung posten» im Zielkanal; die erzeugte URL hier eintragen</td></tr>
        <tr><td><b>Sprachanruf / Telefonkonferenz</b></td><td>App-Registrierung in Entra ID mit den Berechtigungen <code>OnlineMeetings.ReadWrite.All</code> und <code>Calls.Initiate.All</code></td></tr>
        <tr><td><b>Single Sign-On</b></td><td>App-Registrierung in Entra ID; als Umleitungs-URI die Adresse <code>https://ihre-domain.ch/api/auth/sso/callback</code> eintragen</td></tr>
        <tr><td><b>LoRaWAN / Alarmknöpfe</b></td><td>Webhook im Netzserver (TTN, ChirpStack) auf den angezeigten Endpunkt mit dem erzeugten Token</td></tr>
        <tr><td><b>Geofencing</b></td><td>Umriss je Standort auf der Karte; die Mitarbeitenden stimmen der Standortfreigabe in der App zu</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Gut zu wissen</p>
    <p>
      SSO, Teams und Telefonie laufen je Kunde über dessen eigenen
      Microsoft-Mandanten &ndash; jeder Kunde registriert die Anwendungen in seinem
      Entra&nbsp;ID mit der Adresse seines eigenen Alarmservers. Es gibt keine geteilte
      Infrastruktur zwischen Kunden.
    </p>
  </div>
</section>

<section id="a8">
  <h2 class="abschnitt"><span class="zahl">8</span> Die App verteilen und verbinden</h2>
  <p>
    Die App gibt es <b>für iOS und Android aus demselben Code</b> &ndash; für alle Kunden
    dieselbe. Auf die iPhones kommt sie über TestFlight oder den App&nbsp;Store, auf
    Android-Geräte über den Play&nbsp;Store oder als direkt installierbares APK (etwa per
    Geräteverwaltung). Damit sie mit dem richtigen Server spricht, zeigt das Portal
    unter <span class="ui">Integrationen &rarr; App-Verbindung</span> einen QR-Code.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-27-app-verbindung.webp" alt="Karte App-Verbindung mit QR-Code und Verbindungs-Link">
    <figcaption><b>Abb.</b> &nbsp; Der Verbindungs-QR-Code. Er enthält die Serveradresse und &ndash; wenn eingerichtet &ndash; die Adresse des Ausweichservers.</figcaption>
  </figure>
  <ol class="schritte">
    <li>App installieren (TestFlight-Einladung, App&nbsp;Store, Play&nbsp;Store oder APK der Geräteverwaltung).</li>
    <li>QR-Code mit der Kamera des Telefons scannen &ndash; die App öffnet sich und übernimmt die Adresse. Alternativ den Link aus dem Portal per E-Mail oder Geräteverwaltung (MDM) verteilen.</li>
    <li>Mit dem eigenen Konto anmelden. Die App fragt danach die Mitteilungs-Berechtigungen ab.</li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Hörbare Alarme</p>
    <p>
      <b>iOS:</b> Damit Alarme auch ein stummgeschaltetes iPhone durchdringen, braucht die
      App die Berechtigungen für zeitkritische Mitteilungen und Critical Alerts &ndash;
      Einrichtung siehe <code>mobile/CRITICAL-ALERTS.md</code>; bis dahin kommen Alarme als
      normale Mitteilung an. <b>Android:</b> Laute Alarme laufen über den
      Benachrichtigungskanal «Alarme», den die App selbst anlegt &ndash; höchste Wichtigkeit,
      Umgehung von «Nicht stören», und der Ton spielt wie bei einem Wecker über den
      Alarm-Audiokanal: Er klingt auch bei Lautlos- und Vibrationsmodus (massgeblich ist
      die Wecker-Lautstärke). Eine Sonderbewilligung braucht es nicht.
    </p>
  </div>
  <h3>Android einmalig einrichten</h3>
  <p>
    Für Android braucht es einmalig: den <b>Signatur-Schlüssel</b> bei Expo (den ersten
    Build interaktiv ausführen, EAS erzeugt und verwahrt ihn), für Remote-Push ein
    <b>Firebase-Projekt</b> (FCM) und für die automatische Übermittlung an den
    Play&nbsp;Store ein <b>Google-Dienstkonto</b> &ndash; Schritt für Schritt in
    <code>mobile/README.md</code>, Abschnitt «Android». Den JSON-Schlüssel des
    Dienstkontos legen Sie auf dem Server als
    <code>mobile/play-service-account.json</code> ab. Sobald diese Datei liegt, baut
    und übermittelt der Update-Knopf Android automatisch mit &ndash; ohne weitere
    Einstellung. Liegt die Installation in einem Web-Verzeichnis (etwa
    <code>public_html</code> auf einem Shared Hosting), schützen die mitgelieferten
    <code>.htaccess</code>-Dateien in <code>mobile/</code> und <code>server/</code>
    Schlüssel, <code>.env</code> und Datenbank vor direktem Abruf; prüfen Sie das
    einmal im Browser &ndash; der Aufruf von
    <code>https://ihre-domain/mobile/play-service-account.json</code> muss mit
    «403 Forbidden» oder «404» enden. <code>SOBE_EAS_PLATFORMS=ios|android|all</code> in
    <code>server/.env</code> übersteuert die Automatik bei Bedarf.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Der allererste Android-Build</p>
    <p>
      Die erste App-Datei (.aab) einer neuen App muss <b>einmal von Hand</b> in der
      Play&nbsp;Console hochgeladen werden (interner Test), bevor Google automatische
      Übermittlungen des Dienstkontos annimmt &ndash; sonst endet die Übermittlung mit
      «Package not found». Ab dem zweiten Build läuft alles automatisch. Für die
      Play&nbsp;Console ist ein Entwicklerkonto nötig (einmalig USD&nbsp;25);
      firmenintern genügt oft das APK aus dem Preview-Profil.
    </p>
  </div>

  <h3>Hinweise der Play&nbsp;Console</h3>
  <p>
    Nach jedem Upload prüft Google das Bundle und zeigt im Release-Dashboard
    Empfehlungen an. Drei davon betreffen die App und sind im Projekt bereits
    berücksichtigt:
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Prüfpunkte der Play&nbsp;Console und ihre Behandlung</caption>
      <thead><tr><th>Hinweis</th><th>Stand</th></tr></thead>
      <tbody>
        <tr>
          <th scope="row">DEX-Codeoptimierung / Verschleierung</th>
          <td>R8 ist für Release-Builds eingeschaltet
          (<code>expo-build-properties</code> in <code>mobile/app.json</code>).</td>
        </tr>
        <tr>
          <th scope="row">Einschränkungen für Grösse und Ausrichtung</th>
          <td>Die Android-App ist nicht mehr aufs Hochformat festgelegt; der Inhalt
          wird auf breiten Displays mittig begrenzt. Auf dem iPhone bleibt es beim
          Hochformat, das iPad darf drehen.</td>
        </tr>
        <tr>
          <th scope="row">Nicht mehr unterstützte APIs für die randlose Anzeige</th>
          <td>Die genannten Aufrufe stammen aus React&nbsp;Native selbst
          (<code>com.facebook.react.&hellip;</code>), nicht aus dem Code dieser App.
          Sie verschwinden mit einer künftigen React-Native-Fassung.</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Nach dem Einschalten von R8 zuerst testen</p>
    <p>
      R8 entfernt und verschleiert ungenutzten Code. Die verwendeten Bibliotheken
      liefern die nötigen Ausnahmeregeln selbst mit, trotzdem gilt: Den nächsten
      Android-Build <b>zuerst über den internen Test</b> auf ein Gerät bringen und
      Anmeldung, Alarmauslösung, Push-Zustellung und den Alleinarbeits-Timer
      durchspielen, bevor der Release in die Produktion hochgestuft wird.
    </p>
  </div>
</section>

<section id="a9">
  <h2 class="abschnitt"><span class="zahl">9</span> Alarmknöpfe anbinden</h2>
  <p>
    Alarmknöpfe und tragbare Notrufgeräte melden sich über ein Funknetz beim
    Alarmserver. Ein Knopfdruck löst einen <b>stillen Alarm mit Quittierpflicht</b>
    aus &ndash; quittiert innerhalb der eingestellten Zeit niemand, wird der
    <b>Krisenstab</b> per Sprachanruf und SMS aufgeboten.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Kein automatischer Notruf</p>
    <p>
      Die Eskalation geht an den Krisenstab, <b>nicht</b> an Polizei, Feuerwehr
      oder Rettungsdienst. Eine Schnittstelle zu einer Einsatzleitzentrale gibt
      es nicht &ndash; der Notruf wird von Hand gewählt. Die Nummern stehen unter
      <span class="ui">Notfallkontakte</span> und sind in der App direkt
      antippbar. Das Alarmjournal hält bei einer solchen Eskalationsstufe
      ausdrücklich fest, dass keine externe Alarmierung erfolgt ist.
    </p>
  </div>

  <h3>Was es dafür braucht</h3>
  <div class="tabelle-huelle">
    <table>
      <caption>Bestandteile einer Knopf-Installation</caption>
      <thead><tr><th>Teil</th><th>Wozu</th></tr></thead>
      <tbody>
        <tr><td><b>Knöpfe / Badges</b></td><td>Das Gerät, das gedrückt wird. LoRaWAN im Band EU868, oder GSM-Geräte mit eigener SIM-Karte.</td></tr>
        <tr><td><b>Gateways</b></td><td>Empfangen den Funkruf und leiten ihn ins Internet weiter. Mindestens eines je Standort; in Kellern, Technikräumen und Bädern meist ein zusätzliches.</td></tr>
        <tr><td><b>Netzserver</b></td><td>The Things Stack, ChirpStack &ndash; oder der Netzserver, den viele Gateways bereits eingebaut mitbringen. Verwaltet die Geräte, entschlüsselt die Funkdaten und ruft den Alarmserver auf.</td></tr>
        <tr><td><b>Decoder</b></td><td>Kleines Skript im Netzserver, das die rohen Bytes des Geräts in lesbare Felder übersetzt. Liefert in der Regel der Hersteller.</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Zwei Gateways statt eines</p>
    <p>
      LoRaWAN funktioniert als Rundruf: Jedes Gateway in Reichweite empfängt
      denselben Knopfdruck, der Netzserver verwirft die Duplikate. Zwei Gateways
      ergeben damit <em>ohne jede Konfiguration</em> Redundanz. Mit nur einem
      Gateway steht ein einzelner Ausfallpunkt in genau der Kette, die Leben
      schützen soll.
    </p>
  </div>

  <h3>Einrichten</h3>
  <ol>
    <li>Im Portal unter <span class="ui">Integrationen &rsaquo; LoRaWAN-Netz / Alarmknöpfe</span>
      den Endpunkt einschalten und ein <b>Token erzeugen</b>. Endpunkt-Adresse und Token
      werden dort angezeigt und lassen sich kopieren.</li>
    <li>Im Netzserver einen <b>Webhook</b> auf diese Adresse einrichten und das Token als
      <code>Authorization: Bearer …</code> mitgeben. Lehnt die Oberfläche den Wert ab &ndash;
      manche Gateways lassen im Kopfzeilen-Wert kein Leerzeichen zu &ndash;, genügt auch das
      nackte Token ohne <code>Bearer</code>; als letzte Möglichkeit
      <code>?token=</code> in der Adresse, dann steht es allerdings in Protokolldateien.</li>
    <li>Jedes Gerät im Portal unter <span class="ui">Alarmknöpfe</span> registrieren.
      Entscheidend ist die <b>Seriennummer</b>: Sie muss der Geräte-Kennung im Netzserver
      entsprechen (DevEUI bei LoRaWAN). Gross- und Kleinschreibung sowie Bindestriche
      spielen keine Rolle.</li>
    <li>Mit <span class="ui">Auslösen (Test)</span> die Kette prüfen, danach am Gerät selbst.</li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Wenn der Netzserver nicht übersetzen kann</p>
    <p>
      Der in Gateways eingebaute Netzserver nimmt oft keinen eigenen
      Payload-Decoder auf &ndash; beim RAK WisGate stehen als Payload-Format nur
      <span class="ui">None</span> und <span class="ui">CayenneLPP</span> zur Auswahl.
      Für die im Portal unter <span class="ui">Alarmknöpfe &rsaquo; Modell</span> aufgeführten
      Geräte übersetzt der Alarmserver die Nutzlast dann selbst; im Netzserver ist
      nichts zu hinterlegen. Für alle übrigen Geräte bleibt nur ein externer
      Netzserver mit eigenem Decoder.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Beim Einrichten: Letzte Uplinks</p>
    <p>
      Unter <span class="ui">Integrationen &rsaquo; LoRaWAN-Netz / Alarmknöpfe</span> steht
      die Liste <span class="ui">Letzte Uplinks</span>. Dort erscheint jeder eintreffende
      Uplink innert zehn Sekunden &ndash; auch ein abgewiesener, mit dem Grund im Klartext,
      der Gerätekennung zum Kopieren und den Namen der übersetzten Felder. Damit ist die
      Frage beantwortet, die sich sonst nicht beantworten lässt: Liegt es am Gateway oder
      am Portal? Steht dort nichts, hat der Alarmserver nie etwas gesehen.
    </p>
    <p>
      Die Liste hält nur die jüngsten Meldungen und verschwindet mit einem Neustart des
      Servers &ndash; sie ist eine Sichthilfe, kein Protokoll. Was dauerhaft festgehalten
      gehört, steht im <span class="ui">Ereignisprotokoll</span>: ein Gerät ohne
      Payload-Decoder ebenso wie ein Uplink von einer nicht registrierten Kennung.
    </p>
  </div>
  <p>
    Verstanden werden die Formate von <b>The Things Network v3</b>, <b>ChirpStack v4</b>,
    <b>ChirpStack v3</b> &ndash; das ist auch der in Gateways eingebaute Netzserver &ndash;
    und ein generisches JSON für eigene Bridges und GSM-Knöpfe:
    <code>{ serial, event, battery, lat, lng }</code>. Als Knopfdruck gilt ein Uplink,
    dessen entschlüsselte Daten ein Feld wie <code>alarm</code>, <code>sos</code>,
    <code>button</code> oder <code>emergency</code> enthalten beziehungsweise ein
    Ereignis dieses Namens melden. Reine Statusmeldungen aktualisieren nur Batteriestand
    und Zeitpunkt des letzten Signals.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Ohne Payload-Decoder löst kein Knopf aus</p>
    <p>
      Fehlt im Netzserver der Decoder des Geräts, kommt der Uplink zwar an, aber
      ohne übersetzte Nutzlast &ndash; ein Knopfdruck ist dann nicht von einer
      Statusmeldung zu unterscheiden. Der Alarmserver weist solche Uplinks
      ausdrücklich ab und schreibt einen Eintrag ins Ereignisprotokoll, statt sie
      stillschweigend als Lebenszeichen zu verbuchen. Liefert der Decoder kein
      Feld, das nach Alarm aussieht, genügt im Decoder eine Zeile wie
      <code>data.alarm = true</code>.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Gateway hier, Alarmserver dort</p>
    <p>
      Das Gateway spricht nie direkt mit dem Alarmserver. Es reicht die Funkpakete
      an den Netzserver weiter, und erst der ruft den Alarmserver auf. Alle
      Verbindungen gehen dabei <b>von innen nach aussen</b>: Für ein Gateway im
      Schulhaus und einen Alarmserver beim Hoster braucht es deshalb weder
      Portfreigabe noch feste IP-Adresse noch VPN.
    </p>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Vor dem Kauf: Funkmessung</p>
    <p>
      Wie viele Gateways es braucht, lässt sich nicht am Schreibtisch bestimmen.
      Beschaffen Sie zuerst <b>ein Gateway und je ein Mustergerät</b> und messen Sie
      den Empfang genau dort, wo jemand allein arbeitet &ndash; Untergeschoss,
      Technikraum, Therapiebad. Dort ist der Empfang am schlechtesten, und genau dort
      muss der Knopf funktionieren. Die meisten Geräte haben einen Testmodus, der die
      Empfangsqualität anzeigt.
    </p>
  </div>
  <p>
    Einen vollständigen Durchlauf &ndash; Gateway, eingebauter Netzserver,
    Payload-Decoder, Endpunkt, erster Knopf &ndash; beschreibt im Projektordner die
    Datei <code>LORAWAN-EINRICHTUNG.md</code>.
  </p>
  <p>
    Die Überwachung der Knöpfe (stumme Geräte, schwache Batterie) beschreibt
    Handbuch&nbsp;1, Abschnitt «Alleinarbeit und Alarmknöpfe».
  </p>
</section>

<section id="a10">
  <h2 class="abschnitt"><span class="zahl">10</span> Redundanz: zweiter Alarmserver</h2>
  <p>
    Ein zweiter Alarmserver sichert den Betrieb gegen den Ausfall des ersten ab &ndash;
    von Anfang an oder nachträglich, idealerweise auf einer anderen Maschine in
    einem anderen Rechenzentrum. Der zweite Server (<b>Standby</b>) spiegelt laufend
    den vollständigen Datenbestand des ersten (<b>Hauptserver</b>) und übernimmt
    selbständig, wenn dieser ausfällt.
  </p>
  <h3>Einrichten</h3>
  <ol class="schritte">
    <li>Zweiten Server nach Abschnitt 3 aufsetzen &ndash; eigene Domain (z.&nbsp;B. <code>notfall2.kunde.ch</code>), eigene Datenbank. Den Einrichtungsassistenten dort einfach schliessen: Die Daten kommen gleich vom Hauptserver.</li>
    <li>Auf dem <b>Hauptserver</b> unter <span class="ui">Integrationen &rarr; Redundanz</span>: einschalten, Rolle <span class="ui">Hauptserver</span>, Adresse des Partners eintragen, <span class="ui">Speichern</span>. Das erzeugte <b>Geheimnis kopieren</b>.</li>
    <li>Auf dem <b>zweiten Server</b>: einschalten, Rolle <span class="ui">Standby</span>, Adresse des Hauptservers und das kopierte Geheimnis eintragen, <span class="ui">Speichern</span>.</li>
    <li>Prüfen: Auf beiden Seiten meldet die Karte <b>Partner: erreichbar</b>, auf dem Standby zusätzlich <b>Letzter Abgleich: &hellip; erfolgreich</b>.</li>
  </ol>
  <figure class="bild-breit">
    <img src="bilder/web-28-redundanz-standby.webp" alt="Redundanz-Karte auf dem Standby-Server mit erreichbarem Partner und erfolgreichem letztem Abgleich">
    <figcaption><b>Abb.</b> &nbsp; Der Standby-Server nach der Kopplung: Partner erreichbar, Abgleich läuft. Der gespiegelte Bestand enthält auch den Organisationsnamen &ndash; das Portal des Standby sieht aus wie das des Hauptservers.</figcaption>
  </figure>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Wichtig</p>
    <p>
      Beim Speichern der Rolle <span class="ui">Standby</span> wird der dortige
      Datenbestand vollständig durch den des Hauptservers ersetzt &ndash; auch Konten
      und Sitzungen. Sie werden dabei abgemeldet und melden sich anschliessend mit
      den Konten des Hauptservers an.
    </p>
  </div>
  <h3>Was im Betrieb geschieht</h3>
  <div class="tabelle-huelle">
    <table>
      <caption>Verhalten der beiden Server</caption>
      <thead><tr><th>Lage</th><th>Hauptserver</th><th>Standby</th></tr></thead>
      <tbody>
        <tr><td><b>Normalbetrieb</b></td><td>verarbeitet alles</td><td>spiegelt alle 30 Sekunden den ganzen Bestand &ndash; samt Konten, Sitzungen und Push-Registrierungen; Eskalationen und Versand bleiben aus, sonst ginge alles doppelt raus</td></tr>
        <tr><td><b>Hauptserver fällt aus</b></td><td>&ndash;</td><td>übernimmt nach 90 Sekunden: Alarme auslösen, quittieren, eskalieren, Push versenden</td></tr>
        <tr><td><b>Hauptserver kehrt zurück</b></td><td>übernimmt wieder die Führung</td><td>meldet während des Ausfalls erfasste Alarme, Protokolleinträge und Alleinarbeits-Timer zurück und wird wieder passiv</td></tr>
      </tbody>
    </table>
  </div>
  <p>
    Die <b>App</b> kennt beide Adressen &ndash; über den QR-Code oder automatisch nach
    der ersten Verbindung. Fällt der eingestellte Server aus, versucht sie jede
    Anfrage beim Partner und bleibt dort, bis der Hauptserver wieder antwortet.
    Weil Sitzungen mitgespiegelt werden, bleiben die Geräte dabei angemeldet;
    niemand muss etwas tun. Für das <b>Portal</b> gibt es keine automatische
    Umleitung: Hinterlegen Sie die Portal-Adresse des Standby beim Krisenstab.
  </p>
  <div class="hinweis hinweis--stopp">
    <p class="marke-klein">Grenze</p>
    <p>
      Während eines Ausfalls auf dem Standby geänderte <b>Verwaltungsdaten</b>
      (Konten, Szenarien, Einstellungen) werden beim nächsten Abgleich vom Stand
      des Hauptservers überschrieben. Zurückgemeldet werden Alarme, Protokoll und
      Alleinarbeits-Timer. Verwaltungsarbeit deshalb immer auf dem Hauptserver
      erledigen.
    </p>
  </div>
  <h3>Failover proben</h3>
  <ol class="schritte">
    <li>Hauptserver stoppen (Dienst anhalten).</li>
    <li>Gut zwei Minuten warten &ndash; das Portal des Standby meldet <b>Failover aktiv</b>, das Ereignisprotokoll den Übergang.</li>
    <li>In der App einen Übungsalarm auslösen und quittieren &ndash; sie hat unbemerkt auf den Standby gewechselt.</li>
    <li>Hauptserver wieder starten. Nach dem nächsten Abgleich steht der Übungsalarm auch dort im Protokoll, der Standby ist wieder passiv.</li>
  </ol>
</section>

<section id="a11">
  <h2 class="abschnitt"><span class="zahl">11</span> Weitere Kunden aufsetzen</h2>
  <p>
    Jeder weitere Kunde bekommt eine eigene Instanz: eigene Domain, eigenes
    Verzeichnis, eigene <code>server/.env</code> mit eigenem <code>PORT</code> und eigenem
    <code>SOBE_DB_PATH</code>, eigene Sicherung. Mehrere Instanzen können auf derselben
    Maschine laufen; zwischen den Kunden wird nichts geteilt.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Checkliste je Kunde</caption>
      <thead><tr><th>&nbsp;</th><th>Schritt</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Domain(s) und Zertifikat, Instanz(en) nach Abschnitt 3 mit eigener <code>.env</code> und Datenbank</td></tr>
        <tr><td>2</td><td>Erstanmeldung, Passwort gewechselt, Einrichtungsassistent abgeschlossen</td></tr>
        <tr><td>3</td><td>Standorte, Konten, Gruppen, Alarmpläne erfasst (Abschnitt 6)</td></tr>
        <tr><td>4</td><td>Integrationen mit den Zugangsdaten des Kunden eingetragen und getestet (Abschnitt 7)</td></tr>
        <tr><td>5</td><td>Redundanz eingerichtet und Failover einmal geprobt (Abschnitt 9)</td></tr>
        <tr><td>6</td><td>QR-Code verteilt, Testalarm als Übung mit Quittierung durchgeführt (Abschnitt 8)</td></tr>
        <tr><td>7</td><td>Sicherung eingerichtet und eine Wiederherstellung ausprobiert (Abschnitt 11)</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Gut zu wissen</p>
    <p>
      Die kompakte technische Fassung dieser Schritte liegt als
      <code>KUNDEN-SETUP.md</code> im Projektverzeichnis &ndash; zum Abhaken beim
      Aufsetzen.
    </p>
  </div>
</section>

<section id="a12">
  <h2 class="abschnitt"><span class="zahl">12</span> Aktualisierung und Sicherung</h2>
  <h3>Aktualisieren per Knopfdruck</h3>
  <p>
    Die Administration aktualisiert den Server aus dem Portal: Der Knopf
    <span class="ui">Aktualisierung</span> unten in der Seitenleiste holt den neuesten
    Stand aus der Versionsverwaltung, baut Portal und Server und startet neu &ndash;
    Schritt für Schritt nachvollziehbar, mit Protokoll. Auf Wunsch stösst derselbe
    Dialog auch den <b>App-Build</b> an (braucht <code>EXPO_TOKEN</code> auf dem Server;
    iOS immer, Android automatisch mit, sobald <code>mobile/play-service-account.json</code>
    liegt &ndash; Abschnitt «Android einmalig einrichten»).
    Die Bedienung zeigt Handbuch 1, Abschnitt «Die Anwendung aktualisieren».
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-24-update-dialog.webp" alt="Dialog Aktualisierung mit Versionsstand und den Schritten des Update-Laufs">
    <figcaption><b>Abb.</b> &nbsp; Der Update-Dialog. Voraussetzung ist die Installation per <code>git clone</code> (Abschnitt 3).</figcaption>
  </figure>
  <div class="hinweis">
    <p class="marke-klein">Bei Redundanz</p>
    <p>
      Beide Server sollen denselben Stand haben. Aktualisieren Sie zuerst den
      Standby, prüfen Sie den Abgleich, dann den Hauptserver &ndash; so ist immer eine
      aktuelle Instanz übernahmebereit.
    </p>
  </div>
  <h3>Sicherung</h3>
  <p>
    <code>npm run sicherung</code> im Verzeichnis <code>server/</code> legt eine in sich
    stimmige Kopie der Datenbank an &ndash; auch im laufenden Betrieb &ndash; und räumt
    Sicherungen auf, die älter als 30 Tage sind (Ziel und Frist:
    <code>SOBE_BACKUP_DIR</code>, <code>SOBE_BACKUP_TAGE</code>). Richten Sie den Aufruf
    als täglichen Cron-Auftrag ein; die Kachel <b>Bereitschaft</b> im Dashboard
    zeigt, wann die letzte Sicherung lief.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Wichtig</p>
    <p>
      Die Datenbankdatei nie im laufenden Betrieb von Hand kopieren: Die zuletzt
      geschriebenen Daten stehen im Schreibprotokoll (<code>-wal</code>) und fehlten in
      der Kopie. Das Sicherungsskript umgeht das.
    </p>
  </div>
  <h3>Wiederherstellen</h3>
  <ol class="schritte">
    <li>Server anhalten.</li>
    <li>Die Sicherungsdatei an den Ort aus <code>SOBE_DB_PATH</code> kopieren (allfällige <code>-wal</code>- und <code>-shm</code>-Dateien daneben löschen).</li>
    <li>Server starten und die Anmeldung prüfen. Ein Standby holt sich den wiederhergestellten Stand beim nächsten Abgleich selbst.</li>
  </ol>
</section>

<section id="a13">
  <h2 class="abschnitt"><span class="zahl">13</span> Wenn etwas nicht geht</h2>

  <h4>Im Protokoll steht eine Anmeldung, die niemand erklären kann</h4>
  <p>
    Der Eintrag <em>«Anmeldung: &lt;Name&gt;»</em> entsteht nur, wenn E-Mail-Adresse
    und Passwort richtig übermittelt wurden. Die App meldet sich nicht von selbst neu
    an: Sie speichert ein Sitzungs-Token, nie das Passwort, und das Token gilt
    30&nbsp;Tage. Eine Anmeldung im Protokoll heisst also: Jemand hat das Passwort
    eingegeben.
  </p>
  <p>
    Wer das war, zeigt seit Version&nbsp;12 der Eintrag selbst &ndash; er nennt
    IP-Adresse und Gerät. Für ältere Einträge fehlt diese Angabe. Den aktuellen Stand
    zeigt:
  </p>
  <pre><code>cd ~/public_html/ihre-domain.ch/server
npm run sitzungen</code></pre>
  <p>
    Der Befehl listet jede offene Anmeldung mit Zeitpunkt, letzter Aktivität, Adresse
    und Gerät, dazu die fehlgeschlagenen Versuche der letzten sieben Tage.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Im Verdachtsfall</p>
    <p>
      In dieser Reihenfolge: <b>Passwort des betroffenen Kontos ändern</b> &ndash; das
      beendet zugleich alle seine Anmeldungen. Dann
      <code>npm run sitzungen -- beenden</code>, womit alle übrigen Anmeldungen
      erlöschen und sich jede Person neu anmelden muss. Danach das Ereignisprotokoll
      auf weitere Einträge derselben Adresse durchsuchen. Alarme, Szenarien und
      Konten bleiben dabei unberührt.
    </p>
  </div>
  <p>
    Vorbeugend: Nach <b>fünf</b> Fehlversuchen je E-Mail-Adresse ist die Anmeldung für
    <b>15&nbsp;Minuten</b> gesperrt, auch mit dem richtigen Passwort. Jeder Fehlversuch
    steht im Protokoll. Ein Konto, dessen Passwort erraten werden könnte, fällt damit
    auf, bevor es gelingt.
  </p>

  <h4>Der Server startet nicht</h4>
  <p>
    Meldet der Start einen Fehler zu <code>better-sqlite3</code>, passt die
    Node-Version nicht (Abschnitt 2) &ndash; <code>node -v</code> muss 22 oder 24 zeigen.
    Meldet er <code>EADDRINUSE</code>, läuft auf dem Port bereits ein Prozess: andere
    Instanz oder alter Prozess; <code>PORT</code> prüfen.
  </p>

  <h4>Aktualisierung scheitert beim «Änderungen vom Repository holen»</h4>
  <p>
    Meldet der Schritt <em>«GitHub is temporarily limiting some unauthenticated
    downloads»</em>, drosselt GitHub unauthentifizierte Abrufe von dieser IP-Adresse
    &ndash; auf einem Shared Hosting teilen sich viele Kunden dieselbe. Kurzfristig hilft
    ein erneuter Versuch nach ein paar Minuten. Dauerhaft: auf GitHub ein
    Fine-grained-Token nur für dieses Repository mit der Berechtigung
    <b>Contents: Read-only</b> erzeugen und als <code>GITHUB_TOKEN</code> in
    <code>server/.env</code> eintragen &ndash; der Server holt dann authentifiziert, mit
    grosszügigem Kontingent. Das Token erscheint nie im Update-Protokoll.
  </p>

  <h4>Das Ereignisprotokoll wirkt zurückgesetzt &ndash; jüngste Einträge fehlen</h4>
  <p>
    Fast immer arbeitet der Server dann auf einer <b>anderen Datenbankdatei</b>. Ohne
    <code>SOBE_DB_PATH</code> in <code>server/.env</code> wird der Pfad
    <code>data/sobe-notfall.sqlite</code> gegen das <b>Arbeitsverzeichnis</b> aufgelöst:
    Wird der Server einmal aus einem anderen Verzeichnis gestartet, legt er dort eine
    neue, leere Datenbank an oder greift auf eine ältere zurück &ndash; ohne Fehlermeldung.
  </p>
  <p>
    Seit dem Startprotokoll ist das erkennbar: Jeder Serverstart schreibt einen Eintrag
    <em>«Alarmserver gestartet &ndash; Datenbank &lt;Pfad&gt;, N Protokolleinträge
    vorhanden»</em> ins Ereignisprotokoll und dieselbe Zeile auf die Konsole. Weicht der
    Pfad vom gewohnten ab oder sackt die Anzahl plötzlich ab, ist die Ursache benannt.
  </p>
  <p>
    Nachträglich klärt das ein eigener Befehl. Er zeigt, mit welcher Datei gearbeitet
    wird, wie viele Einträge pro Tag darin stehen, und vergleicht jede Sicherung damit:
  </p>
  <pre><code>cd ~/public_html/ihre-domain.ch/server
npm run pruefe-datenbank</code></pre>
  <p>
    Meldet er <em>«Das Ereignisprotokoll ist vollständig»</em>, ist nichts verloren
    gegangen &ndash; das Portal hat dann zwischenzeitlich eine andere Datei gesehen.
    Nennt er dagegen Einträge, die nur noch in einer Sicherung stehen, überschreiben Sie
    nichts und klären erst die Ursache.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Seit Version 12 kann das nicht mehr passieren</p>
    <p>
      Datenbank, Portal-Verzeichnis und Repository-Wurzel zählen jetzt ab dem Ordner
      <code>server/</code>, in dem der Programmcode liegt &ndash; nicht mehr ab dem
      Arbeitsverzeichnis. Von wo aus der Server gestartet wird, spielt damit keine
      Rolle mehr. <code>SOBE_DB_PATH</code>, <code>SOBE_WEB_ROOT</code> und
      <code>SOBE_REPO_ROOT</code> gehen weiterhin vor, wenn sie gesetzt sind.
    </p>
    <p>
      Ein <code>find</code> über das Benutzerverzeichnis taugt übrigens nicht zur
      Suche: Auf Shared Hosting ist <code>public_html</code> meist eine symbolische
      Verknüpfung, der <code>find</code> ohne <code>-L</code> nicht folgt &ndash; die
      laufende Datenbank fehlt dann in der Liste, obwohl es sie gibt.
    </p>
  </div>

  <h4>Die Sicherungen sind alle gleich gross und enden am selben Tag</h4>
  <p>
    Dann kopiert der Sicherungslauf eine andere Datei als die, mit der der Server
    arbeitet &ndash; typischerweise, weil der Cron-Eintrag in einem anderen Verzeichnis
    startet. Für den betroffenen Zeitraum gibt es dann <b>keine</b> brauchbare
    Sicherung, obwohl der Ordner voller Dateien ist.
  </p>
  <p>
    <code>npm run pruefe-datenbank</code> erkennt das und benennt es getrennt vom
    Ereignisprotokoll. <code>npm run sicherung</code> prüft seit Version 12 jede frisch
    geschriebene Sicherung nach und meldet eine Warnung, wenn deren Protokoll mehr als
    drei Tage zurückliegt oder ganz fehlt. Auch hier zählen die Pfade ab
    <code>server/</code>, das Arbeitsverzeichnis des Cron-Eintrags spielt keine Rolle
    mehr.
  </p>

  <h4>Portal erreichbar, aber «Alarmserver nicht erreichbar»</h4>
  <p>
    Das Portal wurde geladen, die Schnittstelle antwortet nicht. Prüfen Sie
    <code>https://ihre-domain.ch/api/health</code>. Kommt dort nichts, ist der
    Node-Prozess nicht (mehr) gestartet oder die Weiterleitung des Hostings zeigt
    auf den falschen Port.
  </p>

  <h4>Die App findet den Server nicht</h4>
  <p>
    Die Adresse steht in der App unten auf der Anmeldemaske &ndash; Antippen zeigt und
    ändert sie. Sie muss mit <code>https://</code> beginnen und öffentlich erreichbar
    sein; am einfachsten den QR-Code aus dem Portal erneut scannen. Meldet die App
    bei richtiger Adresse «E-Mail-Adresse oder Passwort ist falsch», obwohl das
    Konto stimmt, ist der App-Build zu alt und kennt die Serveranbindung noch nicht.
  </p>

  <h4>Der Abgleich der Redundanz schlägt fehl</h4>
  <p>
    Die Karte <span class="ui">Redundanz</span> nennt den Grund beim letzten Abgleich.
    Die häufigsten: Das <b>Geheimnis</b> stimmt auf den beiden Servern nicht überein
    (auf einem neu erzeugen und auf dem anderen eintragen), die <b>Partneradresse</b>
    ist falsch oder ohne <code>https://</code>, oder eine Firewall lässt die Server
    nicht zueinander. Beide Rollen prüfen: genau ein Hauptserver, genau ein Standby.
  </p>

  <h4>Der Standby übernimmt nicht</h4>
  <p>
    Der Standby übernimmt erst, wenn der Hauptserver länger als 90 Sekunden nicht
    antwortet &ndash; kurze Aussetzer lösen bewusst kein Failover aus. Steht danach
    kein <b>Failover aktiv</b> in der Redundanz-Karte, war der Hauptserver aus Sicht
    des Standby erreichbar: Erreichbarkeit zwischen den beiden Maschinen prüfen.
  </p>

  <h4>Niemand kommt mehr ins Portal</h4>
  <p>
    Auf dem Server hilft <code>npm run reset-admin</code> im Verzeichnis
    <code>server/</code>: Es setzt das Passwort des ersten Administratorkontos auf ein
    neues Zufallspasswort (auf Wunsch für ein bestimmtes Konto:
    <code>npm run reset-admin -- name@firma.ch</code>). Der Aufruf läuft direkt auf der
    Maschine und braucht keine Anmeldung.
  </p>

  <h4>Push-Mitteilungen kommen nicht an</h4>
  <p>
    Die Kachel <b>Bereitschaft</b> zeigt, ob der Push-Dienst erreichbar ist und wie
    viele Geräte registriert sind. <span class="ui">Testmeldung an mein Telefon</span>
    prüft die Kette bis aufs Gerät. Kommt dort nichts an, ist meist das Gerät nicht
    registriert (in der App an- und wieder abmelden) oder die Mitteilungs-Berechtigung
    fehlt (Handbuch 1, «Wenn etwas nicht geht»).
  </p>
</section>

</main>

<footer>
  <p>
    <b>SOBE Notfall &middot; Handbuch 4 von 4 &middot; Installation &amp; Konfiguration.</b>
    Für die tägliche Verwaltung gilt Handbuch 1, für Krisenstabsmitglieder Handbuch 2,
    für Mitarbeitende Handbuch 3.
  </p>
  <p>
    Die Bildschirmfotos zeigen einen frisch aufgesetzten Server mit Beispieldaten
    («Muster AG»). Kommandos und Pfade beziehen sich auf den Stand des Projekts zum
    Redaktionsschluss; massgeblich sind <code>DEPLOY-HETZNER.md</code>,
    <code>KUNDEN-SETUP.md</code> und <code>server/README.md</code> im Projektverzeichnis.
  </p>
  {ADRESSE}
</footer>

</div>
"""
