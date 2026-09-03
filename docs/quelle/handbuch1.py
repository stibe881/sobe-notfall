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
    <li><a href="#a1"><span class="zahl">1</span> Demo und Live</a></li>
    <li><a href="#a2"><span class="zahl">2</span> Anmelden und erstes Passwort</a></li>
    <li><a href="#a3"><span class="zahl">3</span> Das Portal im Überblick</a></li>
    <li><a href="#a4"><span class="zahl">4</span> Alarm auslösen</a></li>
    <li><a href="#a5"><span class="zahl">5</span> Die Alarmzentrale</a></li>
    <li><a href="#a6"><span class="zahl">6</span> Szenarien und Checklisten</a></li>
    <li><a href="#a7"><span class="zahl">7</span> Alarmpläne und Notfallkontakte</a></li>
    <li><a href="#a8"><span class="zahl">8</span> Alleinarbeit und Alarmknöpfe</a></li>
    <li><a href="#a9"><span class="zahl">9</span> Benutzer verwalten</a></li>
    <li><a href="#a10"><span class="zahl">10</span> Gruppen und Standorte</a></li>
    <li><a href="#a11"><span class="zahl">11</span> Integrationen und Zugangscodes</a></li>
    <li><a href="#a12"><span class="zahl">12</span> Ereignisprotokoll</a></li>
    <li><a href="#a13"><span class="zahl">13</span> Die Anwendung aktualisieren</a></li>
    <li><a href="#a14"><span class="zahl">14</span> Rollen und Rechte</a></li>
    <li><a href="#a15"><span class="zahl">15</span> Wenn etwas nicht geht</a></li>
  </ol>
</nav>

<main>

<section id="a1">
  <h2 class="abschnitt"><span class="zahl">1</span> Demo und Live</h2>
  <p>
    Das System kennt zwei streng getrennte Betriebsarten. Sie wählen sie oben links
    im Portal und in der App unter <span class="ui">Profil</span>.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Was die beiden Modi unterscheidet</caption>
      <thead><tr><th>&nbsp;</th><th>Demo</th><th>Live</th></tr></thead>
      <tbody>
        <tr><th scope="row">Zweck</th><td>Üben, schulen, ausprobieren</td><td>Der echte Betrieb</td></tr>
        <tr><th scope="row">Daten</th><td>Beispielpersonen und Beispielalarme</td><td>Ihre echten Konten und Alarme</td></tr>
        <tr><th scope="row">Zustellung</th><td>wird nur simuliert &ndash; niemand wird gestört</td><td>echte Push-Mitteilungen, SMS und Anrufe</td></tr>
        <tr><th scope="row">Speicherort</th><td>im Browser bzw. auf dem Gerät</td><td>auf dem Alarmserver</td></tr>
        <tr><th scope="row">Konten</th><td>eigene Demo-Konten</td><td>eigene Live-Konten</td></tr>
      </tbody>
    </table>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Wichtig</p>
    <p>
      Demo-Daten liegen nur in dem Browser oder auf dem Gerät, auf dem Sie arbeiten.
      Ein Konto, das Sie im Demo-Modus anlegen, existiert im Live-Betrieb nicht &ndash;
      und umgekehrt. Für Schulungen ist der Demo-Modus gedacht, für alles andere Live.
    </p>
  </div>
</section>

