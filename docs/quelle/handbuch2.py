# -*- coding: utf-8 -*-
TITEL = 'SOBE Handbuch Krisenstab'
TITELSEITE = dict(
    rolle='SOBE Notfall &middot; Handbuch 2 von 4',
    titel='Krisenstab',
    untertitel='Für die Mitglieder des Krisenstabs',
    vorspann='Sie werden aufgeboten, wenn ein Ereignis eine einzelne Lehrperson oder Gruppenleitung übersteigt. Dieses Handbuch zeigt, was Sie im Ernstfall auf dem Telefon und am Rechner tun &ndash; und was Sie zwischen den Ereignissen pflegen.',
)

KOERPER = r"""
<div class="blatt">

{TITELSEITE}

<nav class="inhalt" aria-label="Inhalt">
  <h2>Inhalt</h2>
  <ol>
    <li><a href="#b1"><span class="zahl">1</span> Ihre Rolle im System</a></li>
    <li><a href="#b2"><span class="zahl">2</span> Anmelden</a></li>
    <li><a href="#b3"><span class="zahl">3</span> Aufgeboten werden</a></li>
    <li><a href="#b4"><span class="zahl">4</span> Den Krisenstab einberufen</a></li>
    <li><a href="#b5"><span class="zahl">5</span> Einen Alarm auslösen</a></li>
    <li><a href="#b6"><span class="zahl">6</span> Die Alarmzentrale führen</a></li>
    <li><a href="#b7"><span class="zahl">7</span> Entwarnung geben</a></li>
    <li><a href="#b8"><span class="zahl">8</span> Was Sie vorbereiten dürfen</a></li>
    <li><a href="#b9"><span class="zahl">9</span> Was der Administration vorbehalten ist</a></li>
    <li><a href="#b10"><span class="zahl">10</span> Nach dem Ereignis</a></li>
    <li><a href="#b11"><span class="zahl">11</span> Wenn etwas nicht geht</a></li>
  </ol>
</nav>

<main>

<section id="b1">
  <h2 class="abschnitt"><span class="zahl">1</span> Ihre Rolle im System</h2>
  <p>
    Als Krisenstabsmitglied haben Sie beides: die App auf dem Telefon und Zugang zum
    Webportal. In der App handeln Sie vor Ort, im Portal führen Sie die Lage.
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>App und Portal im Vergleich</caption>
      <thead><tr><th>&nbsp;</th><th>App auf dem Telefon</th><th>Webportal am Rechner</th></tr></thead>
      <tbody>
        <tr><th scope="row">Wofür</th><td>handeln, während es passiert</td><td>führen, sobald Sie sitzen</td></tr>
        <tr><th scope="row">Alarm auslösen</th><td>ja, mit den Vorgaben des Szenarios</td><td>ja, frei einstellbar</td></tr>
        <tr><th scope="row">Wer hat quittiert</th><td>zusammengefasst</td><td>vollständig, pro Kanal</td></tr>
        <tr><th scope="row">Alarm beenden</th><td>ja, mit <span class="ui">Entwarnung geben</span></td><td>jeden Alarm, mit Hinweistext</td></tr>
        <tr><th scope="row">Lagemeldung senden</th><td>nein</td><td>ja, an alle Empfänger</td></tr>
        <tr><th scope="row">Journal</th><td>nein</td><td>ja, mit Zeitstempeln</td></tr>
      </tbody>
    </table>
  </div>
  <figure class="bild-breit">
    <img src="bilder/kri-01-dashboard.webp" alt="Das Webportal aus der Sicht eines Krisenstabsmitglieds">
    <figcaption><b>Abb.</b> &nbsp; Das Portal, wie Sie es sehen. Das Menü ist dasselbe wie für die Administration &ndash; welche Bereiche Sie ändern dürfen, steht in Abschnitt&nbsp;8 und&nbsp;9.</figcaption>
  </figure>
  <div class="hinweis">
    <p class="marke-klein">Faustregel</p>
    <p>
      Solange Sie unterwegs sind, genügt die App. Sobald Sie im Führungsraum sitzen,
      arbeiten Sie im Portal &ndash; dort sehen Sie, wer tatsächlich kommt.
    </p>
  </div>
  <p>
    Über <span class="ui">App-Vorschau</span> im Dashboard sehen Sie die App aus Sicht
    jeder erfassten Person: In der gelben Leiste <span class="ui">Vorschau als</span>
    wählen Sie die Person. So prüfen Sie, was etwa eine Ersthelferin in Menzingen bei
    einem Alarm zu sehen bekommt. Im Live-Betrieb ist das reine Ansicht; Aktionen sind
    dort gesperrt.
  </p>
</section>

<section id="b2">
  <h2 class="abschnitt"><span class="zahl">2</span> Anmelden</h2>
  <p>
    Portal und App teilen sich dasselbe Konto: Ihre E-Mail-Adresse und Ihr Passwort.
    Der Umschalter oben muss auf <span class="ui">Live</span> stehen &ndash;
    <span class="ui">Demo</span> ist ein getrennter Übungsbestand mit erfundenen Personen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-01-anmeldung.webp" alt="Anmeldemaske mit Umschalter zwischen Demo und Live">
    <figcaption><b>Abb.</b> &nbsp; Die Anmeldemaske. Wenn die Anmeldung mit richtigen Daten scheitert, steht dieser Umschalter fast immer falsch.</figcaption>
  </figure>
  <p>
    Beim ersten Mal verlangt das System ein eigenes Passwort. Danach melden Sie sich
    damit überall an &ndash; auch in der App.
  </p>
</section>

<section id="b3">
  <h2 class="abschnitt"><span class="zahl">3</span> Aufgeboten werden</h2>
  <p>
    Ein Aufgebot erreicht Sie als Push-Mitteilung; SMS und Sprachanruf sind in den
    Alarmplänen vorbereitet, aber noch nicht angebunden. In der App steht es zuoberst
    auf der Startseite. Tippen Sie
    die Mitteilung an, öffnet die App direkt die Handlungsanweisung zu diesem Alarm.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/app-02-alarm-empfangen.webp" alt="Startseite der App mit einem eingegangenen Alarm und den Knöpfen zum Quittieren">
      <figcaption><b>Abb.</b> &nbsp; Ein Aufgebot mit Quittierpflicht.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/app-03-empfaenger.webp" alt="Ansicht für Empfänger mit Alarmmeldung, Quittierung und den Schritten für Empfänger">
      <figcaption><b>Abb.</b> &nbsp; Die Ansicht für Empfänger: quittieren, dann die eigene Aufgabe.</figcaption>
    </figure>
  </div>
  <ol class="schritte">
    <li>
      <b>Sofort quittieren.</b> <span class="ui">Ich komme</span> oder
      <span class="ui">Nicht verfügbar</span> &ndash; beides hilft. Wer nicht antwortet,
      löst nach der hinterlegten Frist die nächste Eskalationsstufe aus.
    </li>
    <li>
      <b><span class="ui">Was jetzt zu tun ist</span> antippen.</b> Sie bekommen die
      Schritte für Empfänger &ndash; ohne Notruf und ohne erneute Auslösung, beides ist
      bereits geschehen. Die App filtert nach Ihren Gruppen: Als Krisenstabsmitglied
      sehen Sie Führungsraum beziehen, Rolle übernehmen, unterwegs keine Auskünfte
      &ndash; nicht die Schritte der Ersthelfer oder des Hausdiensts. Die lassen sich
      einblenden, wenn Sie wissen wollen, wer gerade was tut.
    </li>
    <li>
      <b>Losfahren oder zurückrufen.</b> Wer den Alarm ausgelöst hat, steht in der
      Meldung.
    </li>
  </ol>
  <p>
    Lagemeldungen des Krisenstabs, weitere Meldungen zum selben Ereignis und ein
    gemeldeter Fehlalarm erscheinen violett beziehungsweise gelb in der Alarmkarte,
    die neueste zuoberst, und kommen zusätzlich als Mitteilung. Als Krisenstabsmitglied
    können Sie einen erhaltenen Alarm auch in der App beenden:
    <span class="ui">Entwarnung geben</span> fragt nach einem Hinweis für die
    Empfänger, etwa zur Rückkehr.
  </p>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Stille Alarme</p>
    <p>
      Ein still ausgelöster Alarm kommt als Mitteilung ohne Ton und ohne Vibration an
      &ndash; sichtbar auf dem Sperrbildschirm, in der App violett gekennzeichnet. Das
      ist Absicht: bei herausforderndem Verhalten, einer verdächtigen Person, einem
      Todesfall oder einer Bedrohungslage schadet Aufsehen. Verhalten Sie sich
      entsprechend unauffällig. Der normale Alarm dagegen klingelt auch bei
      stummgeschaltetem Telefon.
    </p>
  </div>
</section>

<section id="b4">
  <h2 class="abschnitt"><span class="zahl">4</span> Den Krisenstab einberufen</h2>
  <p>
    Das Szenario <span class="ui">Krisenstab einberufen</span> ist Ihr eigener
    geführter Ablauf. Sie finden es in der App unter <span class="ui">Szenarien</span>.
  </p>
  <div class="geraet-reihe">
    <figure class="geraet">
      <img src="bilder/kri-03-app-phase1.webp" alt="Phase Alarmieren des Szenarios Krisenstab einberufen mit den Hinweisen, wann einberufen wird">
      <figcaption><b>Abb.</b> &nbsp; Phase 1 nennt die Kriterien für ein Aufgebot.</figcaption>
    </figure>
    <figure class="geraet">
      <img src="bilder/kri-04-app-krisenteam-aufbieten.webp" alt="Phase Informieren mit dem Knopf Krisenteam aufbieten und der Liste der Mitglieder">
      <figcaption><b>Abb.</b> &nbsp; Phase 3: aufbieten oder einzeln erreichen.</figcaption>
    </figure>
  </div>
  <h3>Wann einberufen wird</h3>
  <p>
    Bei jedem Ereignis, das eine einzelne Lehrperson oder Gruppenleitung überfordert,
    mehrere Standorte betrifft, Medieninteresse auslöst oder länger als einen Tag
    nachwirkt.
  </p>
  <h3>Wie aufgeboten wird</h3>
  <ol class="schritte">
    <li>
      <span class="ui">Krisenteam aufbieten</span> gedrückt halten. Jedes Mitglied
      erhält das Aufgebot mit Quittierung und meldet zurück, ob es kommt.
    </li>
    <li>
      Wer nicht quittiert, wird telefonisch nachgefasst. Die Liste darunter zeigt
      jedes Mitglied mit <span class="ui">Anrufen</span> und
      <span class="ui">SMS &amp; Push</span> einzeln.
    </li>
    <li>
      Die weiteren Phasen führen durch Führungsraum, Lagebeurteilung, Rollenverteilung,
      Journal und Sprachregelung.
    </li>
  </ol>
  <div class="hinweis hinweis--gut">
    <p class="marke-klein">Das Journal ab der ersten Minute</p>
    <p>
      Uhrzeit, Meldung, Entscheid, Auftrag, Erledigung &ndash; jeder Entscheid mit
      Zeitstempel. Das Portal protokolliert die Alarmierung automatisch mit; die
      Führungsentscheide gehören zusätzlich ins Wandprotokoll.
    </p>
  </div>
</section>

<section id="b5">
  <h2 class="abschnitt"><span class="zahl">5</span> Einen Alarm auslösen</h2>
  <p>
    Im Portal unter <span class="ui">Alarm auslösen</span> haben Sie mehr Einfluss als
    in der App: Sie wählen Empfänger, Kanäle und Eskalation frei. Von den Kanälen ist
    heute nur die Push-Mitteilung angebunden; die übrigen sind als «vorbereitet, noch
    nicht aktiv» gekennzeichnet.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-15-alarm-vorbereitet.webp" alt="Vorbereiteter Alarm mit gewähltem Szenario, Empfängern und Kanälen">
    <figcaption><b>Abb.</b> &nbsp; Ein vorbereiteter Alarm. Die Empfängerzahl über dem Auslöseknopf ist die wichtigste Angabe auf der Seite &ndash; prüfen Sie sie, bevor Sie halten.</figcaption>
  </figure>
  <p>
    Schneller geht es über einen Alarmplan: Er bringt Zielgruppen, Standorte, Kanäle
    und die Eskalationsstufen fertig eingestellt mit.
  </p>
  <figure class="bild-breit">
    <img src="bilder/kri-02-alarmplaene.webp" alt="Übersicht der Alarmpläne mit Zielgruppen, Kanälen und Eskalationsstufen">
    <figcaption><b>Abb.</b> &nbsp; Die vorbereiteten Alarmpläne mit ihren Eskalationsstufen.</figcaption>
  </figure>
  <div class="hinweis">
    <p class="marke-klein">Alle auslösenden Knöpfe wollen gehalten werden</p>
    <p>
      Ob im Portal oder in der App: Der Knopf reagiert erst nach gut einer Sekunde
      Halten. Ein Klick allein löst nichts aus.
    </p>
  </div>
  <p>
    In der App führt der rote Knopf <span class="ui">Alarm auslösen</span> oben rechts
    zur Auswahl des Ereignisses und direkt in die Phase «Alarmieren» des Szenarios.
  </p>
  <div class="hinweis">
    <p class="marke-klein">Wenn zwei Personen dasselbe auslösen</p>
    <p>
      Es bleibt bei einem Alarm. Läuft für das Szenario am selben Standort bereits
      einer, führt der Server die zweite Auslösung mit ihm zusammen: Die Meldung
      erscheint als «weitere Meldung» im Journal und bei allen Empfängern, ein neu
      betroffener Standort wird zusätzlich alarmiert. Quittierung und Entwarnung gibt
      es nur einmal. Die App weist die zweite Person vorher darauf hin.
    </p>
  </div>
  <h3>Übung</h3>
  <p>
    Unter <span class="ui">Anpassen</span> lässt sich ein Alarm als <b>Übung</b>
    kennzeichnen. Der Ablauf ist derselbe, aber jede Mitteilung trägt den Vorspann
    «ÜBUNG», die App zeigt den Alarm gelb, das Protokoll führt ihn getrennt, und
    Webhooks an Drittsysteme bleiben stumm. So üben Sie die Räumung, ohne dass jemand
    einen Ernstfall vermutet.
  </p>
</section>

<section id="b6">
  <h2 class="abschnitt"><span class="zahl">6</span> Die Alarmzentrale führen</h2>
  <p>
    Läuft ein Alarm, erscheint oben ein roter Balken. Die Alarmzentrale ist Ihr
    Lagebild: Wen hat der Alarm erreicht, wer kommt, was ist wann geschehen.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-17-alarmzentrale-aktiv.webp" alt="Alarmzentrale mit aktivem Alarm, Empfängerliste mit Zustellstatus und Journal">
    <figcaption><b>Abb.</b> &nbsp; Links jede Person mit dem Status pro Kanal, rechts das Journal. Ein Alarm ohne Rückmeldungen ist ein Alarm, der niemanden erreicht hat &ndash; fassen Sie dann telefonisch nach.</figcaption>
  </figure>
  <h3>Lagemeldungen</h3>
  <p>
    Unter jedem aktiven Alarm steht ein Eingabefeld: Was Sie dort senden, erreicht alle
    Empfänger als Mitteilung und steht in ihrer Handlungsanweisung zuoberst &ndash;
    «Sammelplatz Ost gesperrt, bitte Nord», «Sanität ist eingetroffen». Das ersetzt
    den zweiten Alarm und den Rundruf.
  </p>
  <h3>Worauf Sie achten</h3>
  <ul>
    <li><b>Zustellung</b> heisst: das Gerät hat die Mitteilung bestätigt &ndash; der Push-Dienst meldet den Empfang zurück. Ohne registriertes Gerät steht «fehlgeschlagen».</li>
    <li><b>Quittierung</b> heisst: ein Mensch hat sie gesehen und geantwortet. Nur darauf können Sie disponieren.</li>
    <li><b>Eskalationsstufen</b> greifen automatisch, wenn niemand quittiert. Im Journal ist zu sehen, wann welche Stufe ausgelöst hat.</li>
  </ul>
</section>

<section id="b7">
  <h2 class="abschnitt"><span class="zahl">7</span> Entwarnung geben</h2>
  <p>
    Der Knopf <span class="ui">Beenden</span> in der Alarmzentrale schliesst einen
    Alarm ab und versendet die Entwarnung an alle Empfänger. Diese Berechtigung haben
    nur Krisenstab und Administration &ndash; Mitarbeitende können einen Alarm nicht
    beenden.
  </p>
  <p>
    <span class="ui">Beenden</span> fragt nach einem Hinweis für die Empfänger, etwa
    «Rückkehr ab 10:30 über den Haupteingang». Er geht mit der Entwarnung mit und steht
    in der App über den Schritten. Die Entwarnung ist eine eigene Push-Mitteilung. Wer
    sie antippt, sieht die Schritte <b>Nach der Entwarnung</b> des Szenarios: Rückkehr
    erst nach Freigabe, erneut zählen, Vorfall festhalten, Nachsorge. Nach einem stillen
    Alarm bleibt auch die Entwarnung ohne Ton.
  </p>
  <p>
    Meldet die auslösende Person einen Fehlalarm, erscheint in der Alarmzentrale die
    Kennzeichnung <span class="ui">Fehlalarm gemeldet</span>, und der Krisenstab erhält
    die Meldung als Mitteilung. Prüfen Sie kurz nach und beenden Sie dann &ndash;
    Mitarbeitende können nur ihren eigenen SOS-Alarm selbst beenden.
  </p>
  <figure class="geraet">
    <img src="bilder/app-17-entwarnung.webp" alt="Ansicht Entwarnung in der App mit der beendeten Alarmmeldung und den Schritten nach der Entwarnung">
    <figcaption><b>Abb.</b> &nbsp; Das sehen die Alarmierten, wenn Sie beenden.</figcaption>
  </figure>
  <div class="hinweis hinweis--stopp">
    <p class="marke-klein">Erst prüfen, dann beenden</p>
    <p>
      Der Zeitpunkt der Entwarnung wird protokolliert und gilt später als Beleg dafür,
      wann die Lage als abgeschlossen beurteilt wurde. Beenden Sie einen Alarm nicht,
      um die Anzeige aufzuräumen.
    </p>
  </div>
</section>

<section id="b8">
  <h2 class="abschnitt"><span class="zahl">8</span> Was Sie vorbereiten dürfen</h2>
  <p>
    Zwischen den Ereignissen pflegen Sie die Inhalte, mit denen im Ernstfall gearbeitet
    wird. Vier Bereiche stehen Ihnen offen:
  </p>
  <div class="tabelle-huelle">
    <table>
      <caption>Ihre Zuständigkeit in der Vorbereitung</caption>
      <thead><tr><th>Bereich</th><th>Was Sie dort tun</th></tr></thead>
      <tbody>
        <tr><td><b>Szenarien &amp; Checklisten</b></td><td>Abläufe schreiben und aktuell halten, Szenarien ein- und ausblenden</td></tr>
        <tr><td><b>Alarmpläne</b></td><td>Zielgruppen, Kanäle und Eskalationszeiten festlegen</td></tr>
        <tr><td><b>Notfallkontakte</b></td><td>Nummern pflegen, die in der App als Anrufknöpfe erscheinen</td></tr>
        <tr><td><b>Alarmknöpfe</b></td><td>Knöpfe benennen, zuordnen, Batteriestand im Blick behalten</td></tr>
      </tbody>
    </table>
  </div>
  <figure class="bild-breit">
    <img src="bilder/web-19-szenario-editor.webp" alt="Bearbeitungsdialog eines Szenarios mit den Feldern für Alarmieren, Sofortmassnahmen, weiterführende Massnahmen, Checkliste und Rechtsgrundlagen">
    <figcaption><b>Abb.</b> &nbsp; Der Szenario-Editor. Ein Punkt pro Zeile; leere Zeilen werden beim Speichern verworfen.</figcaption>
  </figure>
  <div class="hinweis hinweis--warnung">
    <p class="marke-klein">Die häufigste Falle beim Schreiben</p>
    <p>
      Schreiben Sie das Alarmieren nicht in die Sofortmassnahmen. Dafür gibt es das
      eigene Feld ganz oben, das die erste Phase des geführten Ablaufs füllt. Steht
      «144 anrufen» zusätzlich als Schritt 3 der Sofortmassnahmen, widerspricht sich
      die Reihenfolge auf dem Telefon.
    </p>
  </div>
</section>

<section id="b9">
  <h2 class="abschnitt"><span class="zahl">9</span> Was der Administration vorbehalten ist</h2>
  <p>
    Diese Bereiche sehen Sie zwar im Menü, dürfen sie aber nicht ändern:
    <b>Benutzer</b>, <b>Gruppen &amp; Krisenteams</b>, <b>Standorte</b> und
    <b>Integrationen</b>. Auch der Knopf <span class="ui">Aktualisierung</span> ist der
    Administration vorbehalten.
  </p>
  <div class="hinweis">
    <p class="marke-klein">So merken Sie es</p>
    <p>
      Sie können die Seite öffnen und Felder ausfüllen &ndash; beim Speichern lehnt der
      Alarmserver ab und meldet «Diese Aktion ist Administratoren vorbehalten».
      Nichts geht dabei kaputt; die Änderung wird schlicht nicht übernommen.
    </p>
  </div>
  <p>
    Wenden Sie sich an die Schulleitung, wenn jemand ins Krisenteam aufgenommen,
    ein Konto angelegt oder ein Standort ergänzt werden muss.
  </p>
</section>

<section id="b10">
  <h2 class="abschnitt"><span class="zahl">10</span> Nach dem Ereignis</h2>
  <p>
    Jede Auslösung, jede Quittierung und jede Entwarnung steht mit Zeitstempel und
    Namen im Ereignisprotokoll. Es lässt sich nicht bearbeiten &ndash; genau das macht
    es als Nachweis brauchbar.
  </p>
  <figure class="bild-breit">
    <img src="bilder/web-14-protokoll.webp" alt="Ereignisprotokoll mit Einträgen nach Zeit sortiert">
    <figcaption><b>Abb.</b> &nbsp; Das Ereignisprotokoll als Grundlage für die Auswertung.</figcaption>
  </figure>
  <p>
    Werten Sie innert zweier Wochen mit allen Beteiligten aus und arbeiten Sie die
    Erkenntnisse dort ein, wo sie beim nächsten Mal wirken: in die Szenarien, die
    Alarmpläne und die Gruppenzusammensetzung.
  </p>
</section>

<section id="b11">
  <h2 class="abschnitt"><span class="zahl">11</span> Wenn etwas nicht geht</h2>

  <h4>Die Anmeldung scheitert mit richtigen Daten</h4>
  <p>
    Der Umschalter steht auf <span class="ui">Demo</span> statt auf
    <span class="ui">Live</span>. Die beiden Bestände haben getrennte Konten.
  </p>

  <h4>Speichern wird abgelehnt</h4>
  <p>
    Sie sind in einem Bereich, der der Administration vorbehalten ist &ndash; siehe
    Abschnitt&nbsp;9. Die Meldung nennt den Grund.
  </p>

  <h4>Ein Aufgebot kam nicht an</h4>
  <p>
    Prüfen Sie in der Alarmzentrale, ob die Person überhaupt als Empfängerin geführt
    wurde. Fehlt sie in der Liste, stimmt die Gruppenzugehörigkeit nicht &ndash; das
    korrigiert die Administration.
  </p>

  <h4>Der Alarm war zu leise</h4>
  <p>
    Die App verlangt beim ersten Start die Erlaubnis für Mitteilungen. Wurde sie
    verweigert, lässt sie sich in den iPhone-Einstellungen unter
    <span class="ui">Mitteilungen &rsaquo; SOBE Notfall</span> nachträglich erteilen.
  </p>
</section>

</main>

<footer>
  <p>
    <b>SOBE Notfall &middot; Handbuch 2 von 4 &middot; Krisenstab.</b>
    Für die Systemverwaltung gilt Handbuch 1, für Mitarbeitende Handbuch 3.
  </p>
  <p>
    Die Bildschirmfotos stammen aus dem Demo-Modus. Angaben zu Rechtsgrundlagen in den
    Szenarien sind eine Orientierungshilfe und ersetzen keine Rechtsberatung.
  </p>
  {ADRESSE}
</footer>

</div>
"""
