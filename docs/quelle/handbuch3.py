# -*- coding: utf-8 -*-
TITEL = 'SOBE Handbuch Mitarbeitende'
TITELSEITE = dict(
    rolle='SOBE Notfall &middot; Handbuch 3 von 4',
    titel='Die App im Alltag',
    untertitel='Für alle Mitarbeitenden',
    vorspann='Die App auf Ihrem Telefon macht zwei Dinge: Sie holt im Notfall in Sekunden Hilfe, und sie sagt Ihnen Schritt für Schritt, was zu tun ist. Mehr müssen Sie nicht können. Dieses Handbuch zeigt jeden Bildschirm, den Sie brauchen.',
)

KOERPER = r"""
<div class="blatt">

{TITELSEITE}

<nav class="inhalt" aria-label="Inhalt">
  <h2>Inhalt</h2>
  <ol>
    <li><a href="#c1"><span class="zahl">1</span> Das Wichtigste in Kürze</a></li>
    <li><a href="#c2"><span class="zahl">2</span> Anmelden</a></li>
    <li><a href="#c3"><span class="zahl">3</span> Die Startseite</a></li>
    <li><a href="#c4"><span class="zahl">4</span> SOS &ndash; Hilfe für sich selbst</a></li>
    <li><a href="#c5"><span class="zahl">5</span> Einen Alarm erhalten</a></li>
    <li><a href="#c6"><span class="zahl">6</span> Der geführte Ablauf</a></li>
    <li><a href="#c7"><span class="zahl">7</span> Szenarien nachschlagen</a></li>
    <li><a href="#c8"><span class="zahl">8</span> Allein arbeiten</a></li>
    <li><a href="#c9"><span class="zahl">9</span> Notrufnummern</a></li>
    <li><a href="#c10"><span class="zahl">10</span> Ihr Profil</a></li>
    <li><a href="#c11"><span class="zahl">11</span> Häufige Fragen</a></li>
  </ol>
</nav>

<main>

<section id="c1">
  <h2 class="abschnitt"><span class="zahl">1</span> Das Wichtigste in Kürze</h2>
  <ul>
    <li><b>Alle roten Knöpfe muss man halten</b>, nicht antippen &ndash; etwa eine Sekunde, bis der Balken durchgelaufen ist. So löst nichts versehentlich aus.</li>
    <li><b>Bei unmittelbarer Gefahr gilt zuerst der Notruf</b>: 118 Feuerwehr, 144 Sanität, 117 Polizei. Die App ersetzt ihn nicht, sie hilft beim Melden.</li>
    <li><b>Jede angemeldete Person darf alarmieren.</b> Sie brauchen keine Erlaubnis und müssen niemanden fragen. Der Knopf <span class="ui">Alarm auslösen</span> steht oben rechts &ndash; auf jeder Seite der App.</li>
    <li><b>Eine Mitteilung antippen genügt.</b> Kommt ein Alarm oder eine Entwarnung als Push-Mitteilung, öffnet das Antippen direkt die Schritte, die für Sie gelten.</li>
    <li><b>Die App funktioniert auch ohne Empfang.</b> Der letzte Stand vom Alarmserver bleibt auf dem Gerät: Szenarien, Nummern und die laufenden Alarme. Ohne Verbindung steht oben «getrennt», die Anweisungen bleiben lesbar.</li>
  </ul>
  <div class="hinweis hinweis--gut">
    <p class="marke-klein">Im Zweifel auslösen</p>
    <p>
      Ein Alarm zu viel ist harmlos. Ein Alarm zu wenig kann Leben kosten. Niemand
      wird für einen Fehlalarm zur Rechenschaft gezogen.
    </p>
  </div>
</section>

<section id="c2">
  <h2 class="abschnitt"><span class="zahl">2</span> Anmelden</h2>
  <p>
    Sie melden sich mit Ihrer geschäftlichen E-Mail-Adresse und dem Passwort an, das
    Sie von der Schulleitung erhalten haben. Der Umschalter oben muss auf
    <span class="ui">Live</span> stehen.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-01-anmeldung.webp" alt="Anmeldemaske der App mit Feldern für E-Mail-Adresse und Passwort">
      <figcaption><b>Abb.</b> &nbsp; Die Anmeldung.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-00-start-leer.webp" alt="Startseite der App ohne aktive Alarme mit dem SOS-Knopf">
      <figcaption><b>Abb.</b> &nbsp; So sieht es aus, wenn alles ruhig ist.</figcaption>
    </figure>
  </div>
  <p>
    Beim ersten Mal werden Sie aufgefordert, ein eigenes Passwort zu vergeben:
    mindestens acht Zeichen mit mindestens einer Ziffer. Danach bleiben Sie angemeldet
    &ndash; Sie müssen sich nicht bei jedem Dienst neu anmelden.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Beim ersten Start</p>
    <p>
      Das Telefon fragt, ob die App Mitteilungen senden darf. Bestätigen Sie das.
      Ohne diese Erlaubnis erreichen Sie keine Alarme.
    </p>
  </div>
</section>

<section id="c3">
  <h2 class="abschnitt"><span class="zahl">3</span> Die Startseite</h2>
  <p>
    Unten führen fünf Schaltflächen durch die App. Sie sind immer erreichbar,
    egal wo Sie gerade sind. Oben rechts steht auf jeder Seite der rote Knopf
    <span class="ui">Alarm auslösen</span> &ndash; für den Fall, dass Sie ein
    Ereignis entdecken (Abschnitt 6). Auf der Startseite steht zuoberst die interne
    Notfallnummer <b>+41 41 767 49 48</b>, die per Antippen anruft; darunter laufende
    Alarme, Entwarnungen der letzten Stunden und der SOS-Knopf.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Die fünf Bereiche</caption>
      <thead><tr><th>Bereich</th><th>Wofür</th></tr></thead>
      <tbody>
        <tr><td><b>Start</b></td><td>Interne Notfallnummer, laufende Alarme, Entwarnungen und der SOS-Knopf</td></tr>
        <tr><td><b>Szenarien</b></td><td>Handlungsanweisungen zum Nachschlagen</td></tr>
        <tr><td><b>Alleinarbeit</b></td><td>Der Timer, wenn Sie allein unterwegs sind</td></tr>
        <tr><td><b>Notruf</b></td><td>Alle Notrufnummern zum direkten Anrufen</td></tr>
        <tr><td><b>Profil</b></td><td>Ihre Angaben, Passwort ändern, abmelden</td></tr>
      </tbody>
    </table>
  </div>
</section>

<section id="c4">
  <h2 class="abschnitt"><span class="zahl">4</span> SOS &ndash; Hilfe für sich selbst</h2>
  <p>
    Der grosse rote Knopf auf der Startseite ist für den Fall gedacht, dass
    <em>Sie</em> Hilfe brauchen und keine Zeit haben, ein Szenario zu suchen.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-00-start-leer.webp" alt="Startseite mit dem SOS-Knopf">
      <figcaption><b>Abb.</b> &nbsp; Gedrückt halten, bis der Balken voll ist.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-13-sos-aktiv.webp" alt="Aktiver eigener Alarm mit Zustellfortschritt und dem Knopf für die Entwarnung">
      <figcaption><b>Abb.</b> &nbsp; Danach sehen Sie, wie viele erreicht wurden und wer kommt.</figcaption>
    </figure>
  </div>
  <p>
    SOS alarmiert sofort Schulsanität und Hausdienst an Ihrem Standort. Antwortet
    niemand, weitet das System die Alarmierung selbständig aus.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Fehlalarm ausgelöst?</p>
    <p>
      Den eigenen SOS-Alarm beenden Sie selbst: <span class="ui">Entwarnung &ndash; mir
      geht es gut</span>. Alle Alarmierten erhalten sofort die Entwarnung. Haben Sie
      dagegen ein Szenario irrtümlich ausgelöst, tippen Sie auf
      <span class="ui">Fehlalarm melden</span>: Alle Empfänger und der Krisenstab sehen
      Ihre Meldung, und der Krisenstab gibt die Entwarnung. Niemand nimmt Ihnen den
      Irrtum übel.
    </p>
  </div>
</section>

<section id="c5">
  <h2 class="abschnitt"><span class="zahl">5</span> Einen Alarm erhalten</h2>
  <p>
    Wird an Ihrem Standort alarmiert, erhalten Sie eine Push-Mitteilung, und die
    Meldung erscheint zuoberst auf der Startseite. Ist der Alarm nicht still, ist er
    auch bei stummgeschaltetem Telefon hörbar. <b>Tippen Sie die Mitteilung an</b>:
    Die App öffnet direkt die Handlungsanweisung zu diesem Alarm &ndash; Sie müssen
    nichts suchen.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-02-alarm-empfangen.webp" alt="Eingegangener Alarm mit den Knöpfen Ich komme und Nicht verfügbar sowie dem Knopf Was jetzt zu tun ist">
      <figcaption><b>Abb.</b> &nbsp; Ein Alarm mit Rückmeldepflicht.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-03-empfaenger.webp" alt="Ansicht für Empfänger mit der Alarmmeldung, der Quittierung und den Schritten für Empfänger">
      <figcaption><b>Abb.</b> &nbsp; Was Sie als Empfängerin oder Empfänger tun &ndash; hier für ein Mitglied der Schulsanität. Schritte anderer Gruppen sind ausgeblendet und lassen sich unten einblenden.</figcaption>
    </figure>
  </div>
  <ol class="schritte">
    <li>
      <b>Antworten.</b> <span class="ui">Ich komme</span> oder
      <span class="ui">Nicht verfügbar</span>. Beides ist eine gültige Antwort &ndash;
      wer im Wasser steht oder ein Kind betreut, meldet sich als nicht verfügbar.
      Unter der Meldung sehen Sie laufend, wie viele Personen benachrichtigt wurden,
      wie viele kommen, wie viele nicht verfügbar sind und wie viele noch nicht
      geantwortet haben.
    </li>
    <li>
      <b><span class="ui">Was jetzt zu tun ist</span> antippen.</b> Sie bekommen die Schritte
      für <em>Empfänger</em> &ndash; nicht den Ablauf für die Person, die das Ereignis
      entdeckt hat.
    </li>
  </ol>
  <div class="hinweis">
    <p class="marke-klein">Der Unterschied ist wichtig</p>
    <p>
      Wer den Brand entdeckt, ruft die Feuerwehr und löst den Alarm aus. Wer den Alarm
      <em>erhält</em>, tut beides <b>nicht</b> &ndash; es ist bereits geschehen. Ein
      zweiter Notruf blockiert die Leitung, ein zweiter Alarm verwirrt alle. Für
      Empfänger gilt darum ein eigener Ablauf: Klasse sammeln, Sammelplatz, zählen,
      melden. Die App zeigt Ihnen automatisch den richtigen.
    </p>
    <p>
      Und sie zeigt nur <em>Ihre</em> Schritte: Wer zur Schulsanität gehört, sieht den
      Rucksack; wer zum Hausdienst gehört, sieht die Zufahrt. Was andere Gruppen
      gerade tun, lässt sich mit einem Tipp einblenden &ndash; hilfreich, wenn Sie
      wissen wollen, wer die Feuerwehr einweist.
    </p>
  </div>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Bitte immer antworten</p>
    <p>
      Wer nicht antwortet, gilt als nicht erreicht. Dann alarmiert das System nach
      wenigen Minuten weitere Personen &ndash; unnötig, wenn Sie längst unterwegs sind.
    </p>
  </div>

  <h3>Lagemeldungen</h3>
  <p>
    Während der Alarm läuft, kann der Krisenstab Lagemeldungen schicken, etwa
    «Sammelplatz Ost gesperrt, bitte Nord». Sie kommen als eigene Mitteilung an und
    stehen violett in der Alarmkarte und in der Handlungsanweisung, die neueste
    zuoberst. Hat eine zweite Person dasselbe Ereignis gemeldet, erscheint ihre Meldung
    dort ebenfalls &ndash; ein zweiter Alarm entsteht nicht.
  </p>
  <p>
    Trägt eine Mitteilung den Vorspann <b>ÜBUNG</b>, ist es eine angekündigte Übung.
    Verhalten Sie sich wie im Ernstfall; in der App ist der Alarm gelb als Übung
    gekennzeichnet.
  </p>

  <h3>Stiller Alarm</h3>
  <p>
    Manche Alarme kommen <em>still</em>: Die Mitteilung erscheint auf dem
    Sperrbildschirm, aber ohne Ton und ohne Vibration, und in der App ist sie violett
    gekennzeichnet. Das ist Absicht. Bei herausforderndem Verhalten, einer
    verdächtigen Person, einem Todesfall oder einer Bedrohungslage darf niemand durch
    ein klingelndes Telefon auffallen. Verhalten Sie sich entsprechend: Gerät stumm
    lassen, keine Rückfragen, den Schritten in der App folgen.
  </p>

  <h3>Die Entwarnung</h3>
  <p>
    Beendet der Krisenstab den Alarm, erhalten Sie eine zweite Mitteilung:
    <span class="ui">Entwarnung</span>. Antippen öffnet die Schritte für die Rückkehr in
    den Normalbetrieb &ndash; denn der beginnt nicht von selbst: zurück ins Gebäude erst
    nach Freigabe, Klasse erneut zählen, Vorfall festhalten. Auf der Startseite bleibt
    die Entwarnung einige Stunden sichtbar.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-16-entwarnung-start.webp" alt="Startseite mit einer grünen Entwarnungskarte und dem Knopf Nächste Schritte">
      <figcaption><b>Abb.</b> &nbsp; Die Entwarnung auf der Startseite.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-17-entwarnung.webp" alt="Ansicht Entwarnung mit der beendeten Alarmmeldung und den nummerierten Schritten nach der Entwarnung">
      <figcaption><b>Abb.</b> &nbsp; Was nach der Entwarnung zu tun ist &ndash; zum Abhaken.</figcaption>
    </figure>
  </div>
</section>

<section id="c6">
  <h2 class="abschnitt"><span class="zahl">6</span> Der geführte Ablauf</h2>
  <p>
    Dieser Ablauf ist für den Fall, dass <em>Sie</em> das Ereignis entdecken. Der
    schnellste Weg hinein ist der rote Knopf <span class="ui">Alarm auslösen</span>
    oben rechts: Sie wählen das Ereignis, und die App springt direkt in Phase 1.
    Denselben Ablauf erreichen Sie auch über <span class="ui">Szenarien</span>. Er
    führt in vier Phasen hindurch. Sie tippen sich mit <span class="ui">Weiter</span>
    durch &ndash; die Reihenfolge ist die Reihenfolge, in der gehandelt wird.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-14-alarm-auswahl.webp" alt="Ansicht Alarm auslösen mit der Frage Welches Ereignis liegt vor und den Kacheln der Szenarien">
      <figcaption><b>Abb.</b> &nbsp; Nach dem Knopf oben rechts: Welches Ereignis?</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-15-doppelalarm.webp" alt="Phase Alarmieren mit dem violetten Hinweis Für dieses Ereignis läuft bereits ein Alarm">
      <figcaption><b>Abb.</b> &nbsp; Läuft für das Ereignis schon ein Alarm, sagt es die App, bevor Sie halten.</figcaption>
    </figure>
  </div>
  <div class="hinweis">
    <p class="marke-klein">Wenn schon jemand alarmiert hat</p>
    <p>
      Entdecken zwei Personen denselben Brand, löst die erste aus &ndash; und die zweite
      sieht in Phase 1 den violetten Hinweis mit Name und Zeit. Meist genügt dann
      <span class="ui">Was jetzt zu tun ist</span>: Sie wechseln in die Schritte für
      Empfänger. Halten Sie trotzdem den Knopf, entsteht kein zweiter Alarm: Ihre
      Meldung wird dem laufenden Alarm als «weitere Meldung» hinzugefügt, und ein neu
      gewählter Standort wird zusätzlich alarmiert. Niemand muss doppelt quittieren.
    </p>
  </div>
  <figure class="geraet">
    <img src="bilder/app-04-phasenuebersicht.webp" alt="Übersicht der vier Phasen eines Szenarios mit den Knöpfen Geführt starten – ich habe es entdeckt und Ich wurde alarmiert – was jetzt?">
    <figcaption><b>Abb.</b> &nbsp; Die vier Phasen und darunter die beiden Einstiege: <span class="ui">Geführt starten &ndash; ich habe es entdeckt</span> beginnt bei Phase 1. <span class="ui">Ich wurde alarmiert &ndash; was jetzt?</span> zeigt stattdessen die Schritte für Empfänger.</figcaption>
  </figure>

  <h3>Phase 1 &middot; Alarmieren</h3>
  <p>
    Zuerst Hilfe holen. Der gelbe Kasten sagt, <em>wann</em> ein Notruf nötig ist und
    <em>was</em> Sie am Telefon melden. Darunter wählen die roten Knöpfe die Nummer
    direkt, und ganz unten alarmieren Sie die Kolleginnen und Kollegen im Haus.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-05-phase1-alarmieren.webp" alt="Phase Alarmieren mit dem Kasten Wann anrufen und was sagen und den Anrufknöpfen">
      <figcaption><b>Abb.</b> &nbsp; Was am Telefon zu sagen ist.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-05b-phase1-unten.webp" alt="Unterer Teil der Phase Alarmieren mit Standortwahl und dem Knopf zum internen Alarmieren">
      <figcaption><b>Abb.</b> &nbsp; Standort wählen, dann halten.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-05c-ausgeloest.webp" alt="Grüner Statuskasten nach dem Auslösen mit Zustellzahlen und dem Knopf Fehlalarm melden">
      <figcaption><b>Abb.</b> &nbsp; Nach dem Auslösen: Zustellung, Quittierungen und der Weg zurück, falls es ein Irrtum war.</figcaption>
    </figure>
  </div>

  <h3>Phase 2 &middot; Sofortmassnahmen</h3>
  <p>
    Jetzt die Handgriffe, der Reihe nach. Tippen Sie einen Schritt an, wenn er
    erledigt ist &ndash; so verlieren Sie unter Druck nicht den Faden.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-06-phase2-sofortmassnahmen.webp" alt="Phase Sofortmassnahmen mit nummerierten Schritten zum Abhaken">
      <figcaption><b>Abb.</b> &nbsp; Schritte zum Abhaken.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-07-phase3-informieren.webp" alt="Phase Informieren mit dem Knopf Krisenteam aufbieten und der Mitgliederliste">
      <figcaption><b>Abb.</b> &nbsp; Phase 3: Krisenteam aufbieten.</figcaption>
    </figure>
  </div>

  <h3>Phase 3 &middot; Informieren</h3>
  <p>
    Reicht die eigene Kraft nicht, bieten Sie hier das Krisenteam auf. Einzelne
    Personen erreichen Sie über <span class="ui">Anrufen</span> oder
    <span class="ui">SMS &amp; Push</span> &ndash; die Push-Mitteilung kommt an, der
    SMS-Versand ist noch nicht angebunden.
  </p>

  <h3>Phase 4 &middot; Weitere Massnahmen</h3>
  <p>
    Alles nach der Akutphase: informieren, betreuen, dokumentieren. Darunter eine
    Checkliste zum Abhaken und &ndash; aufklappbar &ndash; die Rechtsgrundlagen, auf
    denen das Vorgehen beruht.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-08-phase4-weitere.webp" alt="Phase Weitere Massnahmen mit den Punkten nach der Akutphase">
      <figcaption><b>Abb.</b> &nbsp; Nach der Akutphase.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-08b-checkliste.webp" alt="Checkliste am Ende des Szenarios">
      <figcaption><b>Abb.</b> &nbsp; Die Checkliste.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-08c-rechtsgrundlagen.webp" alt="Aufgeklappte Rechtsgrundlagen des Szenarios">
      <figcaption><b>Abb.</b> &nbsp; Die Rechtsgrundlagen.</figcaption>
    </figure>
  </div>
</section>

<section id="c7">
  <h2 class="abschnitt"><span class="zahl">7</span> Szenarien nachschlagen</h2>
  <p>
    Unter <span class="ui">Szenarien</span> finden Sie alle Abläufe &ndash; auch ohne
    Alarm. Nutzen Sie das zur Vorbereitung: Wer den Ablauf einmal in Ruhe gelesen hat,
    findet sich im Ernstfall schneller zurecht.
  </p>
  <figure class="geraet">
    <img src="bilder/app-09-szenarienliste.webp" alt="Liste der elf freigegebenen Szenarien">
    <figcaption><b>Abb.</b> &nbsp; Die elf Szenarien: Brand, Evakuierung, medizinischer Notfall, herausforderndes Verhalten, verdächtige Person, Todesfall, Notfall im Therapiebad, ICT-Ausfall, Krisenstab einberufen, vermisste:r Schüler:in, Amok / Bedrohungslage.</figcaption>
  </figure>
</section>

<section id="c8">
  <h2 class="abschnitt"><span class="zahl">8</span> Allein arbeiten</h2>
  <p>
    Sind Sie allein unterwegs &ndash; Abendrundgang, Wartung, Therapie im
    abgelegenen Trakt &ndash; starten Sie einen Timer. Melden Sie sich nicht vor
    Ablauf zurück, alarmiert die App selbständig Schulsanität und Hausdienst.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-10-alleinarbeit.webp" alt="Alleinarbeit mit Feld für die Tätigkeit, Schieberegler für die Dauer und dem Knopf Timer starten">
      <figcaption><b>Abb.</b> &nbsp; Tätigkeit eintragen, Dauer wählen, starten.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-10b-alleinarbeit-laufend.webp" alt="Laufender Timer mit verbleibender Zeit und den Knöpfen zum Verlängern und Beenden">
      <figcaption><b>Abb.</b> &nbsp; Der laufende Timer.</figcaption>
    </figure>
  </div>
  <p>
    Solange der Timer läuft, zeigt das Telefon ihn als <b>Live-Aktivität</b>: auf dem
    Sperrbildschirm und, bei neueren iPhones, in der Dynamic Island oben am Rand,
    mit der verbleibenden Zeit als Ring. Sie müssen die App dafür nicht öffnen.
    Antippen führt direkt zur Alleinarbeit, wo Sie das Lebenszeichen geben. Nach
    dem Zurückmelden steht dort kurz «sicher beendet», nach einem abgelaufenen
    Timer «Alarm ausgelöst».
  </p>
  <ol class="schritte">
    <li>Tätigkeit eintragen &ndash; sie steht später im Alarm und sagt den Helfenden, wo sie suchen müssen.</li>
    <li>Dauer wählen. Lieber etwas kürzer: Verlängern geht jederzeit.</li>
    <li>
      Wählen, wer bei Ablauf alarmiert wird. Vorgewählt sind Schulsanität und Hausdienst
      an Ihrem Standort; Gruppen lassen sich an- und abwählen, und über
      <span class="ui">Zusätzlich einzelne Personen wählen</span> kommen bestimmte
      Kolleginnen oder Kollegen dazu, unabhängig von Gruppe und Standort. Die App zeigt,
      wie viele Personen das ergibt.
    </li>
    <li><span class="ui">Timer starten</span>.</li>
    <li>Zurück melden, sobald Sie fertig sind. <b>Das ist der wichtigste Schritt.</b></li>
  </ol>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Bitte nicht vergessen</p>
    <p>
      Ein vergessener Timer löst einen echten Alarm aus, und Kolleginnen und Kollegen
      machen sich unnötig auf den Weg. Melden Sie sich zurück, sobald Sie wieder in
      Gesellschaft sind. Ist es doch passiert, zeigt die Alleinarbeit oben
      <span class="ui">Mir geht es gut &ndash; Entwarnung senden</span>: Damit beenden
      Sie den Alarm selbst, und alle Alarmierten erhalten die Entwarnung.
    </p>
  </div>
</section>

<section id="c9">
  <h2 class="abschnitt"><span class="zahl">9</span> Notrufnummern</h2>
  <p>
    Alle wichtigen Nummern an einem Ort. Antippen ruft direkt an &ndash; das
    funktioniert auch, wenn sonst nichts mehr geht.
  </p>
  <figure class="geraet">
    <img src="bilder/app-11-notruf.webp" alt="Liste der Notrufnummern von Polizei bis Pro Juventute">
    <figcaption><b>Abb.</b> &nbsp; 117 Polizei &middot; 118 Feuerwehr &middot; 144 Sanität &middot; 112 europäischer Notruf &middot; 145 Tox Info Suisse &middot; 1414 Rega &middot; 143 Dargebotene Hand &middot; 147 Pro Juventute.</figcaption>
  </figure>
</section>

<section id="c10">
  <h2 class="abschnitt"><span class="zahl">10</span> Ihr Profil</h2>
  <p>
    Hier stehen Ihr Standort und Ihre Gruppen &ndash; sie entscheiden, welche Alarme
    Sie erreichen. Stimmt etwas nicht, melden Sie es der Schulleitung; ändern lässt es
    sich nur dort.
  </p>
  <p>
    Unter <span class="ui">Handbücher</span> finden Sie zudem die Handbücher zu Ihrer
    Rolle &ndash; sie öffnen im Browser und lassen sich von dort drucken oder sichern.
    Darunter zeigt <span class="ui">Push-Benachrichtigungen</span>, ob Mitteilungen auf
    diesem Gerät aktiv sind, und <span class="ui">Über diese App</span> die installierte
    Version.
  </p>
  <figure class="geraet">
    <img src="bilder/app-12-profil.webp" alt="Profilseite mit Name, Standort, Gruppen, Installationshinweis, Passwort ändern und Abmelden">
    <figcaption><b>Abb.</b> &nbsp; Das Profil. <span class="ui">Passwort ändern</span> steht Ihnen jederzeit offen.</figcaption>
  </figure>
</section>

<section id="c11">
  <h2 class="abschnitt"><span class="zahl">11</span> Häufige Fragen</h2>

  <h4>Ich kann mich nicht anmelden, obwohl alles stimmt.</h4>
  <p>
    Prüfen Sie den Umschalter oben: Er muss auf <span class="ui">Live</span> stehen.
    <span class="ui">Demo</span> ist ein Übungsbestand mit erfundenen Personen &ndash;
    Ihr Konto gibt es dort nicht.
  </p>

  <h4>Ich komme nicht ins Webportal.</h4>
  <p>
    Das ist richtig so. Das Portal ist der Schulleitung und dem Krisenstab vorbehalten.
    Für Mitarbeitende ist die App gedacht &ndash; sie enthält alles, was Sie brauchen.
  </p>

  <figure class="bild-breit">
    <img src="bilder/mit-01-kein-portal.webp" alt="Hinweisseite Kein Zugriff auf das Webportal mit dem Knopf App jetzt öffnen">
    <figcaption><b>Abb.</b> &nbsp; Diese Seite erscheint, wenn Sie das Portal am Rechner öffnen. Sie ist kein Fehler.</figcaption>
  </figure>

  <h4>Was ist der Unterschied zwischen einem Alarm und einem stillen Alarm?</h4>
  <p>
    Beide erreichen dieselben Personen und zeigen dieselben Schritte. Der normale
    Alarm klingelt &ndash; auch bei stummgeschaltetem Telefon und in Fokus-Modi. Der
    stille Alarm kommt ohne Ton und ohne Vibration und ist violett markiert. Er wird
    dort eingesetzt, wo Aufsehen schadet: herausforderndes Verhalten, verdächtige
    Person, Todesfall, Amok / Bedrohungslage. Das Szenario gibt die Voreinstellung vor.
  </p>

  <h4>Zwei Personen lösen dasselbe Ereignis aus. Was passiert?</h4>
  <p>
    Es bleibt bei einem Alarm. Die zweite Auslösung wird dem laufenden Alarm als
    «weitere Meldung» hinzugefügt; alle Empfänger sehen sie als Lagemeldung, und ein
    neu betroffener Standort wird zusätzlich alarmiert. Die App zeigt in Phase 1
    ausserdem einen Hinweis, sobald für dasselbe Ereignis schon ein Alarm läuft.
  </p>

  <h4>Ich habe keinen Empfang. Sehe ich noch etwas?</h4>
  <p>
    Ja. Die App behält den letzten Stand vom Alarmserver auf dem Gerät. Szenarien,
    Notrufnummern und die zuletzt bekannten Alarme bleiben lesbar; oben steht
    «getrennt». Sobald wieder Verbindung besteht, gleicht sie ab.
  </p>

  <h4>Ich habe mein Passwort vergessen.</h4>
  <p>
    Die Schulleitung setzt ein neues. Ein Zurücksetzen per E-Mail gibt es bewusst
    nicht.
  </p>

  <h4>Ich höre die Alarme nicht.</h4>
  <p>
    Prüfen Sie in den iPhone-Einstellungen unter
    <span class="ui">Mitteilungen &rsaquo; SOBE Notfall</span>, ob Mitteilungen
    erlaubt sind. Stille Alarme sind dagegen mit Absicht lautlos: Bei einer
    verdächtigen Person oder herausforderndem Verhalten schadet ein Ton.
  </p>

  <h4>Funktioniert die App ohne Empfang?</h4>
  <p>
    Alle Handlungsanweisungen sind auf dem Gerät gespeichert und jederzeit lesbar.
    Zum Alarmieren braucht es allerdings eine Verbindung &ndash; nutzen Sie dann die
    Notrufnummern, die über das Mobilnetz auch ohne Datenverbindung erreichbar sind.
  </p>

  <h4>Darf ich wirklich selbst alarmieren?</h4>
  <p>
    Ja. Jede angemeldete Person darf das, ohne Rückfrage. Im Zweifel lieber auslösen.
  </p>
</section>

</main>

<footer>
  <p>
    <b>SOBE Notfall &middot; Handbuch 3 von 4 &middot; Mitarbeitende.</b>
    Fragen zu Ihrem Konto, Ihrem Standort oder Ihren Gruppen beantwortet die Schulleitung.
  </p>
  <p>
    Die Bildschirmfotos stammen aus dem Demo-Modus. Angaben zu Rechtsgrundlagen in den
    Szenarien sind eine Orientierungshilfe und ersetzen keine Rechtsberatung.
  </p>
  {ADRESSE}
</footer>

</div>
"""