<section id="a2">
  <h2 class="abschnitt"><span class="zahl">2</span> Anmelden und erstes Passwort</h2>
  <p>
    Ohne Anmeldung ist nichts zugänglich &ndash; weder das Portal noch die App.
    Angemeldet wird mit E-Mail-Adresse und Passwort.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-01-anmeldung.webp" alt="Anmeldemaske mit Umschalter zwischen Demo und Live und der Liste der Demo-Zugänge">
    <figcaption><b>Abb.</b> &nbsp; Die Anmeldemaske. Der Umschalter oben entscheidet, gegen welchen Datenbestand angemeldet wird. Im Demo-Modus stehen die Zugänge samt Passwort direkt darunter.</figcaption>
  </figure>

  <h3>Die erste Anmeldung im Live-Betrieb</h3>
  <p>
    Ein frisch aufgesetzter Alarmserver kennt genau ein Konto: das
    Administratorkonto mit einem Erstpasswort. Die Anmeldemaske nennt beides,
    solange noch niemand ein eigenes Passwort vergeben hat.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-21-anmeldung-live.webp" alt="Anmeldemaske im Live-Modus mit Hinweis auf das Administratorkonto und das Erstpasswort">
    <figcaption><b>Abb.</b> &nbsp; Live-Modus bei der Erstinbetriebnahme. Ein Klick auf den Hinweis füllt Adresse und Erstpasswort ein.</figcaption>
  </figure>
  <p>
    Unmittelbar nach der Anmeldung verlangt das System ein eigenes Passwort. Vorher
    geht es nicht weiter &ndash; auch nicht über die Adresszeile.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-22-live-erstanmeldung.webp" alt="Bildschirm mit der Aufforderung, ein eigenes Passwort zu vergeben">
    <figcaption><b>Abb.</b> &nbsp; Der erzwungene Passwortwechsel. Mindestens acht Zeichen, davon mindestens eine Ziffer.</figcaption>
  </figure>
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

<section id="a3">
  <h2 class="abschnitt"><span class="zahl">3</span> Das Portal im Überblick</h2>
  <p>
    Das Menü links ist nach dem zeitlichen Ablauf eines Ereignisses geordnet:
    zuerst was im Ernstfall gebraucht wird, dann der Alleinarbeiterschutz, dann alles,
    was vorher vorbereitet sein muss, dann die Systemeinstellungen. Zuunterst steht
    die <span class="ui">Hilfe</span>: Unter <span class="ui">Handbücher</span> finden Sie
    alle vier Handbücher &ndash; immer in der Fassung, die zur laufenden Version gehört.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-02-dashboard.webp" alt="Dashboard mit vier Kennzahlen, Alarmserver-Status und den letzten Ereignissen">
    <figcaption><b>Abb.</b> &nbsp; Das Dashboard. Vier Kennzahlen oben, links der Zustand der Kanäle, rechts die jüngsten Ereignisse. Was nur vorbereitet ist, steht grau als «vorbereitet, noch nicht aktiv».</figcaption>
  </figure>
  <p>
    Darunter die Kachel <b>Bereitschaft</b> &ndash; die Antwort auf die Frage, ob ein
    Alarm die Leute überhaupt erreicht: pro Standort, wie viele Personen ein Gerät mit
    der App registriert haben und wie viele Critical Alerts erlauben; ob der Push-Dienst
    erreichbar ist; wann die letzte Sicherung lief; wann die wöchentliche Testmeldung
    an die Administration ging. Mit <span class="ui">Testmeldung an mein Telefon</span>
    prüfen Sie die Kette bis aufs eigene Gerät. Im Demo-Modus bleibt die Kachel leer,
    weil es dort keine registrierten Geräte gibt.
  </p>
  <p>
    Ganz unten in der Seitenleiste steht, als wer Sie angemeldet sind. Im Demo-Modus
    finden Sie dort zusätzlich eine Auswahl <span class="ui">Demo-Ansicht</span>: Damit
    sehen Sie das Portal aus der Sicht einer anderen Person, ohne sich abzumelden.
    Im Live-Betrieb gibt es diese Auswahl bewusst nicht.
  </p>
  <h3>App-Vorschau</h3>
  <p>
    <span class="ui">App-Vorschau</span> öffnet die App im Browser. Oben steht eine gelbe
    Leiste <span class="ui">Vorschau als</span>: Dort wählen Sie jede erfasste Person und
    sehen die App so, wie sie diese Person sieht &ndash; ihre Alarme, ihre Schritte je
    Gruppe, ihren Standort. Das eignet sich zum Prüfen, ob Gruppen und Schritte richtig
    zugeordnet sind. Im Live-Betrieb ist die Vorschau reine Ansicht: Quittieren,
    Auslösen und Timer sind gesperrt, weil sie sonst unter Ihrem eigenen Konto liefen.
    Im Demo-Modus handelt die gewählte Person, wie bei der Demo-Ansicht.
  </p>
</section>

