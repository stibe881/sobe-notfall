# -*- coding: utf-8 -*-
TITEL = 'SOBE Handbuch Administration'
TITELSEITE = dict(
    rolle='SOBE Notfall &middot; Handbuch 1 von 4',
    titel='Administration',
    untertitel='Für die Schulleitung und die Systemverantwortlichen',
    vorspann='Sie richten das Notfallsystem ein, halten es aktuell und verantworten, wer damit alarmieren darf. Dieses Handbuch führt durch das Webportal und durch die Teile der App, die nur Ihnen offenstehen.',
)

KOERPER = r"""
<div class="blatt">

{TITELSEITE}

<nav class="inhalt" aria-label="Inhalt">
  <h2>Inhalt</h2>
  <ol>
    <li><a href="#a1"><span class="zahl">1</span> Anmelden und erstes Passwort</a></li>
    <li><a href="#a2"><span class="zahl">2</span> Das Portal im Überblick</a></li>
    <li><a href="#a3"><span class="zahl">3</span> Alarm auslösen</a></li>
    <li><a href="#a4"><span class="zahl">4</span> Die Alarmzentrale</a></li>
    <li><a href="#a5"><span class="zahl">5</span> Szenarien und Checklisten</a></li>
    <li><a href="#a6"><span class="zahl">6</span> Alarmpläne und Notfallkontakte</a></li>
    <li><a href="#a7"><span class="zahl">7</span> Alleinarbeit und Alarmknöpfe</a></li>
    <li><a href="#a8"><span class="zahl">8</span> Benutzende verwalten</a></li>
    <li><a href="#a9"><span class="zahl">9</span> Gruppen und Standorte</a></li>
    <li><a href="#a10"><span class="zahl">10</span> Einstellungen &amp; Konfiguration</a></li>
    <li><a href="#a11"><span class="zahl">11</span> Ereignisprotokoll</a></li>
    <li><a href="#a12"><span class="zahl">12</span> Die Anwendung aktualisieren</a></li>
    <li><a href="#a13"><span class="zahl">13</span> Rollen und Rechte</a></li>
    <li><a href="#a14"><span class="zahl">14</span> Wenn etwas nicht geht</a></li>
  </ol>
</nav>

<main>

<section id="a1">
  <h2 class="abschnitt"><span class="zahl">1</span> Anmelden und erstes Passwort</h2>
  <p>
    Ohne Anmeldung ist nichts zugänglich &ndash; weder das Portal noch die App.
    Angemeldet wird mit E-Mail-Adresse und Passwort.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-01-anmeldung.webp" alt="Anmeldemaske mit Feldern für E-Mail-Adresse und Passwort">
    <figcaption><b>Abb.</b> &nbsp; Die Anmeldemaske. Alle Konten kommen vom Alarmserver; darunter steht, mit welchem Server das Portal verbunden ist.</figcaption>
  </figure>

  <h3>Die erste Anmeldung im Live-Betrieb</h3>
  <p>
    Ein frisch aufgesetzter Alarmserver kennt genau ein Konto: das
    Administratorkonto mit einem Erstpasswort. Die Anmeldemaske nennt beides,
    solange noch niemand ein eigenes Passwort vergeben hat.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-21-anmeldung-live.webp" alt="Anmeldemaske mit Hinweis auf das Administratorkonto und das Erstpasswort">
    <figcaption><b>Abb.</b> &nbsp; Die Anmeldemaske bei der Erstinbetriebnahme. Ein Klick auf den Hinweis füllt Adresse und Erstpasswort ein.</figcaption>
  </figure>
  <p>
    Unmittelbar nach der Anmeldung verlangt das System ein eigenes Passwort. Vorher
    geht es nicht weiter &ndash; auch nicht über die Adresszeile.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-22-live-erstanmeldung.webp" alt="Bildschirm mit der Aufforderung, ein eigenes Passwort zu vergeben">
    <figcaption><b>Abb.</b> &nbsp; Der erzwungene Passwortwechsel. Mindestens acht Zeichen mit Ziffer &ndash; für Administration und Krisenstab zwölf.</figcaption>
  </figure>
  <div class="hinweis">
    <p class="marke-klein">Die Tür zum Portal</p>
    <p>
      Wer im Portal ist, kann alle Mitarbeitenden alarmieren und Pläne ändern.
      Deshalb gelten dort strengere Regeln als in der App: Passwörter der
      Administration und des Krisenstabs haben <b>mindestens zwölf Zeichen</b>,
      und eine Portalsitzung endet nach <b>zwölf Stunden</b> &ndash; ein offener
      Browser im Sekretariat soll nicht wochenlang alarmieren können. Die App
      auf dem Telefon bleibt 30 Tage angemeldet; ein Telefon, das im Ernstfall
      erst nach dem Passwort fragt, wäre gefährlicher. Den zweiten Faktor
      bringt die Anmeldung über Microsoft Entra ID, sobald sie aktiviert ist.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Gut zu wissen</p>
    <p>
      Dieselbe Sperre greift bei jedem Konto, für das Sie beim Anlegen
      <span class="ui">Passwortänderung bei der nächsten Anmeldung erzwingen</span> angekreuzt haben.
      Sie geben also ein Startpasswort weiter und wissen sicher, dass es nach der
      ersten Anmeldung nicht mehr gilt.
    </p>
  </div>
</section>

<section id="a2">
  <h2 class="abschnitt"><span class="zahl">2</span> Das Portal im Überblick</h2>
  <p>
    Das Menü links folgt dem Lebenszyklus eines Ereignisses, von oben nach unten:
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Aufbau des Menüs</caption>
      <thead><tr><th>Bereich</th><th>Was dort liegt</th></tr></thead>
      <tbody>
        <tr><th scope="row">Im Ereignis</th><td>Dashboard, Alarm auslösen, Alarmzentrale &ndash; was in Sekunden erreichbar sein muss</td></tr>
        <tr><th scope="row">Laufender Betrieb</th><td>Alleinarbeit, Alarmknöpfe, Ereignisprotokoll &ndash; der Alltag zwischen den Ereignissen</td></tr>
        <tr><th scope="row">Vorbereitung</th><td>Szenarien, Alarmpläne, Notfallkontakte &ndash; die Inhalte, die im Ernstfall greifen</td></tr>
        <tr><th scope="row">Organisation</th><td>Benutzende, Gruppen &amp; Krisenteams, Standorte &ndash; wer dazugehört und wo</td></tr>
        <tr><th scope="row">System &amp; Hilfe</th><td>Einstellungen &amp; Konfiguration, App-Vorschau und die Handbücher &ndash; immer in der Fassung, die zur laufenden Version gehört</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Doppelrollen prüfen</p>
    <p>
      Wer in zwei alarmierten Gruppen ist, bekommt in einem Szenario zwei Aufgabenlisten
      &ndash; beim Brand etwa «Sammelplatz sichern» als Evakuationshilfe und
      «Führungsraum beziehen» als Krisenstab. Das sind zwei Orte zur selben Zeit.
    </p>
    <p>
      Das Portal weist beim Bearbeiten einer Person darauf hin, in welchen Szenarien ihre
      Gruppen zu widersprüchlichen Aufgaben führen. Es ist eine Warnung, keine Sperre:
      In einem kleinen Team ist eine Doppelrolle manchmal unvermeidbar &ndash; dann soll
      sie bewusst vergeben werden. Die App zeigt den Betroffenen ihre Aufgaben getrennt
      nach Rolle, damit sie die Lage erkennen und entscheiden können.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Was der Krisenstab sieht</p>
    <p>
      Das Portal steht der Administration und dem Krisenstab offen, aber nicht mit
      demselben Umfang. Dem Krisenstab fehlen <span class="ui">Benutzende</span>,
      <span class="ui">Gruppen &amp; Krisenteams</span>, <span class="ui">Standorte</span>,
      <span class="ui">Einstellungen &amp; Konfiguration</span> und die
      <span class="ui">App-Vorschau</span> &ndash; also alles, was die
      Grundordnung des Systems betrifft. Alarmieren, führen, nachbereiten und die
      Vorbereitung pflegen kann er vollständig.
    </p>
    <p>
      Die Administration findet unten in der Menüleiste einen Umschalter
      <span class="ui">Administration / Krisenstab</span>. Damit sieht sie das Portal so,
      wie es der Krisenstab sieht &ndash; nützlich vor einer Schulung. <b>Es ist eine
      Ansicht, keine Rechtebeschränkung:</b> Wer sie umlegt, bleibt auf dem Server
      Administration. Die Wahl gilt bis zum Abmelden.
    </p>
  </div>
  <figure class="bild-breit">
    <img src="bilder/web-02-dashboard.webp" alt="Dashboard mit vier Kennzahlen, Alarmserver-Status und den letzten Ereignissen">
    <figcaption><b>Abb.</b> &nbsp; Das Dashboard. Vier Kennzahlen oben, links der Zustand der Kanäle, rechts die jüngsten Ereignisse. Was nur vorbereitet ist, steht grau als «vorbereitet, noch nicht aktiv».</figcaption>
  </figure>
  <p>
    Die Zeilen im <b>Alarmserver-Status</b> sind anklickbar: Ein Klick auf
    <span class="ui">SMS-Gateway</span>, <span class="ui">Microsoft Teams</span>,
    <span class="ui">LoRaWAN-Netz</span> und die übrigen Zeilen führt direkt zu der
    Einstellung, die diesen Zustand bestimmt &ndash; die betreffende Karte wird kurz
    hervorgehoben. So muss niemand auf der langen Integrationsseite suchen.
  </p>
  <h3>SMS und Sprachanruf über Twilio einrichten</h3>
  <p>
    Push ist der erste Zustellweg; er hängt an Expo, Apple und Google und am
    Datenempfang des Telefons. Ein zweiter Weg über das Mobilfunknetz ist für ein
    Alarmsystem keine Verbesserung, sondern die Voraussetzung. Twilio liefert
    beides: SMS und &ndash; mit einer eigenen Nummer &ndash; Sprachanrufe, die den
    Alarmtext vorlesen.
  </p>
  <ol class="schritte">
    <li>In der Twilio-Konsole unter <b>Phone Numbers</b> eine Nummer kaufen, die
        SMS <em>und</em> Voice kann (eine Schweizer oder eine beliebige
        Mobilfunknummer). Ohne eigene Nummer gehen nur SMS mit Kurzname.</li>
    <li>Unter <b>Messaging › Geo permissions</b> und <b>Voice › Geo permissions</b>
        die Schweiz freischalten &ndash; sonst lehnt Twilio jeden Versand dorthin ab.</li>
    <li>Von der Startseite der Konsole <b>Account SID</b> und <b>Auth Token</b> kopieren.</li>
    <li>Im Portal unter <span class="ui">Einstellungen &amp; Konfiguration &rsaquo; SMS-Gateway</span>:
        Anbieter <b>Twilio</b>, Absender die gekaufte Nummer im Format <code>+41…</code>,
        Account SID und Auth Token eintragen, Versand einschalten, speichern.</li>
    <li><span class="ui">Test-SMS an mich</span> antippen. Kommt sie an, ist der Weg offen.</li>
    <li>In den Alarmplänen prüfen, dass <b>SMS</b> und <b>Sprachanruf</b> als Kanäle
        gesetzt sind &ndash; bei den vorbereiteten Plänen sind sie es bereits.</li>
  </ol>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Testkonto</p>
    <p>
      Ein Twilio-Testkonto sendet nur an Nummern, die Sie vorher in der Konsole
      verifiziert haben, und stellt jeder SMS einen Hinweis voran. Für den
      Ernstbetrieb muss das Konto aufgewertet (mit Guthaben versehen) sein &ndash;
      sonst erreicht ein echter Alarm niemanden ausser den verifizierten Nummern.
      Telefonnummern der Mitarbeitenden dürfen im Bestand schweizerisch stehen
      («079 123 45 67»); der Server schreibt sie für Twilio um.
    </p>
  </div>
  <p>
    Darunter die Kachel <b>Bereitschaft</b> &ndash; die Antwort auf die Frage, ob ein
    Alarm die Leute überhaupt erreicht: pro Standort, wie viele Personen ein Gerät mit
    der App registriert haben und wie viele Critical Alerts erlauben; ob der Push-Dienst
    erreichbar ist; wann die letzte Sicherung lief; wann die wöchentliche Testmeldung
    ging. Mit <span class="ui">Testmeldung an mein Telefon</span>
    prüfen Sie die Kette bis aufs eigene Gerät.
  </p>
  <p>
    Die wöchentliche Prüfung erreicht seit September 2026 <b>alle</b> Geräte:
    Die Administration sieht ihre Testmeldung, alle anderen bekommen eine
    unsichtbare &ndash; ohne Titel, ohne Ton. Ihr Zweck ist die Quittung des
    Push-Dienstes: Meldet er, dass die App gelöscht wurde, fällt das Gerät aus
    der Erreichbarkeit, statt erst im Ernstfall aufzufallen. Unter
    <span class="ui">Benutzende</span> steht bei jeder Person, wann ein Gerät
    zuletzt eine Zustellung <em>bestätigt</em> hat &ndash; ein angemeldetes Gerät
    allein beweist noch nichts.
  </p>
  <p>
    Zwei weitere Zeilen der Kachel: <b>Sicherung extern</b> zeigt, ob eine Kopie
    der Sicherung an einem anderen Ort liegt (Handbuch 4, Abschnitt 11) &ndash;
    eine Sicherung auf demselben Rechner ist keine. Und der <b>monatliche
    Bereitschaftsbericht</b> nennt seit September 2026 die letzte Übung und mahnt,
    wenn sie länger als ein Quartal zurückliegt: Ein Probealarm mit
    Übungskennzeichen ist der einzige Test der ganzen Kette bis zum Menschen.
  </p>
  <p>
    Ganz unten in der Seitenleiste steht, als wer Sie angemeldet sind, und ob das
    Portal mit dem Alarmserver verbunden ist.
  </p>
  <h3>App-Vorschau</h3>
  <p>
    <span class="ui">App-Vorschau</span> öffnet die App im Browser. Oben steht eine gelbe
    Leiste <span class="ui">Vorschau als</span>: Dort wählen Sie jede erfasste Person und
    sehen die App so, wie sie diese Person sieht &ndash; ihre Alarme, ihre Schritte je
    Gruppe, ihren Standort. Das eignet sich zum Prüfen, ob Gruppen und Schritte richtig
    zugeordnet sind. Im Live-Betrieb ist die Vorschau reine Ansicht: Quittieren,
    Auslösen und Timer sind gesperrt, weil sie sonst unter Ihrem eigenen Konto liefen.
  </p>
</section>

<section id="a3">
  <h2 class="abschnitt"><span class="zahl">3</span> Alarm auslösen</h2>
  <p>
    Unter <span class="ui">Alarm auslösen</span> wählen Sie ein Szenario oder einen
    fertigen Alarmplan. Das System füllt daraufhin Empfängergruppen, Kanäle und
    Eskalationsstufen vor.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-15-alarm-vorbereitet.webp" alt="Vorbereiteter Alarm mit gewähltem Szenario, Empfänger:innen und Kanälen">
    <figcaption><b>Abb.</b> &nbsp; Ein vorbereiteter Alarm. Unter <span class="ui">Anpassen</span> lassen sich Standort, Kanäle, stille Auslösung und die Quittierpflicht für diesen einen Fall ändern.</figcaption>
  </figure>
  <ol class="schritte">
    <li>Szenario oder Alarmplan anklicken.</li>
    <li>Prüfen, wer als Empfänger:in angezeigt wird &ndash; die Zahl steht direkt über dem Auslöseknopf.</li>
    <li>Bei Bedarf <span class="ui">Anpassen</span> öffnen: Standort eingrenzen, Kanäle ändern, stille Auslösung oder Quittierpflicht setzen.</li>
    <li><span class="ui">Alarm auslösen</span> gedrückt <em>halten</em>, bis der Balken durchgelaufen ist.</li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Warum gedrückt halten</p>
    <p>
      Alle auslösenden Knöpfe reagieren erst nach gut einer Sekunde Halten. Ein
      versehentlicher Klick löst deshalb keinen Alarm aus.
    </p>
  </div>
  <h3>Stiller Alarm</h3>
  <p>
    Ein stiller Alarm erreicht die Empfänger:innen als Mitteilung ohne Ton und ohne
    Vibration &ndash; sie erscheint auf dem Sperrbildschirm und in der App violett
    gekennzeichnet, aber kein Telefon klingelt. Er ist für Lagen gedacht, in denen
    Aufsehen schadet: herausforderndes Verhalten, eine verdächtige Person auf dem
    Areal, ein Todesfall, Amok / Bedrohungslage. Der normale Alarm dagegen klingelt
    auch bei stummgeschaltetem Telefon und durchbricht Fokus-Modi. Szenarien mit der
    stillen Voreinstellung sind im Portal mit <span class="ui">stiller Alarm</span>
    gekennzeichnet.
  </p>
  <h3>Wenn zwei Personen dasselbe auslösen</h3>
  <p>
    Es bleibt bei einem Alarm. Läuft für ein Szenario am gewählten Standort bereits ein
    Alarm, führt der Server eine zweite Auslösung innerhalb von zwei Stunden mit ihm
    zusammen: Die neue Meldung erscheint als «weitere Meldung» im Journal und bei allen
    Empfänger:innen, neu gewählte Standorte werden zusätzlich alarmiert, Quittierung und
    Entwarnung gibt es nur einmal. Die App zeigt der zweiten Person vorher einen Hinweis
    mit Name und Zeit; ihr Auslöseknopf heisst dann <span class="ui">Meldung zum
    laufenden Alarm ergänzen</span>. Übungen und Ernstfälle werden nie zusammengeführt.
  </p>
  <h3>Übung</h3>
  <p>
    Unter <span class="ui">Anpassen</span> steht der Schalter <b>Übung</b>. Der Ablauf
    bleibt derselbe: Zustellung, Quittierung, Eskalation, Entwarnung. Aber jede
    Mitteilung trägt den Vorspann «ÜBUNG», die App kennzeichnet den Alarm gelb, das
    Protokoll führt Übungen getrennt (Filter <span class="ui">Übungen</span>), und
    Webhooks an Drittsysteme wie eine Brandmeldeanlage bleiben stumm. Damit lässt sich
    die vorgeschriebene jährliche Räumungsübung mit dem echten System durchführen.
  </p>
  <h3>Der Knopf in der App</h3>
  <p>
    In der App steht <span class="ui">Alarm auslösen</span> oben rechts auf jeder Seite.
    Er führt zur Wahl des Ereignisses und direkt in die Phase «Alarmieren» des
    Szenarios. Push-Mitteilungen sind verknüpft: Antippen öffnet die
    Handlungsanweisung zum Alarm, nach dem Beenden die Schritte nach der Entwarnung.
  </p>
</section>

<section id="a4">
  <h2 class="abschnitt"><span class="zahl">4</span> Die Alarmzentrale</h2>
  <p>
    Sobald ein Alarm läuft, erscheint oben ein roter Balken und in der Seitenleiste
    eine Zahl. Die Alarmzentrale zeigt für jeden laufenden Alarm, wen er erreicht hat,
    wer geantwortet hat und was wann geschehen ist.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-17-alarmzentrale-aktiv.webp" alt="Alarmzentrale mit einem aktiven Alarm, Empfängerliste mit Zustellstatus und Alarmjournal">
    <figcaption><b>Abb.</b> &nbsp; Links jede Empfängerin und jeder Empfänger mit dem Status pro Kanal, rechts das Journal mit Zeitstempeln. Der Knopf <span class="ui">Beenden</span> gibt Entwarnung an alle.</figcaption>
  </figure>
  <h3>Lagemeldung und Entwarnung</h3>
  <p>
    Unter jedem aktiven Alarm steht ein Eingabefeld für Lagemeldungen. Was Sie dort
    senden, erreicht alle Empfänger:innen als Mitteilung und steht in ihrer
    Handlungsanweisung zuoberst. <span class="ui">Beenden</span> fragt nach einem
    Hinweis, der mit der Entwarnung mitgeht &ndash; etwa «Rückkehr ab 10:30 über den
    Haupteingang». Beides steht danach im Journal.
  </p>
  <p>
    «Zugestellt» bedeutet: Das Gerät hat den Empfang bestätigt. Der Server holt dazu die
    Quittungen beim Push-Dienst ab. «Gesendet» heisst, der Push-Dienst hat die Meldung
    angenommen; «fehlgeschlagen» steht bei Personen ohne registriertes Gerät oder wenn
    die App deinstalliert wurde. Meldet die auslösende Person einen Fehlalarm, erscheint
    die Kennzeichnung <span class="ui">Fehlalarm gemeldet</span>.
  </p>
  <div class="hinweis hinweis--gut">
    <p class="marke-klein">Für die Nachbearbeitung</p>
    <p>
      Das Journal ist Ihr Nachweis gegenüber Aufsicht, Versicherern und
      Strafverfolgungsbehörden. Beenden Sie einen Alarm erst, wenn die Lage
      tatsächlich abgeschlossen ist &ndash; der Zeitpunkt wird festgehalten.
    </p>
  </div>
</section>

<section id="a5">
  <h2 class="abschnitt"><span class="zahl">5</span> Szenarien und Checklisten</h2>
  <p>
    Szenarien sind das Herz des Systems. Jedes enthält, was im Ernstfall auf dem
    Telefon erscheint: Hinweise zum Notruf, die Sofortmassnahmen, die Massnahmen nach
    der Akutphase, eine Checkliste und die Rechtsgrundlagen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-07-szenarien.webp" alt="Übersicht der Szenarien als Karten mit Kategorie, Priorität und Anzahl der Massnahmen">
    <figcaption><b>Abb.</b> &nbsp; Die Szenarienübersicht. Elf Szenarien sind für Mitarbeitende freigegeben &ndash; darunter Amok / Bedrohungslage mit stiller Voreinstellung und Vermisste:r Schüler:in, auf das der Alarmplan «Suchaktion» verweist &ndash;, die übrigen sind ausgeblendet und lassen sich mit dem Augensymbol wieder einblenden.</figcaption>
  </figure>
  <p>
    Die Karten stehen <b>alphabetisch</b>, die ausgeblendeten dahinter &ndash; sie
    erscheinen im Ernstfall ohnehin nicht. Wer nur mit den freigegebenen arbeiten
    will, blendet die übrigen mit
    <span class="ui">&lt;Anzahl&gt; ausgeblendete verbergen</span> ganz aus; der Knopf
    schaltet auch wieder zurück. Suchfeld und Kategorienfilter wirken zusätzlich.
  </p>

  <h3>Ein Szenario ansehen</h3>
  <figure class="bild-breit">
    <img src="bilder/web-18-szenario-ansicht.webp" alt="Detailansicht eines Szenarios mit Alarmierungshinweisen, Sofortmassnahmen, Checkliste und Rechtsgrundlagen">
    <figcaption><b>Abb.</b> &nbsp; Genau diese Inhalte bekommen Mitarbeitende auf dem Telefon zu sehen &ndash; in derselben Reihenfolge.</figcaption>
  </figure>

  <h3>Ein neues Szenario erstellen &ndash; der Assistent</h3>
  <p>
    <span class="ui">Neues Szenario</span> öffnet einen Assistenten, der in fünf
    Schritten durch alles führt: <b>Grundlagen</b> (Titel, Kategorie, Priorität,
    Symbol), <b>Alarmierung</b> (Kanäle, zuständige Gruppen, Notrufnummern, stiller
    Alarm), <b>Anweisungen</b> (Alarmieren, Sofortmassnahmen, Empfängerschritte),
    <b>Nachbearbeitung</b> (Entwarnung, weiterführende Massnahmen, Checkliste,
    Rechtsgrundlagen) und die <b>Zusammenfassung</b> zum Prüfen. Die Schrittleiste
    oben zeigt den Stand; bereits besuchte Schritte lassen sich direkt anspringen,
    und «Weiter» bleibt gesperrt, bis die Pflichtangaben des Schritts stehen &ndash;
    ein Titel, mindestens ein Kanal, mindestens eine Sofortmassnahme.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-29-szenario-assistent.webp" alt="Assistent für ein neues Szenario mit Schrittleiste, Kanal-Auswahl und zuständigen Gruppen">
    <figcaption><b>Abb.</b> &nbsp; Schritt 2 des Assistenten: Kanäle, Gruppen und Notrufnummern als antippbare Auswahl.</figcaption>
  </figure>

  <h3>Ein Szenario bearbeiten</h3>
  <p>
    Der Stift auf der Karte öffnet den Bearbeitungsdialog mit allen Feldern auf einen
    Blick &ndash; er bleibt der schnellste Weg für gezielte Änderungen an bestehenden
    Szenarien. Jedes Textfeld nimmt einen Punkt pro Zeile auf; leere Zeilen werden
    beim Speichern verworfen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-19-szenario-editor.webp" alt="Bearbeitungsdialog eines Szenarios mit den Feldern für Alarmieren, Sofortmassnahmen, weiterführende Massnahmen, Checkliste und Rechtsgrundlagen">
    <figcaption><b>Abb.</b> &nbsp; Der Bearbeitungsdialog. Das oberste Textfeld füllt die Phase «Alarmieren».</figcaption>
  </figure>
  <div class="tabelle-huelle">
    <table>
      <caption>Wohin welcher Text gehört</caption>
      <thead><tr><th>Feld</th><th>Erscheint in der App</th><th>Gehört hinein</th></tr></thead>
      <tbody>
        <tr><td><b>Alarmieren</b></td><td>Phase 1</td><td>Wann ein Notruf nötig ist und was am Telefon zu melden ist</td></tr>
        <tr><td><b>Sofortmassnahmen</b></td><td>Phase 2</td><td>Nur Handgriffe &ndash; keine Anweisungen zum Anrufen</td></tr>
        <tr><td><b>Empfänger:innen</b></td><td>eigener Weg «Ich wurde alarmiert»</td><td>Was jemand tut, der den Alarm erhält: kein Notruf, keine Auslösung, sondern die eigene Aufgabe &ndash; je Schritt wählbar, für welche Gruppen er gilt</td></tr>
        <tr><td><b>Nach der Entwarnung</b></td><td>mit der Entwarnungs-Mitteilung</td><td>Was die Alarmierten tun, sobald der Alarm beendet ist: Rückkehr nach Freigabe, erneut zählen, festhalten, Nachsorge</td></tr>
        <tr><td><b>Weiterführende Massnahmen</b></td><td>Phase 4</td><td>Alles nach der Akutphase: informieren, dokumentieren, nachsorgen</td></tr>
        <tr><td><b>Checkliste</b></td><td>Phase 4</td><td>Punkte zum Abhaken für die Nachkontrolle</td></tr>
        <tr><td><b>Rechtsgrundlagen</b></td><td>Phase 4, aufklappbar</td><td>Orientierungshilfe, keine Rechtsberatung</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Achten Sie darauf</p>
    <p>
      Schreiben Sie das Alarmieren nicht zusätzlich in die Sofortmassnahmen. Der
      geführte Ablauf beginnt bereits mit dieser Phase; eine Wiederholung im zweiten
      Schritt widerspricht der Reihenfolge und kostet im Ernstfall Zeit.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Zwei Leser, zwei Abläufe</p>
    <p>
      Ein Szenario hat zwei Leser: die Person, die das Ereignis entdeckt, und alle,
      die den Alarm erhalten. Die erste ruft an und löst aus; die zweiten tun genau das
      nicht. Das Feld <b>Empfänger:innen</b> gehört darum zu jedem Szenario, das alarmiert
      wird &ndash; es beschreibt die eigene Aufgabe: Klasse sammeln, Führungsraum
      beziehen, Bereich sichern. Wer den Alarm in der App erhält, sieht automatisch
      diesen Weg, nicht den geführten Ablauf.
    </p>
    <p>
      Und weil eine Person mehrere Rollen hat &ndash; Lehrperson <em>und</em>
      Ersthelferin &ndash;, lässt sich jeder Schritt einer oder mehreren Gruppen
      zuordnen. Ohne Gruppe gilt er für alle. Die App zeigt einer Person nur die
      Schritte ihrer Gruppen; die übrigen bleiben auf Wunsch einsehbar. Achten Sie
      darauf, dass jedes Szenario mindestens einen Schritt für alle hat &ndash; sonst
      stünde jemand ohne besondere Gruppe vor einer leeren Seite.
    </p>
  </div>
  <h3>Ein Szenario ein- oder ausblenden</h3>
  <p>
    Das Augensymbol auf der Karte entscheidet, ob ein Szenario für Mitarbeitende in
    der App erscheint. Ausgeblendete Szenarien bleiben vollständig erhalten &ndash;
    sie sind nur nicht sichtbar. So halten Sie die Liste auf dem Telefon kurz, ohne
    vorbereitete Inhalte zu verlieren.
  </p>
</section>

<section id="a6">
  <h2 class="abschnitt"><span class="zahl">6</span> Alarmpläne und Notfallkontakte</h2>
  <p>
    Ein Alarmplan ist ein fertig geschnürtes Paket: Szenario, Zielgruppen, Standorte,
    Kanäle und die Eskalationsstufen mit ihren Zeiten. Im Ereignisfall genügt ein
    Klick, statt alles einzeln zu wählen.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Vorbereitet, noch nicht aktiv</p>
    <p>
      Von den Kanälen ist heute nur die <b>Push-Mitteilung</b> angebunden. SMS,
      Sprachanruf, Telefonkonferenz, Durchsage und Teams lassen sich in Plänen und
      Szenarien bereits wählen, damit die Planung vollständig ist &ndash; versendet wird
      darüber nichts, und in der Alarmzentrale steht bei diesen Kanälen «kein Versand».
      Dasselbe gilt für «Blaulichtorganisationen benachrichtigen» in den
      Eskalationsstufen. Überall im Portal ist das einheitlich mit
      <em>vorbereitet, noch nicht aktiv</em> gekennzeichnet.
    </p>
    <p>
      Den früheren Schalter «Nur während Betriebszeiten» gibt es nicht mehr. Er
      wurde nie ausgewertet &ndash; und hätte er es je, wäre das falsch gewesen:
      Ein Notfall nach Uhrzeit zu unterdrücken ist nie richtig. Ein
      Herzstillstand um 17.30 Uhr braucht dieselbe Alarmierung wie um 9 Uhr.
    </p>
  </div>
  <figure class="bild-breit">
    <img src="bilder/web-08-alarmplaene.webp" alt="Übersicht der Alarmpläne mit Zielgruppen, Kanälen und Eskalationsstufen">
    <figcaption><b>Abb.</b> &nbsp; Sechs vorbereitete Alarmpläne mit ihren Eskalationsstufen.</figcaption>
  </figure>

  <h3>Der Plan gilt von selbst</h3>
  <p>
    Wer ein Szenario auslöst &ndash; im Portal oder in der App &ndash;, bekommt
    dessen Alarmplan automatisch: Der Alarmserver sucht den Plan zum Szenario
    und zum Standort und wendet seine Eskalationsstufen an. Gibt es Pläne für
    mehrere Standorte, gewinnt der passende; ein Plan ohne Standortbindung gilt
    überall. Im Portal lässt sich der Plan vor dem Auslösen noch umstellen.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Geändert im September 2026</p>
    <p>
      Bis dahin galt der Plan im Portal nur, wenn man ihn aus einem Dropdown
      «optional» wählte &ndash; und in der App gar nie: Dort schickte jedes
      Szenario dieselbe fest verdrahtete Eskalation. Der Brandalarm mit
      Evakuationsteam nach drei Minuten griff aus der App also nicht. Wer
      sich darauf verlassen hat, dass Pläne wirken, hatte recht &ndash; jetzt
      stimmt es auch.
    </p>
  </div>
  <p>
    Ebenfalls neu: <b>Der Krisenstab ist nicht an einen Standort gebunden.</b>
    Gruppen, die als Krisenteam gekennzeichnet sind, werden bei jedem Alarm
    erreicht, gleich an welchem Standort er ausgelöst wurde. Vorher galt der
    Standortfilter auch für sie &ndash; bei einem Brand in Menzingen erfuhr ein
    Krisenstab mit Profilstandort Baar nichts.
  </p>

  <h3>Zwei Arten von Eskalationsstufen</h3>
  <p>
    Jede Stufe hat eine Frist und eine Art. Die Art entscheidet, ob eine Zusage
    die Stufe abwendet &ndash; und das ist folgenreich genug, um es bewusst zu
    setzen:
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Art der Stufe</caption>
      <thead><tr><th>Art</th><th>Zündet</th><th>Wofür gedacht</th></tr></thead>
      <tbody>
        <tr>
          <td><b>Planmässig</b></td>
          <td>nach der Frist, unabhängig von Zusagen</td>
          <td>Lagen, in denen diese Gruppe ohnehin gebraucht wird: Evakuationsteam
              bei Brand, Krisenstab bei einer Vermisstensuche. Gerade wenn vor Ort
              schon jemand handelt, sollen sie kommen.</td>
        </tr>
        <tr>
          <td><b>Nur ohne Zusage</b></td>
          <td>nur, wenn bis dahin niemand zugesagt hat</td>
          <td>Lagen, die mit einer Zusage erledigt sind: Meldet sich die Schulsanität,
              muss der Sicherheitsdienst nicht auch ausrücken.</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Geändert im September 2026</p>
    <p>
      Bis dahin genügte <b>eine einzige</b> Zusage, um jede weitere Stufe
      abzuschalten &ndash; unabhängig von der Art. Bei einem Brandalarm an alle
      Mitarbeitenden tippt innerhalb von drei Minuten praktisch sicher irgendwer
      <i>«ich komme»</i>; Evakuationsteam und Krisenstab wurden daraufhin nie
      aufgeboten. Wer eigene Alarmpläne angelegt hat, prüft bitte deren Stufen:
      bestehende Stufen gelten seither als <b>planmässig</b>, zünden also
      häufiger als zuvor.
    </p>
  </div>
  <p>
    Wer bereits zugesagt hat, wird von einer zündenden Stufe nicht erneut
    angeklingelt &ndash; diese Person ist ja unterwegs. Haben alle einer
    Stufengruppe schon zugesagt, entfällt die Stufe und das Journal hält fest,
    warum.
  </p>
  <h3>Einen neuen Alarmplan erstellen &ndash; der Assistent</h3>
  <p>
    <span class="ui">Neuer Alarmplan</span> öffnet einen Assistenten mit fünf
    Schritten: <b>Grundlagen</b> (Name und Szenario &ndash; als Kartenauswahl mit
    Symbol), <b>Empfänger:innen</b> (Zielgruppen und Standorte, leer bedeutet alle),
    <b>Kanäle &amp; Optionen</b> (Erstaussand, Quittierfunktion, Betriebszeiten),
    <b>Eskalation</b> (Stufen mit Frist, Art, zusätzlichen Gruppen und Kanälen) und die
    <b>Zusammenfassung</b>. Wählen Sie ein Szenario, übernimmt der Assistent dessen
    Standard-Kanäle und zuständige Gruppen als Vorbelegung &ndash; in den folgenden
    Schritten bleibt beides anpassbar. Für Änderungen an bestehenden Plänen öffnet
    der Stift weiterhin den gewohnten Bearbeitungsdialog.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-30-alarmplan-assistent.webp" alt="Assistent für einen neuen Alarmplan mit Szenario-Auswahl als Karten und Hinweis auf übernommene Kanäle und Gruppen">
    <figcaption><b>Abb.</b> &nbsp; Schritt 1 des Assistenten: Das gewählte Szenario «Brand / Feuer» belegt Kanäle und Zielgruppen vor.</figcaption>
  </figure>
  <div class="hinweis">
    <p class="marke-klein">Prüfen Sie das einmal</p>
    <p>
      Blenden Sie ein Szenario aus, bleiben Alarmpläne bestehen, die darauf verweisen.
      Sie funktionieren weiter, führen aber zu einem Szenario, das niemand mehr in der
      App findet. Gehen Sie die Alarmpläne nach jeder Umstellung einmal durch.
    </p>
  </div>
  <h3>Notfallkontakte</h3>
  <p>
    Hier stehen die Nummern, die in der App unter <span class="ui">Notruf</span> und
    in der Phase «Alarmieren» als Anrufknöpfe erscheinen. Welche Nummern bei einem
    Szenario auftauchen, bestimmt das Szenario selbst.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-12-notfallkontakte.webp" alt="Liste der hinterlegten Notrufnummern">
    <figcaption><b>Abb.</b> &nbsp; Die hinterlegten Nummern. Antippen ruft in der App direkt an.</figcaption>
  </figure>
</section>

<section id="a7">
  <h2 class="abschnitt"><span class="zahl">7</span> Alleinarbeit und Alarmknöpfe</h2>
  <p>
    Wer allein arbeitet, startet in der App einen Timer. Meldet sich die Person nicht
    vor Ablauf zurück, löst das System selbständig einen Alarm aus. Im Portal sehen
    Sie alle laufenden Timer.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-05-alleinarbeit.webp" alt="Portalseite Alleinarbeit mit laufenden Timern">
    <figcaption><b>Abb.</b> &nbsp; Alleinarbeit im Portal. Von hier lässt sich auch für eine andere Person ein Timer starten.</figcaption>
  </figure>
  <p>
    Beim Start wird festgelegt, wer bei Ablauf alarmiert wird: Gruppen am Standort
    (vorgewählt Schulsanität und Hausdienst) und wahlweise einzelne Personen unabhängig
    von Gruppe und Standort. Das Suchfeld über der Personenliste findet Leute nach
    Name, E-Mail-Adresse und Standort; bereits angekreuzte Personen bleiben dabei
    sichtbar, damit die Auswahl beim Tippen nicht aus dem Blick gerät.
    Läuft ein Timer ab, darf die betroffene Person den Alarm
    selbst mit <span class="ui">Mir geht es gut</span> beenden; die Entwarnung geht dann
    an alle Alarmierten.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-06-alarmknoepfe.webp" alt="Übersicht der Alarmknöpfe mit Batteriestand und Funkverbindung">
    <figcaption><b>Abb.</b> &nbsp; Die fest installierten und tragbaren Alarmknöpfe mit Batteriestand und Funkverbindung. Ein Knopf mit schwacher Batterie ist hier zu erkennen, bevor er ausfällt.</figcaption>
  </figure>
  <p>
    Sobald ein LoRaWAN- oder GSM-Netz angebunden ist, löst ein Knopfdruck einen
    Alarm mit Quittierpflicht aus &ndash; laut oder still, je nach dem Schalter
    <span class="ui">Still alarmieren</span> beim Knopf. Die Anbindung beschreibt
    Handbuch&nbsp;4, Abschnitt «Alarmknöpfe anbinden».
  </p>
  <p>
    <b>Geräte erfassen können Sie jederzeit</b> &ndash; auch bevor das Funknetz steht.
    Ist der Uplink-Endpunkt noch ausgeschaltet, weist ein gelber Hinweis oben auf der
    Seite darauf hin; mit <span class="ui">Jetzt aktivieren</span> schalten Sie ihn
    direkt von dort ein, ohne den Umweg über Einstellungen &amp; Konfiguration. Ist er eingeschaltet,
    trägt die Überschrift das grüne Abzeichen <span class="ui">Uplink aktiv</span>.
    Einschalten darf ihn die Administration; erfassen und bearbeiten dürfen Geräte
    auch Mitglieder des Krisenstabs.
  </p>

  <h3>Überwachung: Wenn ein Knopf stumm bleibt</h3>
  <p>
    Ein Alarmknopf, der niemand mehr erreicht, ist gefährlicher als gar keiner
    &ndash; im Ernstfall wird gedrückt, und nichts passiert. Der Alarmserver prüft
    deshalb regelmässig jedes Gerät und meldet der Administration per
    Push-Mitteilung und im Ereignisprotokoll, wenn
  </p>
  <ul>
    <li>ein Knopf länger kein Lebenszeichen mehr gesendet hat (Vorgabe: 36 Stunden) oder</li>
    <li>die Batterie unter einen Schwellenwert fällt (Vorgabe: 20 %).</li>
  </ul>
  <p>
    Beide Werte stellen Sie unter <span class="ui">Einstellungen &amp; Konfiguration &rsaquo; LoRaWAN-Netz /
    Alarmknöpfe</span> ein. Richten Sie die Stundenzahl nach dem Melde-Intervall
    Ihrer Geräte &ndash; die meisten senden alle 12 bis 24 Stunden ein Lebenszeichen.
    Auf der Knopf-Übersicht trägt ein betroffenes Gerät das Abzeichen
    <span class="ui">ohne Signal</span> beziehungsweise einen roten Batteriestand.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Gemeldet wird einmal, nicht dauernd</p>
    <p>
      Jede Störung wird einmal gemeldet, nicht bei jedem Durchlauf erneut. Meldet
      sich der Knopf wieder oder ist die Batterie gewechselt, verfällt die Sperre
      von selbst &ndash; eine erneute Störung wird dann wieder gemeldet. Nach einer
      Wartung müssen Sie also nichts quittieren.
    </p>
  </div>
</section>

<section id="a8">
  <h2 class="abschnitt"><span class="zahl">8</span> Benutzende verwalten</h2>
  <p>
    Diese Seite ist ausschliesslich der Administration vorbehalten. Sie legen Konten
    an, vergeben Rollen und setzen Passwörter zurück.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-09-benutzer.webp" alt="Benutzerverwaltung mit Liste aller Konten, Standort, Erreichbarkeit und Anmeldezustand">
    <figcaption><b>Abb.</b> &nbsp; Die Benutzerliste. Die Spalte <span class="ui">Anmeldung</span> zeigt, ob für ein Konto ein Passwort hinterlegt ist.</figcaption>
  </figure>
  <figure class="bild-breit">
    <img src="bilder/web-20-benutzer-editor.webp" alt="Dialog zum Anlegen eines neuen Benutzers mit Rolle, Standort, Gruppen und Anmeldedaten">
    <figcaption><b>Abb.</b> &nbsp; Ein neues Konto. Ohne Passwort kann sich die Person weder im Portal noch in der App anmelden &ndash; das Feld gehört ausgefüllt.</figcaption>
  </figure>
  <h4>Erreichbarkeit &ndash; kommt ein Alarm überhaupt an?</h4>
  <p>
    Die Spalte beantwortet genau eine Frage: Erreicht ein Alarm diese Person?
    Ein Konto allein genügt dafür nicht &ndash; es braucht ein Gerät, auf dem die
    App angemeldet ist.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Was in der Spalte steht</caption>
      <thead><tr><th>Anzeige</th><th>Bedeutung</th></tr></thead>
      <tbody>
        <tr><th scope="row">erreichbar</th><td>Mindestens ein Gerät ist angemeldet und darf Critical Alerts &ndash; der Alarm klingelt auch bei stummem Telefon</td></tr>
        <tr><th scope="row">erreichbar &middot; stumm möglich</th><td>Ein Gerät ist angemeldet, hat aber keine Critical Alerts erlaubt. Bei stummem Telefon bleibt der Alarm lautlos</td></tr>
        <tr><th scope="row">kein Gerät</th><td>Die App ist auf keinem Gerät angemeldet. <b>Ein Alarm erreicht diese Person nicht</b> &ndash; weder per Push noch in der App</td></tr>
        <tr><th scope="row">abwesend bis &hellip;</th><td>Eine Abwesenheit ist eingetragen; die Person wird von der Alarmierung ausgenommen</td></tr>
      </tbody>
    </table>
  </div>
  <p>
    Gibt es Konten ohne Gerät, steht über der Liste ein Hinweis mit den Namen.
    Er zählt alle Konten, nicht nur die gefilterten: Ein ungenutztes Konto fällt
    sonst nie auf, weil niemand danach sucht. Die Zahl je Standort steht
    ausserdem auf dem Dashboard in der Kachel <span class="ui">Bereitschaft</span>.
  </p>

  <h4>Rolle</h4>
  <p>
    <b>Mitarbeitende</b> nutzen ausschliesslich die App. Der <b>Krisenstab</b> nutzt App und
    Portal und darf alarmieren, beenden und die Vorbereitung pflegen. Die
    <b>Administration</b> darf zusätzlich Konten, Gruppen, Standorte und
    Systemeinstellungen ändern.
  </p>
  <h4>Gruppen</h4>
  <p>
    Die Gruppenzugehörigkeit entscheidet, wen ein Alarm erreicht. Wer in keiner
    passenden Gruppe steht, wird bei diesem Szenario nicht benachrichtigt &ndash;
    auch wenn das Konto sonst vollständig ist.
  </p>
  <h4>Passwort</h4>
  <p>
    Beim Anlegen vergeben Sie ein Startpasswort und lassen das Häkchen bei
    <span class="ui">Passwortänderung bei der nächsten Anmeldung erzwingen</span> gesetzt.
    Später setzen Sie über denselben Dialog ein neues Passwort, falls jemand ausgesperrt ist.
  </p>
  <div class="hinweis hinweis--stopp">
    <p class="marke-klein">Sicherung gegen Aussperrung</p>
    <p>
      Das letzte Administratorkonto lässt sich weder löschen noch herabstufen. Das
      System verweigert das, damit die Anlage verwaltbar bleibt. Legen Sie ein zweites
      Administratorkonto an, bevor Sie am ersten etwas ändern.
    </p>
  </div>
</section>

<section id="a9">
  <h2 class="abschnitt"><span class="zahl">9</span> Gruppen und Standorte</h2>
  <p>
    Gruppen bündeln Personen nach Funktion &ndash; Krisenstab, Schulsanität,
    Evakuationshelfende, Deeskalationsteam, IT, Hausdienst. Szenarien und Alarmpläne
    sprechen immer Gruppen an, nie einzelne Personen. Das hält die Alarmierung stabil,
    wenn jemand die Stelle wechselt.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-10-gruppen.webp" alt="Übersicht der Gruppen und Krisenteams mit Mitgliederzahl">
    <figcaption><b>Abb.</b> &nbsp; Die Gruppen. Wer hier fehlt, wird im Ernstfall nicht gerufen.</figcaption>
  </figure>
  <figure class="bild-breit">
    <img src="bilder/web-11-standorte.webp" alt="Übersicht der drei Standorte mit Adresse und Sammelplatz">
    <figcaption><b>Abb.</b> &nbsp; Die drei Standorte. Alarme lassen sich auf einen Standort eingrenzen, damit nicht alle drei Häuser aufgeschreckt werden.</figcaption>
  </figure>

  <h3>Geofence auf der Karte festlegen</h3>
  <p>
    Ein Standort kann einen <b>Geofence</b> bekommen: einen Umriss, dessen Betreten
    und Verlassen die App meldet &ndash; nur den Standort-Namen, nie eine
    GPS-Position. Wer sich gerade dort aufhält, wird bei einem Alarm für diesen
    Standort zusätzlich alarmiert.
  </p>
  <ol class="schritte">
    <li>Adresse eintragen und auf <span class="ui">Suchen</span> tippen. Bei
      mehrdeutigen Adressen erscheint eine Auswahl. Um die gefundene Adresse legt das
      Portal ein Viereck, das sich an den Ecken zurechtziehen lässt. Wird der Geofence
      bei einem neuen Standort eingeschaltet, sucht es die Adresse von sich aus.</li>
    <li>Umriss zeichnen: In die Karte tippen setzt einen Eckpunkt, Ziehen verschiebt
      ihn, Doppeltippen entfernt ihn. Drei bis zehn Punkte sind möglich. Ein
      bestehender Umriss wird nie von selbst verändert.</li>
    <li>Prüfen, ob die Fläche stimmt &ndash; das Portal nennt sie in Quadratmetern
      oder Hektaren unter der Karte.</li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Warum ein Umriss und kein Kreis</p>
    <p>
      Ein Kreis um ein Schulhaus schliesst regelmässig die halbe Strasse mit ein oder
      lässt den Hinterhof aus. Beides ist falsch: Im ersten Fall gilt jemand als am
      Standort, der nur vorbeigeht, im zweiten wird jemand nicht mitalarmiert, der
      dort arbeitet.
    </p>
    <p>
      Der gestrichelte Kreis auf der Karte bleibt trotzdem sichtbar: iOS und Android
      können nur kreisförmige Bereiche überwachen. Er weckt die App an der Grenze;
      ob jemand wirklich am Standort ist, entscheidet danach der Umriss auf dem Gerät.
      Deshalb ist er etwas grösser als der Umriss gezeichnet.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Profilstandort und Aufenthalt</p>
    <p>
      Im Benutzerprofil steht, an welchem Standort jemand angestellt ist. Der
      <b>Aufenthalt</b> ist etwas anderes: Er kommt vom Geofence und sagt, wo die
      Person gerade ist. Solange der Geofence etwas meldet, gilt der Aufenthalt
      &ndash; die App zeigt ihn oben und im Profil (dort mit dem Vermerk
      <span class="ui">vor Ort</span> und dem abweichenden Profilstandort darunter),
      und ein SOS oder eine Alleinarbeit gilt für diesen Standort.
    </p>
    <p>
      Ohne Meldung &ndash; Geofencing ausgeschaltet, Ortungsfreigabe verweigert, kein
      Umriss beim Standort hinterlegt oder die Person an keinem erfassten Standort
      &ndash; bleibt es beim Profilstandort. Zeigt die App dauerhaft den falschen
      Standort, ist das die Ursache: Dann stimmt entweder der Standort im Profil
      nicht, oder der Geofence meldet nichts.
    </p>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Wenn die Karte grau bleibt</p>
    <p>
      Kartenbilder und Adresssuche kommen von OpenStreetMap und werden vom
      <b>Browser</b> geladen, nicht vom Alarmserver. In einem Netz ohne Internetzugang
      bleibt die Karte leer; über <span class="ui">Eckpunkte als Zahlen bearbeiten</span>
      lassen sich Breiten- und Längengrad jedes Punktes dann von Hand eintippen. Gesucht wird nur
      die eingegebene Adresse &ndash; nie Personendaten und nie im Hintergrund.
    </p>
  </div>
</section>

<section id="a10">
  <h2 class="abschnitt"><span class="zahl">10</span> Einstellungen &amp; Konfiguration</h2>
  <figure class="bild-breit">
    <img src="bilder/web-13-integrationen.webp" alt="Seite Einstellungen &amp; Konfiguration mit Kommunikationskanälen, Identitätsanbindung, Webhooks und Zugangscodes">
    <figcaption><b>Abb.</b> &nbsp; Kommunikationskanäle, Anbindung an Drittsysteme und die Zugangscodes für die App-Installation.</figcaption>
  </figure>
  <h3>Interne Notfallnummer</h3>
  <p>
    Die Nummer <b>+41 41 767 49 48</b> ist hinterlegt und erscheint auf der Startseite
    der App; Antippen ruft an. Ändert sie sich, tragen Sie die neue hier ein &ndash;
    die App übernimmt sie beim nächsten Abgleich.
  </p>
  <h3>Was hier angebunden ist &ndash; und was nicht</h3>
  <p>
    Aktiv sind die <b>interne Notfallnummer</b> (erscheint in der App, Antippen ruft
    an), die <b>Push-Mitteilungen</b> und die <b>ausgehenden Webhooks</b>, die jede
    Auslösung an Drittsysteme melden. Alles Übrige auf dieser Seite ist mit
    <em>vorbereitet, noch nicht aktiv</em> gekennzeichnet: Die Schalter werden
    gespeichert, damit die Planung vollständig ist, aber noch nicht ausgewertet.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Vorbereitet, noch nicht aktiv</caption>
      <thead><tr><th>Funktion</th><th>Was heute gilt</th></tr></thead>
      <tbody>
        <tr><td>SMS-Gateway, VoIP, Microsoft Teams</td><td>Ohne eingerichtetes Gateway kein Versand über diese Kanäle; Alarme gehen per Push. Mit Twilio oder eCall/ASPSMS werden SMS &ndash; mit Twilio auch Sprachanrufe &ndash; wirksam</td></tr>
        <tr><td>Single Sign-On</td><td>Anmeldung mit E-Mail-Adresse und Passwort</td></tr>
        <tr><td>Synchronisation mit dem Personalsystem</td><td>Konten werden von Hand oder per Import gepflegt</td></tr>
        <tr><td>Mehrsprachige App-Inhalte</td><td>Alle Inhalte sind deutsch; die Sprache im Benutzerprofil ist eine Vormerkung</td></tr>
        <tr><td>Eingehende Webhooks</td><td>Der Server nimmt keine Auslösung von aussen entgegen (z. B. Brandmeldeanlage)</td></tr>
        <tr><td>Zugangscodes</td><td>Die App kennt keine Codes; Mitarbeitende melden sich mit E-Mail und Passwort an</td></tr>
        <tr><td>Physische Alarmknöpfe</td><td>Geräte sind nicht angebunden; die Einträge dienen der Planung</td></tr>
        <tr><td>Blaulichtorganisationen in Eskalationsstufen</td><td>Ohne Wirkung. Es gibt keine Schnittstelle zu einer Einsatzleitzentrale; der Notruf wird von Hand gewählt. Das Alarmjournal weist bei einer solchen Stufe ausdrücklich darauf hin</td></tr>
        <tr><td>Nur während Betriebszeiten</td><td>Ohne Wirkung</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section id="a11">
  <h2 class="abschnitt"><span class="zahl">11</span> Ereignisprotokoll</h2>
  <p>
    Jede Anmeldung, jede Änderung an der Konfiguration und jede Alarmauslösung wird
    mit Zeitstempel und Namen festgehalten. Das Protokoll lässt sich nicht bearbeiten.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-14-protokoll.webp" alt="Ereignisprotokoll mit Einträgen nach Zeit sortiert">
    <figcaption><b>Abb.</b> &nbsp; Das Ereignisprotokoll. Erste Anlaufstelle, wenn zu klären ist, wer wann was ausgelöst hat.</figcaption>
  </figure>

  <div class="hinweis">
    <p class="marke-klein">Ein einzelnes Ereignis herausgeben</p>
    <p>
      Braucht die Schulkommission, der Kanton, eine Versicherung oder ein
      Elternteil den Ablauf <b>eines</b> Ereignisses, ist das Protokoll der
      falsche Ort &ndash; es enthält alles. In der
      <span class="ui">Alarmzentrale</span> legt der Knopf
      <span class="ui">Bericht</span> bei jedem beendeten Alarm den ganzen
      Vorgang als eine Datei ab: Auslösung, Aufgebot, Rückmeldungen,
      Lagemeldungen, Entwarnung. Siehe Handbuch 2, Abschnitt 10.
    </p>
  </div>

  <h3>Suchen und eingrenzen</h3>
  <p>
    Das Suchfeld durchsucht drei Dinge zugleich: den <b>Text</b> des Eintrags, die
    <b>Kategorie</b> (Alarm, Anmeldung, Alleinarbeit, Verwaltung, System) und die
    <b>Person</b>, die gehandelt hat &ndash; Name wie E-Mail-Adresse. Mehrere Wörter
    werden mit UND verknüpft: <span class="ui">müller alarm</span> zeigt die
    Alarmeinträge von Frau oder Herrn Müller.
  </p>
  <p>
    Daneben lässt sich eine einzelne Kategorie wählen, zwischen Ernstfällen und
    Übungen unterscheiden und ein <b>Zeitraum</b> angeben &ndash; entweder über die
    Schaltflächen <span class="ui">Heute</span>, <span class="ui">7&nbsp;Tage</span>
    und <span class="ui">30&nbsp;Tage</span> oder über die beiden Datumsfelder. Der
    gewählte Bis-Tag zählt vollständig mit. Über der Liste steht, wie viele Einträge
    die Suche trifft; <span class="ui">Filter zurücksetzen</span> stellt die volle
    Ansicht wieder her.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Umfang</p>
    <p>
      Der Alarmserver führt die letzten 300 Einträge. Wird ein älterer Vorgang
      gebraucht &ndash; etwa für eine Untersuchung &ndash;, steht er in der
      Datensicherung des Servers (Handbuch&nbsp;4, Abschnitt
      «Aktualisierung und Sicherung»).
    </p>
  </div>
</section>

<section id="a12">
  <h2 class="abschnitt"><span class="zahl">12</span> Die Anwendung aktualisieren</h2>
  <p>
    Im Live-Betrieb erscheint für die Administration unten in der Seitenleiste der Knopf
    <span class="ui">Aktualisierung</span>. Er holt den neuen Stand, baut Portal und
    Server neu und startet den Server neu &ndash; ohne Konsole, ohne Fernzugriff.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-23-live-dashboard.webp" alt="Live-Dashboard mit dem Knopf Aktualisierung unten in der Seitenleiste">
    <figcaption><b>Abb.</b> &nbsp; Der Knopf steht unten in der Seitenleiste, direkt unter der Serveranzeige.</figcaption>
  </figure>
  <figure class="bild-breit">
    <img src="bilder/web-24-update-dialog.webp" alt="Dialog Aktualisierung mit aktuellem Stand und der Auswahl zwischen Nur Server und Server und iOS-App">
    <figcaption><b>Abb.</b> &nbsp; Oben der aktuelle Stand mit Datum und Version, darunter die Auswahl. Ist <span class="ui">Server und iOS-App</span> ausgegraut, nennt der Text den Grund.</figcaption>
  </figure>
  <ol class="schritte">
    <li><span class="ui">Prüfen</span> zeigt, ob überhaupt etwas Neues vorliegt.</li>
    <li><span class="ui">Nur Server</span> aktualisiert Portal und Alarmserver. Das dauert wenige Minuten; währenddessen ist der Server kurz nicht erreichbar.</li>
    <li><span class="ui">Server und iOS-App</span> stösst zusätzlich einen neuen App-Build an und übergibt ihn an TestFlight.</li>
    <li>Der Dialog zeigt jeden Schritt einzeln. Schlägt einer fehl, klappt er von selbst auf und zeigt die Ausgabe.</li>
  </ol>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Voraussetzung für den iOS-Teil</p>
    <p>
      Für den App-Build braucht der Server einen Zugangstoken von expo.dev in der
      Datei <code>server/.env</code>. Fehlt er, bleibt die zweite Auswahl gesperrt und
      nennt genau das als Grund. <span class="ui">Nur Server</span> funktioniert
      unabhängig davon.
    </p>
  </div>
  <div class="hinweis hinweis--stopp">
    <p class="marke-klein">Nicht während eines Ereignisses</p>
    <p>
      Eine Aktualisierung startet den Alarmserver neu. Warten Sie damit, bis kein
      Alarm läuft.
    </p>
  </div>
</section>

<section id="a13">
  <h2 class="abschnitt"><span class="zahl">13</span> Rollen und Rechte</h2>
  <div class="tabelle-huelle">
    <table>
      <caption>Wer darf was</caption>
      <thead><tr><th>&nbsp;</th><th>Mitarbeitende</th><th>Krisenstab</th><th>Administration</th></tr></thead>
      <tbody>
        <tr><th scope="row">App benutzen</th><td class="ja">ja</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Alarm auslösen</th><td class="ja">ja</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Alarm quittieren</th><td class="ja">ja</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Alleinarbeits-Timer</th><td class="ja">ja</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Webportal öffnen</th><td class="nein">nein</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Alarm beenden</th><td class="nein">nur den eigenen SOS-Alarm</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Fehlalarm melden</th><td class="ja">eigener Alarm</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Lagemeldung senden</th><td class="nein">nein</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Übung auslösen</th><td class="nein">nein</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Szenarien, Alarmpläne, Kontakte, Alarmknöpfe</th><td class="nein">nein</td><td class="ja">ja</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Konten, Gruppen, Standorte</th><td class="nein">nein</td><td class="nein">nein</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Einstellungen &amp; Konfiguration</th><td class="nein">nein</td><td class="nein">nein</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Aktualisierung</th><td class="nein">nein</td><td class="nein">nein</td><td class="ja">ja</td></tr>
      </tbody>
    </table>
  </div>
  <p>
    Auslösen darf also jede angemeldete Person, unabhängig von der Rolle. Das ist
    Absicht: Wer den Brand entdeckt, ist selten die Schulleitung.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Eine Eigenheit, die Sie kennen sollten</p>
    <p>
      Das Menü des Portals ist für Krisenstab und Administration gleich. Ein
      Krisenstabsmitglied kann also die Seite <span class="ui">Benutzende</span> öffnen
      &ndash; beim Speichern weist der Alarmserver die Änderung jedoch ab und meldet
      «Diese Aktion ist der Administration vorbehalten». Die Rechte greifen zuverlässig,
      nur eben erst beim Speichern.
    </p>
  </div>
</section>

<section id="a14">
  <h2 class="abschnitt"><span class="zahl">14</span> Wenn etwas nicht geht</h2>

  <h4>«E-Mail-Adresse oder Passwort ist falsch» &ndash; obwohl beides stimmt</h4>
  <p>
    Prüfen Sie unten auf der Anmeldemaske, mit welchem Alarmserver das Portal
    verbunden ist. Die Konten gehören zum Server; steht dort eine andere Adresse
    (etwa ein Testserver), gilt Ihr Konto dort nicht.
  </p>

  <h4>«Der Alarmserver ist nicht erreichbar»</h4>
  <p>
    Die Anmeldemaske zeigt in diesem Fall ein Feld für die Serveradresse. Prüfen Sie,
    ob die Adresse stimmt und ob der Server läuft. Ohne Server ist keine Anmeldung
    möglich &ndash; alle Konten und Daten liegen dort.
  </p>

  <h4>In der Benutzerliste steht «kein Passwort»</h4>
  <p>
    Für dieses Konto ist keines hinterlegt &ndash; die Person kann sich nicht anmelden.
    Öffnen Sie den Eintrag und vergeben Sie ein Startpasswort.
  </p>

  <h4>Jemand erhält keine Alarme</h4>
  <p>
    Gehen Sie der Reihe nach vor: Steht die Person in einer Gruppe, die das Szenario
    anspricht? Stimmt der Standort? Ist im Alarm ein Standort gewählt, der die Person
    ausschliesst? Die Empfängerzahl über dem Auslöseknopf verrät den Fehler meist sofort.
  </p>

  <h4>Alarme kommen leise an</h4>
  <p>
    Nicht stille Alarme sollen auch bei stummgeschaltetem Telefon hörbar sein. Dafür
    braucht die App zwei Berechtigungen von Apple: die zeitkritischen Mitteilungen
    (einmalige Einrichtung) und die Critical Alerts (Antrag bei Apple). Solange die
    Bewilligung fehlt, wird der Alarm zugestellt, aber leiser. Die Einzelheiten stehen
    in <code>mobile/CRITICAL-ALERTS.md</code>.
  </p>

  <h4>Das Portal zeigt einen alten Stand</h4>
  <p>
    Laden Sie die Seite einmal neu. Bleibt es dabei, schliessen Sie den Tab und öffnen
    ihn erneut &ndash; die App speichert Teile der Oberfläche für den Offline-Betrieb zwischen.
  </p>
</section>

</main>

<footer>
  <p>
    <b>SOBE Notfall &middot; Handbuch 1 von 4 &middot; Administration.</b>
    Für Krisenstabsmitglieder gilt Handbuch 2, für Mitarbeitende Handbuch 3,
    für Installation und technischen Betrieb Handbuch 4.
  </p>
  <p>
    Die Bildschirmfotos zeigen Beispieldaten. Angaben zu Rechtsgrundlagen in den
    Szenarien sind eine Orientierungshilfe und ersetzen keine Rechtsberatung.
  </p>
  {ADRESSE}
</footer>

</div>
"""