<section id="a4">
  <h2 class="abschnitt"><span class="zahl">4</span> Alarm auslösen</h2>
  <p>
    Unter <span class="ui">Alarm auslösen</span> wählen Sie ein Szenario oder einen
    fertigen Alarmplan. Das System füllt daraufhin Empfängergruppen, Kanäle und
    Eskalationsstufen vor.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-15-alarm-vorbereitet.webp" alt="Vorbereiteter Alarm mit gewähltem Szenario, Empfängern und Kanälen">
    <figcaption><b>Abb.</b> &nbsp; Ein vorbereiteter Alarm. Unter <span class="ui">Anpassen</span> lassen sich Standort, Kanäle, stille Auslösung und die Quittierpflicht für diesen einen Fall ändern.</figcaption>
  </figure>
  <ol class="schritte">
    <li>Szenario oder Alarmplan anklicken.</li>
    <li>Prüfen, wer als Empfänger angezeigt wird &ndash; die Zahl steht direkt über dem Auslöseknopf.</li>
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
    Ein stiller Alarm erreicht die Empfänger als Mitteilung ohne Ton und ohne
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
    Empfängern, neu gewählte Standorte werden zusätzlich alarmiert, Quittierung und
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

<section id="a5">
  <h2 class="abschnitt"><span class="zahl">5</span> Die Alarmzentrale</h2>
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
    senden, erreicht alle Empfänger als Mitteilung und steht in ihrer
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

<section id="a6">
  <h2 class="abschnitt"><span class="zahl">6</span> Szenarien und Checklisten</h2>
  <p>
    Szenarien sind das Herz des Systems. Jedes enthält, was im Ernstfall auf dem
    Telefon erscheint: Hinweise zum Notruf, die Sofortmassnahmen, die Massnahmen nach
    der Akutphase, eine Checkliste und die Rechtsgrundlagen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-07-szenarien.webp" alt="Übersicht der Szenarien als Karten mit Kategorie, Priorität und Anzahl der Massnahmen">
    <figcaption><b>Abb.</b> &nbsp; Die Szenarienübersicht. Elf Szenarien sind für Mitarbeitende freigegeben &ndash; darunter Amok / Bedrohungslage mit stiller Voreinstellung und Vermisste:r Schüler:in, auf das der Alarmplan «Suchaktion» verweist &ndash;, die übrigen sind ausgeblendet und lassen sich mit dem Augensymbol wieder einblenden.</figcaption>
  </figure>

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
        <tr><td><b>Empfänger</b></td><td>eigener Weg «Ich wurde alarmiert»</td><td>Was jemand tut, der den Alarm erhält: kein Notruf, keine Auslösung, sondern die eigene Aufgabe &ndash; je Schritt wählbar, für welche Gruppen er gilt</td></tr>
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
      nicht. Das Feld <b>Empfänger</b> gehört darum zu jedem Szenario, das alarmiert
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

<section id="a7">
  <h2 class="abschnitt"><span class="zahl">7</span> Alarmpläne und Notfallkontakte</h2>
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
      Eskalationsstufen (nur ein Protokolleintrag) und für «Nur während Betriebszeiten».
      Überall im Portal ist das einheitlich mit <em>vorbereitet, noch nicht aktiv</em>
      gekennzeichnet.
    </p>
  </div>
  <figure class="bild-breit">
    <img src="bilder/web-08-alarmplaene.webp" alt="Übersicht der Alarmpläne mit Zielgruppen, Kanälen und Eskalationsstufen">
    <figcaption><b>Abb.</b> &nbsp; Sechs vorbereitete Alarmpläne. Die Stufen darunter greifen automatisch, wenn niemand quittiert.</figcaption>
  </figure>
  <h3>Einen neuen Alarmplan erstellen &ndash; der Assistent</h3>
  <p>
    <span class="ui">Neuer Alarmplan</span> öffnet einen Assistenten mit fünf
    Schritten: <b>Grundlagen</b> (Name und Szenario &ndash; als Kartenauswahl mit
    Symbol), <b>Empfänger</b> (Zielgruppen und Standorte, leer bedeutet alle),
    <b>Kanäle &amp; Optionen</b> (Erstaussand, Quittierfunktion, Betriebszeiten),
    <b>Eskalation</b> (Stufen mit Minuten, zusätzlichen Gruppen und Kanälen) und die
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

<section id="a8">
  <h2 class="abschnitt"><span class="zahl">8</span> Alleinarbeit und Alarmknöpfe</h2>
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
    von Gruppe und Standort. Läuft ein Timer ab, darf die betroffene Person den Alarm
    selbst mit <span class="ui">Mir geht es gut</span> beenden; die Entwarnung geht dann
    an alle Alarmierten.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-06-alarmknoepfe.webp" alt="Übersicht der Alarmknöpfe mit Batteriestand und Funkverbindung">
    <figcaption><b>Abb.</b> &nbsp; Die fest installierten und tragbaren Alarmknöpfe mit Batteriestand und Funkverbindung. Ein Knopf mit schwacher Batterie ist hier zu erkennen, bevor er ausfällt.</figcaption>
  </figure>
  <p>
    Die Alarmknöpfe sind <em>vorbereitet, noch nicht aktiv</em>: Sie können Geräte
    erfassen, Standort, Nachricht und Zielgruppen planen, aber ein Knopfdruck löst
    heute keinen Alarm aus, solange kein LoRaWAN- oder GSM-Netz angebunden ist.
  </p>
</section>

<section id="a9">
  <h2 class="abschnitt"><span class="zahl">9</span> Benutzer verwalten</h2>
  <p>
    Diese Seite ist ausschliesslich der Administration vorbehalten. Sie legen Konten
    an, vergeben Rollen und setzen Passwörter zurück.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-09-benutzer.webp" alt="Benutzerverwaltung mit Liste aller Konten, Standort, Status und Anmeldezustand">
    <figcaption><b>Abb.</b> &nbsp; Die Benutzerliste. Die Spalte <span class="ui">Anmeldung</span> zeigt, ob für ein Konto ein Passwort hinterlegt ist.</figcaption>
  </figure>
  <figure class="bild-breit">
    <img src="bilder/web-20-benutzer-editor.webp" alt="Dialog zum Anlegen eines neuen Benutzers mit Rolle, Standort, Gruppen und Anmeldedaten">
    <figcaption><b>Abb.</b> &nbsp; Ein neues Konto. Ohne Passwort kann sich die Person weder im Portal noch in der App anmelden &ndash; das Feld gehört ausgefüllt.</figcaption>
  </figure>
  <h4>Rolle</h4>
  <p>
    <b>Mitarbeiter</b> nutzt ausschliesslich die App. <b>Krisenstab</b> nutzt App und
    Portal und darf alarmieren, beenden und die Vorbereitung pflegen.
    <b>Admin</b> darf zusätzlich Konten, Gruppen, Standorte und Systemeinstellungen ändern.
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

<section id="a10">
  <h2 class="abschnitt"><span class="zahl">10</span> Gruppen und Standorte</h2>
  <p>
    Gruppen bündeln Personen nach Funktion &ndash; Krisenstab, Schulsanität,
    Evakuationshelfer, Deeskalationsteam, IT, Hausdienst. Szenarien und Alarmpläne
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
</section>

<section id="a11">
  <h2 class="abschnitt"><span class="zahl">11</span> Integrationen und Zugangscodes</h2>
  <figure class="bild-breit">
    <img src="bilder/web-13-integrationen.webp" alt="Seite Integrationen mit Kommunikationskanälen, Identitätsanbindung, Webhooks und Zugangscodes">
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
        <tr><td>SMS-Gateway, VoIP, Microsoft Teams</td><td>Kein Versand über diese Kanäle; Alarme gehen per Push</td></tr>
        <tr><td>Single Sign-On</td><td>Anmeldung mit E-Mail-Adresse und Passwort</td></tr>
        <tr><td>Synchronisation mit dem Personalsystem</td><td>Benutzer werden von Hand oder per Import gepflegt</td></tr>
        <tr><td>Mehrsprachige App-Inhalte</td><td>Alle Inhalte sind deutsch; die Sprache im Benutzerprofil ist eine Vormerkung</td></tr>
        <tr><td>Geofencing</td><td>Alarmiert wird nach dem Standort im Profil; die App überträgt keinen Standort</td></tr>
        <tr><td>Eingehende Webhooks</td><td>Der Server nimmt keine Auslösung von aussen entgegen (z. B. Brandmeldeanlage)</td></tr>
        <tr><td>Zugangscodes</td><td>Die App kennt keine Codes; Mitarbeitende melden sich mit E-Mail und Passwort an</td></tr>
        <tr><td>Physische Alarmknöpfe</td><td>Geräte sind nicht angebunden; die Einträge dienen der Planung</td></tr>
        <tr><td>Blaulicht in Eskalationsstufen, Betriebszeiten</td><td>Nur Protokolleintrag beziehungsweise ohne Wirkung</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section id="a12">
  <h2 class="abschnitt"><span class="zahl">12</span> Ereignisprotokoll</h2>
  <p>
    Jede Anmeldung, jede Änderung an der Konfiguration und jede Alarmauslösung wird
    mit Zeitstempel und Namen festgehalten. Das Protokoll lässt sich nicht bearbeiten.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-14-protokoll.webp" alt="Ereignisprotokoll mit Einträgen nach Zeit sortiert">
    <figcaption><b>Abb.</b> &nbsp; Das Ereignisprotokoll. Erste Anlaufstelle, wenn zu klären ist, wer wann was ausgelöst hat.</figcaption>
  </figure>
</section>

<section id="a13">
  <h2 class="abschnitt"><span class="zahl">13</span> Die Anwendung aktualisieren</h2>
  <p>
    Im Live-Betrieb erscheint für Administratoren unten in der Seitenleiste der Knopf
    <span class="ui">Aktualisierung</span>. Er holt den neuen Stand, baut Portal und
    Server neu und startet den Server neu &ndash; ohne Konsole, ohne Fernzugriff.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-23-live-dashboard.webp" alt="Live-Dashboard mit dem Knopf Aktualisierung unten in der Seitenleiste">
    <figcaption><b>Abb.</b> &nbsp; Im Live-Betrieb steht der Knopf unten in der Seitenleiste, dort wo im Demo-Modus der Umschalter sitzt.</figcaption>
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

<section id="a14">
  <h2 class="abschnitt"><span class="zahl">14</span> Rollen und Rechte</h2>
  <div class="tabelle-huelle">
    <table>
      <caption>Wer darf was</caption>
      <thead><tr><th>&nbsp;</th><th>Mitarbeiter</th><th>Krisenstab</th><th>Admin</th></tr></thead>
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
        <tr><th scope="row">Benutzer, Gruppen, Standorte</th><td class="nein">nein</td><td class="nein">nein</td><td class="ja">ja</td></tr>
        <tr><th scope="row">Integrationen</th><td class="nein">nein</td><td class="nein">nein</td><td class="ja">ja</td></tr>
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
      Krisenstabsmitglied kann also die Seite <span class="ui">Benutzer</span> öffnen
      &ndash; beim Speichern weist der Alarmserver die Änderung jedoch ab und meldet
      «Diese Aktion ist Administratoren vorbehalten». Die Rechte greifen zuverlässig,
      nur eben erst beim Speichern.
    </p>
  </div>
</section>

<section id="a15">
  <h2 class="abschnitt"><span class="zahl">15</span> Wenn etwas nicht geht</h2>

  <h4>«E-Mail-Adresse oder Passwort ist falsch» &ndash; obwohl beides stimmt</h4>
  <p>
    Fast immer steht der Umschalter Demo/Live auf der falschen Seite. Demo- und
    Live-Konten sind getrennt; ein Konto aus dem einen Bestand gilt im anderen nicht.
    Stellen Sie oben auf <span class="ui">Live</span> und melden Sie sich erneut an.
  </p>

  <h4>«Der Alarmserver ist nicht erreichbar»</h4>
  <p>
    Die Anmeldemaske zeigt in diesem Fall ein Feld für die Serveradresse. Prüfen Sie,
    ob die Adresse stimmt und ob der Server läuft. Der Demo-Modus funktioniert
    unabhängig davon weiter.
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
    Die Bildschirmfotos stammen aus dem Demo-Modus. Angaben zu Rechtsgrundlagen in den
    Szenarien sind eine Orientierungshilfe und ersetzen keine Rechtsberatung.
  </p>
  {ADRESSE}
</footer>

</div>
"""
