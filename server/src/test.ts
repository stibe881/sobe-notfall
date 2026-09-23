/**
 * Integrationstest gegen die laufende API.
 *
 * Der Testserver muss mit dem Sonnenberg-Erstbefüllungsprofil laufen – die
 * Prüfungen erwarten dessen Standorte und Alarmpläne:
 *   PORT=3099 SOBE_SEED_PROFILE=sonnenberg SOBE_DB_PATH=/tmp/sobe-test.sqlite npm run dev
 * Aufruf: SOBE_TEST_URL=http://localhost:3099 npx tsx src/test.ts
 */
const BASIS = process.env.SOBE_TEST_URL ?? 'http://localhost:3099'
const ERSTPASSWORT = process.env.SOBE_ADMIN_PASSWORD ?? 'SOBE-Start2026!'
const ADMIN_MAIL = process.env.SOBE_ADMIN_EMAIL ?? 'admin@sobe-notfall.local'

let bestanden = 0
let gescheitert = 0
function pruefe(name: string, bedingung: boolean, zusatz = ''): void {
  if (bedingung) {
    bestanden++
    console.log('OK   ' + name)
  } else {
    gescheitert++
    console.log('FEHL ' + name + (zusatz ? ' – ' + zusatz : ''))
  }
}

async function ruf(pfad: string, optionen: RequestInit & { token?: string } = {}): Promise<{ status: number; body: any }> {
  const { token, ...rest } = optionen
  const antwort = await fetch(BASIS + '/api' + pfad, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  })
  const text = await antwort.text()
  return { status: antwort.status, body: text ? JSON.parse(text) : null }
}

async function main(): Promise<void> {
  // --- Anmeldung ---
  const falsch = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_MAIL, password: 'falsch123' }) })
  pruefe('falsches Passwort wird abgelehnt', falsch.status === 401)

  const unbekannt = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'niemand@example.ch', password: 'falsch123' }) })
  pruefe('gleiche Meldung für unbekanntes Konto', unbekannt.status === 401 && unbekannt.body.error === falsch.body.error)

  const an = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_MAIL, password: ERSTPASSWORT }) })
  pruefe('Anmeldung mit Erstpasswort', an.status === 200 && Boolean(an.body.token))
  const adminToken: string = an.body.token
  pruefe('Passwortwechsel wird verlangt', an.body.user.mustChangePassword === true)
  pruefe('Antwort enthält keine Passwortdaten', !('passwordHash' in an.body.user) && !('passwordSalt' in an.body.user))

  const grossKlein = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_MAIL.toUpperCase(), password: ERSTPASSWORT }) })
  pruefe('E-Mail ohne Beachtung der Gross-/Kleinschreibung', grossKlein.status === 200)

  // --- Zugriffsschutz ---
  const ohne = await ruf('/state')
  pruefe('Datenbestand ohne Anmeldung gesperrt', ohne.status === 401)
  const falscherToken = await ruf('/state', { token: 'a'.repeat(64) })
  pruefe('erfundenes Token wird abgelehnt', falscherToken.status === 401)

  // --- Datenbestand ---
  const stand = await ruf('/state', { token: adminToken })
  pruefe('Datenbestand abrufbar', stand.status === 200)
  pruefe('23 Szenarien vorhanden', stand.body.scenarios.length === 23, `gefunden: ${stand.body.scenarios?.length}`)
  pruefe('3 Standorte vorhanden', stand.body.locations.length === 3)
  pruefe('7 Gruppen vorhanden', stand.body.groups.length === 7)
  pruefe('Notrufnummern vorhanden', stand.body.contacts.length === 8)
  pruefe('frischer Bestand enthält nur das Administratorkonto', stand.body.users.length === 1)
  pruefe('Benutzerliste ohne Passwortdaten', stand.body.users.every((u: any) => !('passwordHash' in u)))

  // --- Ablauf der Szenarien: Alarmieren steht in callGuidance, nicht in den Sofortmassnahmen ---
  const aktive = stand.body.scenarios.filter((s: any) => s.active !== false)
  pruefe('12 Szenarien für Mitarbeitende freigegeben', aktive.length === 12, `gefunden: ${aktive.length}`)
  pruefe('Alarmpläne verweisen nur auf freigegebene Szenarien',
    stand.body.plans.every((p: any) => !p.scenarioId || aktive.some((s: any) => s.id === p.scenarioId)),
    stand.body.plans.filter((p: any) => p.scenarioId && !aktive.some((s: any) => s.id === p.scenarioId)).map((p: any) => p.id).join(', '))
  pruefe('Amok / Bedrohungslage ist freigegeben und still', aktive.some((s: any) => s.id === 'sc-amok' && s.silentDefault === true))
  pruefe('jedes freigegebene Szenario hat Hinweise zum Alarmieren',
    aktive.every((s: any) => Array.isArray(s.callGuidance) && s.callGuidance.length > 0),
    aktive.filter((s: any) => !s.callGuidance?.length).map((s: any) => s.id).join(', '))

  // Der geführte Ablauf beginnt mit «Alarmieren». Stünde derselbe Schritt noch
  // einmal in den Sofortmassnahmen, widerspräche sich die Reihenfolge.
  const alarmSchritte = aktive.flatMap((s: any) =>
    s.instructions
      .filter((i: string) => /(Alarm|Aufgebot) in der App|alarmieren:|144 alarmieren|118 alarmieren|117 anrufen|145 anrufen/i.test(i))
      .map((i: string) => `${s.id}: ${i.slice(0, 60)}`),
  )
  pruefe('keine Alarmierungsschritte in den Sofortmassnahmen', alarmSchritte.length === 0, alarmSchritte.join(' | '))

  // Wer einen Alarm erhält, hat ihn nicht entdeckt: Für ihn gilt ein eigener
  // Ablauf ohne Notruf und ohne erneute Auslösung.
  pruefe('jedes freigegebene Szenario hat Schritte für Empfänger:innen',
    aktive.every((s: any) => Array.isArray(s.responseSteps) && s.responseSteps.length >= 3),
    aktive.filter((s: any) => (s.responseSteps?.length ?? 0) < 3).map((s: any) => s.id).join(', '))
  const empfaengerLoest = aktive.flatMap((s: any) =>
    (s.responseSteps ?? [])
      .filter((st: any) => /Alarm in der App auslösen|Aufgebot in der App|(118|144) (anrufen|alarmieren)/i.test(st.text))
      .map((st: any) => `${s.id}: ${st.text.slice(0, 60)}`),
  )
  pruefe('Empfänger:innen werden nicht zum erneuten Alarmieren angehalten', empfaengerLoest.length === 0, empfaengerLoest.join(' | '))

  // Gruppenzuordnung: Jede genannte Gruppe muss existieren, und jedes Szenario
  // braucht mindestens einen Schritt, der für alle gilt - sonst stünde jemand
  // ohne Gruppe vor einer leeren Seite.
  const gruppenIds = new Set(stand.body.groups.map((g: any) => g.id))
  const fremdeGruppen = aktive.flatMap((s: any) =>
    (s.responseSteps ?? []).flatMap((st: any) => (st.groupIds ?? []).filter((g: string) => !gruppenIds.has(g)).map((g: string) => `${s.id}: ${g}`)),
  )
  pruefe('Empfängerschritte verweisen nur auf vorhandene Gruppen', fremdeGruppen.length === 0, fremdeGruppen.join(', '))
  const ohneAllgemein = aktive.filter((s: any) => !(s.responseSteps ?? []).some((st: any) => !st.groupIds?.length)).map((s: any) => s.id)
  pruefe('jedes Szenario hat mindestens einen Schritt für alle Empfänger:innen', ohneAllgemein.length === 0, ohneAllgemein.join(', '))

  // Mit der Entwarnung kommt eine zweite Mitteilung – sie braucht Inhalt
  pruefe('jedes freigegebene Szenario hat Schritte nach der Entwarnung',
    aktive.every((s: any) => Array.isArray(s.allClearSteps) && s.allClearSteps.length >= 3),
    aktive.filter((s: any) => (s.allClearSteps?.length ?? 0) < 3).map((s: any) => s.id).join(', '))
  pruefe('interne Notfallnummer hinterlegt', stand.body.integrations?.hotline?.number === '+41 41 767 49 48',
    String(stand.body.integrations?.hotline?.number))

  // --- Passwortwechsel ---
  const zuKurz = await ruf('/auth/password', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ currentPassword: ERSTPASSWORT, newPassword: 'kurz1' }),
  })
  pruefe('zu kurzes Passwort abgelehnt', zuKurz.status === 400)

  const falschesAlt = await ruf('/auth/password', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ currentPassword: 'stimmtnicht1', newPassword: 'Baar2026sicher' }),
  })
  pruefe('falsches aktuelles Passwort abgelehnt', falschesAlt.status === 400)

  const gewechselt = await ruf('/auth/password', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ currentPassword: ERSTPASSWORT, newPassword: 'Baar2026sicher' }),
  })
  pruefe('Passwort geändert', gewechselt.status === 200)
  pruefe('altes Passwort gilt nicht mehr',
    (await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_MAIL, password: ERSTPASSWORT }) })).status === 401)
  const neuAn = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_MAIL, password: 'Baar2026sicher' }) })
  pruefe('neues Passwort gilt', neuAn.status === 200 && neuAn.body.user.mustChangePassword === false)
  pruefe('eigene Sitzung bleibt nach Wechsel gültig', (await ruf('/auth/me', { token: adminToken })).status === 200)

  // --- Benutzerverwaltung ---
  const angelegt = await ruf('/users', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      firstName: 'Peter', lastName: 'Muster', email: 'peter.muster@sonnenberg-baar.ch',
      role: 'mitarbeiter', groupIds: ['gr-alle', 'gr-ersthelfer'], locationId: 'loc-baar',
      password: 'Muster2026', mustChangePassword: false,
    }),
  })
  pruefe('Konto angelegt', angelegt.status === 200)
  const peterId: string = angelegt.body.user.id

  const doppelt = await ruf('/users', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ firstName: 'Andere', lastName: 'Person', email: 'PETER.muster@sonnenberg-baar.ch', role: 'mitarbeiter' }),
  })
  pruefe('doppelte E-Mail-Adresse abgelehnt', doppelt.status === 400)

  const peterAn = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'peter.muster@sonnenberg-baar.ch', password: 'Muster2026' }) })
  pruefe('neu angelegtes Konto kann sich anmelden', peterAn.status === 200)
  const peterToken: string = peterAn.body.token

  const ohnePasswort = await ruf('/users', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ firstName: 'Ohne', lastName: 'Passwort', email: 'ohne@sonnenberg-baar.ch', role: 'mitarbeiter' }),
  })
  pruefe('Konto ohne Passwort anlegbar', ohnePasswort.status === 200 && ohnePasswort.body.user.hasPassword === false)
  pruefe('ohne Passwort keine Anmeldung',
    (await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ohne@sonnenberg-baar.ch', password: 'egal1234' }) })).status === 401)

  // --- Rechte ---
  const fremdAnlage = await ruf('/users', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({ firstName: 'Heimlich', lastName: 'Admin', email: 'heimlich@x.ch', role: 'admin' }),
  })
  pruefe('Mitarbeitende dürfen keine Konten anlegen', fremdAnlage.status === 403)
  pruefe('Mitarbeitende dürfen keine Szenarien ändern',
    (await ruf('/scenarios', { method: 'POST', token: peterToken, body: JSON.stringify({ id: 'sc-brand', title: 'Manipuliert' }) })).status === 403)
  pruefe('Mitarbeitende sehen den Datenbestand', (await ruf('/state', { token: peterToken })).status === 200)

  // --- Letzter Administrator ---
  const admins = (await ruf('/state', { token: adminToken })).body.users.filter((u: any) => u.role === 'admin')
  pruefe('genau ein Administrator vorhanden', admins.length === 1)
  pruefe('letztes Administrationskonto nicht löschbar',
    (await ruf(`/users/${admins[0].id}`, { method: 'DELETE', token: adminToken })).status === 400)
  pruefe('letztes Administrationskonto nicht herabstufbar',
    (await ruf('/users', { method: 'POST', token: adminToken, body: JSON.stringify({ ...admins[0], role: 'mitarbeiter' }) })).status === 400)

  // --- Alarm ---
  const alarm = await ruf('/alarms', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({
      scenarioId: 'sc-medizin', message: 'Testalarm: Sturz im Treppenhaus', silent: false,
      requireAck: true, channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-baar'], triggeredVia: 'app',
    }),
  })
  pruefe('Alarm ausgelöst', alarm.status === 200 && alarm.body.alarm.status === 'active')
  const alarmId: string = alarm.body.alarm.id
  pruefe('Empfänger:innen wurden aufgelöst', alarm.body.alarm.deliveries.length > 0)
  pruefe('Antwort nennt, ob zusammengeführt wurde', alarm.body.merged === false)

  // --- Zweite Auslösung zum selben Ereignis wird zusammengeführt ---
  const zweite = await ruf('/alarms', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      scenarioId: 'sc-medizin', message: 'Zweite Meldung: Person ist ansprechbar', silent: false,
      requireAck: true, channels: ['push'], groupIds: ['gr-alle'], locationIds: ['loc-baar'], triggeredVia: 'web',
    }),
  })
  pruefe('zweite Auslösung wird zusammengeführt', zweite.status === 200 && zweite.body.merged === true && zweite.body.alarm.id === alarmId)
  pruefe('weitere Meldung steht beim laufenden Alarm',
    (zweite.body.alarm.updates ?? []).some((u: any) => u.kind === 'meldung' && u.message.includes('Person ist ansprechbar')))
  const aktiveAlarme = (await ruf('/state', { token: adminToken })).body.alarms.filter((a: any) => a.status === 'active')
  pruefe('kein zweiter Alarm angelegt', aktiveAlarme.length === 1, `aktiv: ${aktiveAlarme.length}`)

  // --- Lagemeldung und Fehlalarm ---
  const lage = await ruf(`/alarms/${alarmId}/update`, { method: 'POST', token: adminToken, body: JSON.stringify({ message: 'Sanität ist eingetroffen.' }) })
  pruefe('Krisenstab/Administration kann Lagemeldungen senden', lage.status === 200 && lage.body.alarm.updates.some((u: any) => u.kind === 'lage'))
  pruefe('Mitarbeitende können keine Lagemeldung senden',
    (await ruf(`/alarms/${alarmId}/update`, { method: 'POST', token: peterToken, body: JSON.stringify({ message: 'x' }) })).status === 403)
  const fehl = await ruf(`/alarms/${alarmId}/update`, { method: 'POST', token: peterToken, body: JSON.stringify({ kind: 'fehlalarm', message: 'War nur ein Sturz ohne Verletzung' }) })
  pruefe('Auslösende Person kann Fehlalarm melden', fehl.status === 200 && fehl.body.alarm.updates.some((u: any) => u.kind === 'fehlalarm'))

  const quittiert = await ruf(`/alarms/${alarmId}/ack`, { method: 'POST', token: peterToken, body: JSON.stringify({ ack: 'acknowledged' }) })
  pruefe('Quittierung gespeichert', quittiert.body.alarm.deliveries.some((d: any) => d.userId === peterId && d.ack === 'acknowledged'))

  pruefe('Mitarbeitende dürfen Alarme nicht beenden',
    (await ruf(`/alarms/${alarmId}/end`, { method: 'POST', token: peterToken })).status === 403)
  const beendet = await ruf(`/alarms/${alarmId}/end`, { method: 'POST', token: adminToken, body: JSON.stringify({ note: 'Rückkehr ab 10:30 über den Haupteingang.' }) })
  pruefe('Administration beendet den Alarm', beendet.status === 200 && beendet.body.alarm.status === 'ended')
  pruefe('Entwarnung trägt den Text mit', beendet.body.alarm.endNote === 'Rückkehr ab 10:30 über den Haupteingang.')
  pruefe('Lagemeldung auf beendetem Alarm wird abgewiesen',
    (await ruf(`/alarms/${alarmId}/update`, { method: 'POST', token: adminToken, body: JSON.stringify({ message: 'zu spät' }) })).status === 409)

  // --- Eigener SOS-Alarm darf selbst beendet werden ---
  const sos = await ruf('/alarms', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({
      scenarioId: 'sc-sos', message: 'SOS-Alarm von Peter Muster (App) – Standort: Hauptsitz Baar', silent: false,
      requireAck: true, channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-baar'], triggeredVia: 'app',
    }),
  })
  pruefe('SOS-Alarm ausgelöst', sos.status === 200 && sos.body.merged === false)
  pruefe('Auslösende Person beendet den eigenen SOS-Alarm',
    (await ruf(`/alarms/${sos.body.alarm.id}/end`, { method: 'POST', token: peterToken })).status === 200)

  // --- Abgelaufener Alleinarbeits-Timer: die betroffene Person darf selbst entwarnen ---
  const timerAlarm = await ruf('/alarms', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({
      scenarioId: 'sc-medizin', message: 'ALLEINARBEIT: Timer von Peter Muster abgelaufen (Kontrollgang). Keine Rückmeldung – bitte sofort prüfen!',
      requireAck: true, channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-baar'], triggeredVia: 'timer',
    }),
  })
  pruefe('Alleinarbeits-Alarm angelegt', timerAlarm.status === 200)
  const selbstEntwarnt = await ruf(`/alarms/${timerAlarm.body.alarm.id}/end`, { method: 'POST', token: peterToken, body: JSON.stringify({ note: 'Mir geht es gut – Timer vergessen.' }) })
  pruefe('Betroffene Person entwarnt den eigenen Alleinarbeits-Alarm', selbstEntwarnt.status === 200 && selbstEntwarnt.body.alarm.endNote === 'Mir geht es gut – Timer vergessen.')

  // --- Übung ---
  const uebung = await ruf('/alarms', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      scenarioId: 'sc-evak', message: 'Räumungsübung Hauptsitz', drill: true,
      requireAck: true, channels: ['push'], groupIds: ['gr-alle'], locationIds: ['loc-baar'], triggeredVia: 'web',
    }),
  })
  pruefe('Übung wird als solche gespeichert', uebung.status === 200 && uebung.body.alarm.drill === true)
  const protokoll = (await ruf('/state', { token: adminToken })).body.audit
  pruefe('Übung im Protokoll gekennzeichnet', protokoll.some((e: any) => e.message.startsWith('ÜBUNG: Alarm ausgelöst')))
  pruefe('Übung beendet', (await ruf(`/alarms/${uebung.body.alarm.id}/end`, { method: 'POST', token: adminToken })).status === 200)

  // --- Bereitschaft ---
  const bereit = await ruf('/bereitschaft', { token: adminToken })
  pruefe('Bereitschaftsübersicht abrufbar', bereit.status === 200 && Array.isArray(bereit.body.standorte) && bereit.body.standorte.length === 3)
  pruefe('Bereitschaft nennt Personen ohne Gerät', Array.isArray(bereit.body.ohneGeraet))
  pruefe('Bereitschaft ist Führung vorbehalten', (await ruf('/bereitschaft', { token: peterToken })).status === 403)
  pruefe('Testmeldung auslösbar', (await ruf('/bereitschaft/testpush', { method: 'POST', token: adminToken })).status === 200)

  // --- Gemeinsamer Datenbestand: das eigentliche Ziel ---
  const standPeter = await ruf('/state', { token: peterToken })
  pruefe('App sieht die im Portal angelegten Konten',
    standPeter.body.users.some((u: any) => u.email === 'peter.muster@sonnenberg-baar.ch'))
  pruefe('App sieht den beendeten Alarm', standPeter.body.alarms.some((a: any) => a.id === alarmId && a.status === 'ended'))

  // --- Alleinarbeit ---
  const timer = await ruf('/lone-work', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({ activity: 'Kontrollgang', durationMin: 30, locationId: 'loc-baar', alertGroupIds: ['gr-krisenstab'], alertUserIds: [peterId] }),
  })
  pruefe('Alleinarbeits-Timer gestartet', timer.status === 200 && timer.body.session.status === 'running')
  pruefe('Empfänger:innen bei Ablauf werden gespeichert',
    JSON.stringify(timer.body.session.alertGroupIds) === '["gr-krisenstab"]' && JSON.stringify(timer.body.session.alertUserIds) === JSON.stringify([peterId]))
  const verlaengert = await ruf(`/lone-work/${timer.body.session.id}/extend`, { method: 'POST', token: peterToken, body: JSON.stringify({ minutes: 20 }) })
  pruefe('Timer verlängert', verlaengert.body.session.expiresAt > timer.body.session.expiresAt)
  pruefe('Timer beendet', (await ruf(`/lone-work/${timer.body.session.id}/complete`, { method: 'POST', token: peterToken })).status === 200)

  // --- Push-Registrierung ---
  pruefe('ungültiges Push-Token abgelehnt',
    (await ruf('/push/register', { method: 'POST', token: peterToken, body: JSON.stringify({ token: 'kaputt' }) })).status === 400)
  pruefe('gültiges Push-Token angenommen',
    (await ruf('/push/register', { method: 'POST', token: peterToken, body: JSON.stringify({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' }) })).status === 200)

  // --- Integrationen: Geheimnisse, Verbindungstests ---
  const integStand = (await ruf('/state', { token: adminToken })).body.integrations
  pruefe('Integrationen kennen Telefonie und LoRaWAN', Boolean(integStand.telephony) && Boolean(integStand.lorawan))
  pruefe('Integrationen speichern ist der Administration vorbehalten',
    (await ruf('/integrations', { method: 'POST', token: peterToken, body: JSON.stringify(integStand) })).status === 403)

  const mitGeheimnis = {
    ...integStand,
    smsGateway: { ...integStand.smsGateway, enabled: true, provider: 'ecall', username: 'sob', password: 'streng-geheim' },
    lorawan: { ...integStand.lorawan, enabled: true },
  }
  pruefe('Integrationen gespeichert',
    (await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify(mitGeheimnis) })).status === 200)
  const maskiert = (await ruf('/state', { token: adminToken })).body.integrations
  pruefe('Geheimnis erscheint im Datenbestand nur maskiert', maskiert.smsGateway.password === '••••••••',
    String(maskiert.smsGateway.password))
  pruefe('Teams-Test ohne Webhook-URL sauber abgewiesen',
    (await ruf('/integrations/teams/test', { method: 'POST', token: adminToken })).status === 400)
  pruefe('Telefonie-Test ohne Konfiguration sauber abgewiesen',
    (await ruf('/integrations/telephony/test', { method: 'POST', token: adminToken })).status === 400)

  // --- LoRaWAN: Endpunkt, Token, Alarmknopf ---
  const lwToken = await ruf('/integrations/lorawan/token', { method: 'POST', token: adminToken })
  pruefe('LoRaWAN-Token erzeugt', lwToken.status === 200 && String(lwToken.body.token).startsWith('lw_'))
  const lwInfo = await ruf('/integrations/lorawan', { token: adminToken })
  pruefe('Endpunkt-Auskunft liefert Adresse und Token',
    lwInfo.status === 200 && lwInfo.body.token === lwToken.body.token && String(lwInfo.body.url).endsWith('/api/hooks/lorawan'))
  pruefe('Endpunkt-Auskunft ist der Administration vorbehalten',
    (await ruf('/integrations/lorawan', { token: peterToken })).status === 403)

  const maskiertesZurueck = (await ruf('/state', { token: adminToken })).body.integrations
  pruefe('LoRaWAN-Token im Datenbestand maskiert', maskiertesZurueck.lorawan.token === '••••••••')
  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify(maskiertesZurueck) })
  pruefe('maskiertes Geheimnis überschreibt das gespeicherte nicht',
    (await ruf('/integrations/lorawan', { token: adminToken })).body.token === lwToken.body.token)

  const knopf = await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      name: 'Testknopf Empfang', type: 'lorawan', serial: 'LW-TEST-99', batteryPct: 100, lastSeen: Date.now(),
      messageTemplate: 'Alarmknopf Test ausgelöst', targetGroupIds: ['gr-ersthelfer'], escalateToEmergencyServicesAfterMin: 5,
    }),
  })
  pruefe('Alarmknopf registriert', knopf.status === 200)
  pruefe('Uplink ohne gültiges Token abgelehnt',
    (await ruf('/hooks/lorawan', { method: 'POST', body: JSON.stringify({ serial: 'LW-TEST-99', event: 'alarm' }) })).status === 401)
  pruefe('Uplink zu unbekanntem Gerät wird gemeldet',
    (await ruf(`/hooks/lorawan?token=${lwToken.body.token}`, { method: 'POST', body: JSON.stringify({ serial: 'XX-0000', event: 'alarm' }) })).status === 404)

  const statusUplink = await ruf(`/hooks/lorawan?token=${lwToken.body.token}`, {
    method: 'POST', body: JSON.stringify({ serial: 'lw test 99', battery: 0.47 }),
  })
  pruefe('Statusmeldung angenommen, kein Alarm', statusUplink.status === 200 && statusUplink.body.alarm === null)
  const knopfNachStatus = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')
  pruefe('Batteriestand und letztes Signal aktualisiert', knopfNachStatus?.batteryPct === 47)

  // Knopfdruck im TTN-v3-Format, Token im Authorization-Kopf
  const ttnUplink = {
    end_device_ids: { dev_eui: 'LWTEST99' },
    uplink_message: { decoded_payload: { alarm: true, battery: 88 } },
  }
  const gedrueckt = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: JSON.stringify(ttnUplink) })
  pruefe('Knopfdruck löst Alarm aus', gedrueckt.status === 200 && typeof gedrueckt.body.alarm === 'string')
  const knopfAlarm = (await ruf('/state', { token: adminToken })).body.alarms.find((a: any) => a.id === gedrueckt.body.alarm)
  pruefe('Knopf-Alarm laut voreingestellt, via Knopf, mit Eskalation',
    knopfAlarm?.silent === false && knopfAlarm?.triggeredVia === 'button' && knopfAlarm?.escalation?.length === 1)
  const doppel = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: JSON.stringify(ttnUplink) })
  pruefe('Doppeldruck löst keinen zweiten Alarm aus', doppel.body.merged === true && doppel.body.alarm === gedrueckt.body.alarm)
  pruefe('Zusammengefasster Druck hinterlässt eine Spur',
    (await ruf('/integrations/lorawan/uplinks', { token: adminToken })).body.uplinks
      .some((u: any) => u.ergebnis === 'zusammengefasst'))
  pruefe('Knopf-Alarm beendet',
    (await ruf(`/alarms/${gedrueckt.body.alarm}/end`, { method: 'POST', token: adminToken })).status === 200)

  // Ein Knopf, der still alarmieren soll, tut es auch – und nur dann
  const stillerKnopf = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')
  await ruf('/buttons', { method: 'POST', token: adminToken, body: JSON.stringify({ ...stillerKnopf, silent: true }) })
  const stillAusgeloest = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ end_device_ids: { dev_eui: 'LWTEST99' }, uplink_message: { decoded_payload: { alarm: true } } }),
  })
  const stillerAlarm = (await ruf('/state', { token: adminToken })).body.alarms.find((a: any) => a.id === stillAusgeloest.body.alarm)
  pruefe('Knopf mit stiller Einstellung alarmiert still', stillerAlarm?.silent === true)
  await ruf(`/alarms/${stillAusgeloest.body.alarm}/end`, { method: 'POST', token: adminToken })
  await ruf('/buttons', { method: 'POST', token: adminToken, body: JSON.stringify({ ...stillerKnopf, silent: false }) })

  // --- Netzserver im Gateway (ChirpStack v3): DevEUI oben, Nutzlast in «object» ---
  const v3Status = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', rxInfo: [], object: { battery: 61 } }),
  })
  pruefe('ChirpStack-v3-Uplink verstanden', v3Status.status === 200 && v3Status.body.alarm === null)
  pruefe('ChirpStack v3 aktualisiert die Batterie',
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')?.batteryPct === 61)

  // Ein nie gemeldeter Knopf gilt weder als stumm noch als batterieschwach –
  // sein Zustand ist unbekannt, nicht schlecht.
  await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      id: 'btn-neu', name: 'Frisch erfasst', type: 'lorawan', serial: 'A840410000009999',
      batteryPct: 5, lastSeen: 0, messageTemplate: 'Test',
      targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }),
  })
  await ruf('/wartung/knoepfe-pruefen', { method: 'POST', token: adminToken })
  const frisch = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.id === 'btn-neu')
  pruefe('Nie gemeldeter Knopf löst keine Batterie- oder Stillewarnung aus',
    !frisch?.gewarnt?.batterieAt && !frisch?.gewarnt?.stillAt)

  // --- Dragino TrackerD: «ALARM» gross, «BAT» in Volt, Alarm bleibt gesetzt ---
  const dragino = (alarm: boolean, bat: number) => JSON.stringify({
    applicationID: '1', devEUI: 'LWTEST99', rxInfo: [],
    object: { ALARM: alarm, BAT: bat, Latitude: 47.19, Longitude: 8.52 },
  })
  const drStatus = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: dragino(false, 4.02) })
  pruefe('Grossgeschriebenes ALARM=false ist kein Alarm', drStatus.status === 200 && drStatus.body.alarm === null)
  pruefe('Zellspannung wird zu Prozent statt zu «4 %»',
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')?.batteryPct === 85)

  const drAlarm = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: dragino(true, 4.02) })
  pruefe('Grossgeschriebenes ALARM=true löst aus', typeof drAlarm.body.alarm === 'string')
  const wiederholung = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: dragino(true, 4.01) })
  pruefe('Wiederholter Alarmzustand erzeugt keinen zweiten Alarm',
    wiederholung.body.merged === true && wiederholung.body.alarm === drAlarm.body.alarm)
  await ruf(`/alarms/${drAlarm.body.alarm}/end`, { method: 'POST', token: adminToken })
  const nachEnde = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: dragino(true, 4.01) })
  pruefe('Nach dem Beenden löst ein Druck wieder aus',
    typeof nachEnde.body.alarm === 'string' && nachEnde.body.alarm !== drAlarm.body.alarm)
  await ruf(`/alarms/${nachEnde.body.alarm}/end`, { method: 'POST', token: adminToken })

  // Beitritts-, Quittungs- und Zustandsmeldungen treffen am selben Endpunkt ein,
  // weil manche Gateways für alle vier Ereignisarten dieselbe Adresse verlangen.
  // Aus ihnen darf nie ein Alarm entstehen, auch nicht bei verfänglichen Feldern.
  const beitritt = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', devAddr: '01020304', type: 'alarm', alarm: true }),
  })
  pruefe('Beitrittsmeldung löst keinen Alarm aus', beitritt.status === 200 && beitritt.body.alarm === null)
  const quittung = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', acknowledged: true, fCnt: 12, sos: 1 }),
  })
  pruefe('Quittungsmeldung löst keinen Alarm aus', quittung.status === 200 && quittung.body.alarm === null)

  // Manche Gateways lassen im Kopfzeilen-Wert kein Leerzeichen zu: Das nackte
  // Token ohne «Bearer » muss deshalb genauso gelten.
  const nacktesToken = await fetch(`${BASIS}/api/hooks/lorawan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: lwToken.body.token },
    body: JSON.stringify({ serial: 'LW-TEST-99', battery: 0.5 }),
  })
  pruefe('Token ohne «Bearer» in der Kopfzeile gilt auch', nacktesToken.status === 200)
  const falschesToken = await fetch(`${BASIS}/api/hooks/lorawan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer  falsch' },
    body: JSON.stringify({ serial: 'LW-TEST-99', battery: 0.5 }),
  })
  pruefe('Falsches Token bleibt abgewiesen', falschesToken.status === 401)

  // --- Rohe Nutzlast: Der Alarmserver übersetzt bekannte Modelle selbst ---
  // Alarm & BAT des TrackerD: 1 Bit reserviert, 1 Bit Alarm, 14 Bit Millivolt.
  // 0x0FA2 = 4002 mV ohne Alarm, 0x4FA2 = dasselbe mit gesetztem Alarmbit.
  const alsB64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64')

  await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      id: 'btn-roh', name: 'TrackerD Test', type: 'lorawan', serial: 'A84041000181D2C7',
      geraetetyp: 'dragino-trackerd', batteryPct: 100, lastSeen: Date.now(),
      messageTemplate: 'Test', targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }),
  })
  const rohStatus = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'A84041000181D2C7', rxInfo: [], fPort: 7, data: alsB64('0FA200') }),
  })
  pruefe('Rohe Nutzlast wird ohne Netzserver-Decoder übersetzt',
    rohStatus.status === 200 && rohStatus.body.alarm === null)
  // 4002 mV auf der Lithium-Kennlinie: (4,002 - 3,0) / (4,2 - 3,0) = 83 %
  pruefe('Millivolt aus der rohen Nutzlast ergeben Prozent',
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.id === 'btn-roh')?.batteryPct === 83)

  const rohAlarm = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'A84041000181D2C7', rxInfo: [], fPort: 7, data: alsB64('4FA200') }),
  })
  pruefe('Alarmbit in der rohen Nutzlast löst aus', typeof rohAlarm.body.alarm === 'string')
  await ruf(`/alarms/${rohAlarm.body.alarm}/end`, { method: 'POST', token: adminToken })

  // Port 3: Standardbetrieb, Alarm & BAT liegen hinter den acht Positionsbytes
  const port3 = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({
      applicationID: '1', devEUI: 'A84041000181D2C7', rxInfo: [], fPort: 3,
      data: alsB64('0000000000000000' + '4FA2' + '00'),
    }),
  })
  pruefe('TrackerD Port 3: Alarm an der richtigen Stelle gelesen', typeof port3.body.alarm === 'string')
  await ruf(`/alarms/${port3.body.alarm}/end`, { method: 'POST', token: adminToken })

  // PB01: Spannung (2), Ton (1), Alarm (1), Temperatur (2), Feuchte (2)
  await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      id: 'btn-pb01', name: 'PB01 Test', type: 'lorawan', serial: 'A840410001820000',
      geraetetyp: 'dragino-pb01', batteryPct: 100, lastSeen: Date.now(),
      messageTemplate: 'Test', targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }),
  })
  const pbRuhe = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'A840410001820000', rxInfo: [], fPort: 2, data: alsB64('0CEA000000000000') }),
  })
  pruefe('PB01 ohne Tastendruck löst nicht aus', pbRuhe.status === 200 && pbRuhe.body.alarm === null)
  pruefe('PB01 meldet 3306 mV als Prozent',
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.id === 'btn-pb01')?.batteryPct === 26)
  const pbDruck = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'A840410001820000', rxInfo: [], fPort: 2, data: alsB64('0CEA000100000000') }),
  })
  pruefe('PB01 Tastendruck löst aus', typeof pbDruck.body.alarm === 'string')
  await ruf(`/alarms/${pbDruck.body.alarm}/end`, { method: 'POST', token: adminToken })

  // Ohne hinterlegtes Modell bleibt es beim Hinweis auf den fehlenden Decoder
  const ohneModell = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', rxInfo: [], fPort: 2, data: alsB64('0CEA000100000000') }),
  })
  pruefe('Ohne hinterlegtes Modell weiterhin «ohne übersetzte Nutzlast»', ohneModell.status === 422)

  // Gerätestatus des Netzservers: Batterie im Umschlag statt in der Nutzlast
  const status = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', batteryLevel: 38, margin: 7 }),
  })
  pruefe('Gerätestatus liefert den Batteriestand', status.status === 200 &&
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')?.batteryPct === 38)
  await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', batteryLevel: 0, batteryLevelUnavailable: true }),
  })
  pruefe('«Batteriestand nicht verfügbar» überschreibt den bekannten Wert nicht',
    (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')?.batteryPct === 38)

  // Base64-DevEUI (0x0102030405060708) muss auf denselben Knopf zeigen
  await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      id: 'btn-b64', name: 'Knopf Base64', type: 'lorawan', serial: '0102030405060708', batteryPct: 100, lastSeen: Date.now(),
      messageTemplate: 'Test', targetGroupIds: ['gr-sicherheit'], escalateToEmergencyServicesAfterMin: 5,
    }),
  })
  const b64 = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ deviceInfo: { devEui: 'AQIDBAUGBwg=' }, object: { battery: 55 } }),
  })
  pruefe('Base64-DevEUI wird dem Knopf zugeordnet', b64.status === 200 && b64.body.ok === true)

  // Ohne Payload-Decoder kommen nur rohe Bytes – ein Knopfdruck bliebe unerkannt
  const ohneDecoder = await ruf('/hooks/lorawan', {
    method: 'POST', token: lwToken.body.token,
    body: JSON.stringify({ applicationID: '1', devEUI: 'LWTEST99', rxInfo: [], data: 'AQ==' }),
  })
  pruefe('Fehlender Payload-Decoder wird als Fehler gemeldet', ohneDecoder.status === 422)
  const spur = await ruf('/integrations/lorawan/uplinks', { token: adminToken })
  pruefe('Letzte Uplinks nur für die Administration',
    spur.status === 200 && (await ruf('/integrations/lorawan/uplinks', { token: peterToken })).status === 403)
  pruefe('Abgewiesener Uplink hinterlässt eine Spur',
    spur.body.uplinks.some((u: any) => u.ergebnis === 'ohne-decoder') &&
    spur.body.uplinks.some((u: any) => u.ergebnis === 'unbekanntes-geraet' && String(u.geraet).includes('XX')) &&
    spur.body.uplinks.some((u: any) => u.ergebnis === 'token-falsch'))
  pruefe('Uplink-Spur nennt die übersetzten Felder',
    spur.body.uplinks.some((u: any) => Array.isArray(u.felder) && u.felder.includes('battery')))

  pruefe('Fehlender Payload-Decoder steht im Ereignisprotokoll',
    (await ruf('/state', { token: adminToken })).body.audit.some((e: any) => String(e.message).includes('Payload-Decoder')))

  // --- Uplink-Erkennung: herstellerspezifische Feldnamen ---
  const erkannt = async (nutzlast: Record<string, unknown>) => {
    const antwort = await ruf('/hooks/lorawan', {
      method: 'POST', token: lwToken.body.token,
      body: JSON.stringify({ serial: 'LW-TEST-99', ...nutzlast }),
    })
    if (typeof antwort.body.alarm === 'string') {
      await ruf(`/alarms/${antwort.body.alarm}/end`, { method: 'POST', token: adminToken })
      return true
    }
    return false
  }
  pruefe('Uplink «sos_alarm» erkannt', await erkannt({ sos_alarm: true }))
  pruefe('Uplink mit event «short_press» erkannt', await erkannt({ event: 'SHORT_PRESS' }))
  pruefe('Uplink mit messageType «button» erkannt', await erkannt({ messageType: 'button' }))
  pruefe('Reine Statusmeldung löst weiterhin keinen Alarm aus', !(await erkannt({ battery: 90, press_count: 7 })))

  // --- Wachhund: stumme Knöpfe und schwache Batterie ---
  const wachStand = (await ruf('/state', { token: adminToken })).body.integrations
  pruefe('Überwachungsschwellen haben Vorgaben',
    wachStand.lorawan.stilleWarnungStunden === 36 && wachStand.lorawan.batterieWarnungProzent === 20)

  // Knopf künstlich altern lassen und die Batterie leeren
  const zuUeberwachen = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')
  await ruf('/buttons', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ ...zuUeberwachen, lastSeen: Date.now() - 48 * 3600_000, batteryPct: 8 }),
  })
  await ruf('/wartung/knoepfe-pruefen', { method: 'POST', token: adminToken })
  const gemeldet = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')
  pruefe('Wachhund meldet stummen Knopf', typeof gemeldet?.gewarnt?.stillAt === 'number')
  pruefe('Wachhund meldet schwache Batterie', typeof gemeldet?.gewarnt?.batterieAt === 'number')
  const knopfProtokoll = (await ruf('/state', { token: adminToken })).body.audit
  pruefe('Störung steht im Protokoll',
    knopfProtokoll.some((e: any) => String(e.message).includes('Alarmknöpfe brauchen Aufmerksamkeit')))

  // Meldet sich der Knopf wieder, verfällt die Sperre – eine neue Störung wird wieder gemeldet
  await ruf(`/hooks/lorawan?token=${lwToken.body.token}`, {
    method: 'POST', body: JSON.stringify({ serial: 'LW-TEST-99', battery: 0.95 }),
  })
  await ruf('/wartung/knoepfe-pruefen', { method: 'POST', token: adminToken })
  const erholt = (await ruf('/state', { token: adminToken })).body.buttons.find((b: any) => b.serial === 'LW-TEST-99')
  pruefe('Nach Erholung ist die Warnsperre gelöst', !erholt?.gewarnt?.stillAt && !erholt?.gewarnt?.batterieAt)

  // Aufräumen: SMS-Gateway und LoRaWAN wieder deaktivieren
  const aufraeumen = (await ruf('/state', { token: adminToken })).body.integrations
  aufraeumen.smsGateway.enabled = false
  aufraeumen.lorawan.enabled = false
  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify(aufraeumen) })

  // --- Geofencing: Alarmierung nach Aufenthaltsort ---
  const geoAus = (await ruf('/state', { token: adminToken })).body.integrations
  pruefe('Geofencing ist anfänglich aus', geoAus.geofencing === false)
  pruefe('Ortsmeldung bei ausgeschaltetem Geofencing wird ignoriert',
    (await ruf('/geo/report', { method: 'POST', token: peterToken, body: JSON.stringify({ locationId: 'loc-menzingen' }) })).body.disabled === true)

  const ohneGeo = await ruf('/alarms', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      scenarioId: 'sc-brand', message: 'Testalarm Menzingen ohne Geofencing', requireAck: true,
      channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-menzingen'], triggeredVia: 'web',
    }),
  })
  pruefe('ohne Geofencing zählt nur der Profilstandort',
    ohneGeo.status === 200 && !ohneGeo.body.alarm.deliveries.some((d: any) => d.userId === peterId))
  await ruf(`/alarms/${ohneGeo.body.alarm.id}/end`, { method: 'POST', token: adminToken })

  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify({ ...geoAus, geofencing: true }) })
  pruefe('unbekannter Standort wird abgewiesen',
    (await ruf('/geo/report', { method: 'POST', token: peterToken, body: JSON.stringify({ locationId: 'loc-nirgendwo' }) })).status === 400)
  pruefe('Ortsmeldung angenommen',
    (await ruf('/geo/report', { method: 'POST', token: peterToken, body: JSON.stringify({ locationId: 'loc-menzingen' }) })).body.ok === true)

  const mitGeo = await ruf('/alarms', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      scenarioId: 'sc-evak', message: 'Testalarm Menzingen mit Geofencing', requireAck: true,
      channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-menzingen'], triggeredVia: 'web',
    }),
  })
  pruefe('Aufenthalt am Standort macht die Person zum Empfänger:innen',
    mitGeo.body.alarm.deliveries.some((d: any) => d.userId === peterId))
  await ruf(`/alarms/${mitGeo.body.alarm.id}/end`, { method: 'POST', token: adminToken })

  const trotzdemBaar = await ruf('/alarms', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({
      scenarioId: 'sc-brand', message: 'Testalarm Baar trotz Aufenthalt in Menzingen', requireAck: true,
      channels: ['push'], groupIds: ['gr-ersthelfer'], locationIds: ['loc-baar'], triggeredVia: 'web',
    }),
  })
  pruefe('der Profilstandort fällt nie aus der Alarmierung',
    trotzdemBaar.body.alarm.deliveries.some((d: any) => d.userId === peterId))
  await ruf(`/alarms/${trotzdemBaar.body.alarm.id}/end`, { method: 'POST', token: adminToken })

  pruefe('Abmeldung vom Standort («nirgends») angenommen',
    (await ruf('/geo/report', { method: 'POST', token: peterToken, body: JSON.stringify({ locationId: null }) })).body.ok === true)
  const bereitGeo = await ruf('/bereitschaft', { token: adminToken })
  pruefe('Bereitschaft zeigt den Geofencing-Stand',
    bereitGeo.body.geofencing === true && typeof bereitGeo.body.ortsmeldungen === 'number')

  const geoZuruecksetzen = (await ruf('/state', { token: adminToken })).body.integrations
  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify({ ...geoZuruecksetzen, geofencing: false }) })

  // --- Single Sign-On (Microsoft Entra ID) ---
  pruefe('Anmeldemaske weiss, dass SSO aus ist', (await ruf('/setup')).body.sso === false)
  pruefe('SSO-Start ohne Einrichtung abgewiesen', (await fetch(BASIS + '/api/auth/sso/start')).status === 400)

  const ssoStand = (await ruf('/state', { token: adminToken })).body.integrations
  await ruf('/integrations', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ ...ssoStand, sso: { ...ssoStand.sso, enabled: true, tenantId: 'test-tenant', clientId: 'client-123', clientSecret: 'sso-geheim' } }),
  })
  pruefe('Anmeldemaske zeigt den Microsoft-Knopf', (await ruf('/setup')).body.sso === true)

  const ssoStart = await fetch(BASIS + '/api/auth/sso/start?target=web', { redirect: 'manual' })
  const ssoStartZiel = String(ssoStart.headers.get('location') ?? '')
  pruefe('SSO-Start leitet mit PKCE zu Microsoft weiter',
    ssoStart.status === 302 && ssoStartZiel.includes('login.microsoftonline.com/test-tenant') &&
      ssoStartZiel.includes('client_id=client-123') && ssoStartZiel.includes('code_challenge='))

  const ssoRueck = await fetch(BASIS + '/api/auth/sso/callback?code=x&state=ungueltig', { redirect: 'manual' })
  pruefe('Rücksprung mit unbekanntem Vorgang scheitert sauber',
    ssoRueck.status === 302 && String(ssoRueck.headers.get('location')).includes('ssoFehler'))
  pruefe('SSO-Geheimnis im Datenbestand maskiert',
    (await ruf('/state', { token: adminToken })).body.integrations.sso.clientSecret === '••••••••')

  const ssoAus = (await ruf('/state', { token: adminToken })).body.integrations
  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify({ ...ssoAus, sso: { ...ssoAus.sso, enabled: false } }) })

  // --- Organisation & Einrichtung ---
  pruefe('Anmeldemaske kennt den Organisationsnamen',
    (await ruf('/setup')).body.organization === 'SONNENBERG Kompetenzzentrum')
  pruefe('Einrichtung ohne Anmeldung gesperrt',
    (await ruf('/einrichtung', { method: 'POST', body: JSON.stringify({ name: 'X' }) })).status === 401)
  const einrichtung = await ruf('/einrichtung', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ name: 'Muster AG', shortName: 'MUSTER', hotline: '+41 44 000 00 00', standortName: 'Hauptsitz Test', standortAdresse: 'Musterstrasse 1' }),
  })
  pruefe('Einrichtungsassistent speichert die Grunddaten', einrichtung.status === 200)
  const nachEinrichtung = await ruf('/state', { token: adminToken })
  pruefe('Organisationsname übernommen', nachEinrichtung.body.integrations.organization.name === 'Muster AG')
  pruefe('Hotline übernommen', nachEinrichtung.body.integrations.hotline.number === '+41 44 000 00 00')
  pruefe('Standort aus der Einrichtung angelegt',
    nachEinrichtung.body.locations.some((l: any) => l.name === 'Hauptsitz Test'))
  pruefe('Einrichtung gilt als abgeschlossen', (await ruf('/setup')).body.setupPending === false)

  // --- Branding: Akzentfarbe und Logo ---
  const mitFarbe = (await ruf('/state', { token: adminToken })).body.integrations
  await ruf('/integrations', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ ...mitFarbe, organization: { ...mitFarbe.organization, color: '#123456' } }),
  })
  pruefe('Akzentfarbe gespeichert und vor der Anmeldung sichtbar',
    (await ruf('/setup')).body.organizationColor === '#123456')
  const farbeKaputt = (await ruf('/state', { token: adminToken })).body.integrations
  await ruf('/integrations', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ ...farbeKaputt, organization: { ...farbeKaputt.organization, color: 'red; }} böse' } }),
  })
  pruefe('Ungültige Farbe wird nicht übernommen',
    (await ruf('/setup')).body.organizationColor === '#123456')

  pruefe('Logo hochladen nur für die Administration',
    (await ruf('/branding/logo', { method: 'POST', token: peterToken, body: JSON.stringify({ dataUrl: 'data:image/png;base64,QUJD' }) })).status === 403)
  pruefe('Nur Bildformate erlaubt',
    (await ruf('/branding/logo', { method: 'POST', token: adminToken, body: JSON.stringify({ dataUrl: 'data:text/html;base64,QUJD' }) })).status === 400)
  const logoRauf = await ruf('/branding/logo', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAA' }),
  })
  pruefe('Logo hochladbar – Version wird vergeben', logoRauf.status === 200 && Boolean(logoRauf.body.logoVersion))
  const logoAntwort = await fetch(BASIS + '/api/branding/logo')
  pruefe('Logo öffentlich abrufbar (für die Anmeldemaske)',
    logoAntwort.status === 200 && logoAntwort.headers.get('content-type') === 'image/png')
  pruefe('Anmeldemaske kennt die Logo-Version',
    (await ruf('/setup')).body.logoVersion === logoRauf.body.logoVersion)
  await ruf('/branding/logo', { method: 'DELETE', token: adminToken })
  pruefe('Logo entfernbar', (await ruf('/setup')).body.logoVersion === null)

  // --- Redundanz ---
  pruefe('Redundanz-Konfiguration nur für die Administration',
    (await ruf('/redundanz', { token: peterToken })).status === 403)
  pruefe('Replikations-Abzug ohne Geheimnis gesperrt',
    (await ruf('/replikation/abzug')).status === 401)
  const redundanzAn = await ruf('/redundanz', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ enabled: true, role: 'primary', peerUrl: 'https://standby.example', intervalS: 30 }),
  })
  pruefe('Redundanz einschaltbar – Geheimnis wird erzeugt',
    redundanzAn.status === 200 && String(redundanzAn.body.config.secret).startsWith('rd_'))
  const geheim = String(redundanzAn.body.config.secret)
  pruefe('Abzug mit falschem Geheimnis gesperrt',
    (await ruf('/replikation/abzug', { headers: { Authorization: 'Bearer falsch' } })).status === 401)
  const abzug = await ruf('/replikation/abzug', { headers: { Authorization: `Bearer ${geheim}` } })
  pruefe('Abzug mit Geheimnis enthält alle Tabellen',
    abzug.status === 200 && Array.isArray(abzug.body.tabellen.users) && Array.isArray(abzug.body.tabellen.sessions) && Array.isArray(abzug.body.settings))
  pruefe('Abzug repliziert die eigene Redundanz-Konfiguration nicht',
    abzug.body.settings.every((s: any) => s.key !== 'redundanz'))
  pruefe('Datenbestand nennt Rolle und Ausweichadresse',
    (await ruf('/state', { token: adminToken })).body.serverInfo?.rolle === 'primary' &&
      (await ruf('/setup')).body.fallbackUrl === 'https://standby.example')
  const rueckmeldung = await ruf('/replikation/rueckmeldung', {
    method: 'POST', headers: { Authorization: `Bearer ${geheim}` },
    body: JSON.stringify({ audit: [{ id: 'audit-standby-test', ts: Date.now(), type: 'system', message: 'Test-Rückmeldung vom Standby' }] }),
  })
  pruefe('Rückmeldung des Standby wird übernommen', rueckmeldung.status === 200 && rueckmeldung.body.uebernommen === 1)
  await ruf('/redundanz', { method: 'POST', token: adminToken, body: JSON.stringify({ enabled: false, role: 'primary', peerUrl: '', intervalS: 30 }) })
  pruefe('Redundanz wieder aus', (await ruf('/setup')).body.serverRolle === null)

  // --- Abmelden ---
  pruefe('Abmeldung möglich', (await ruf('/auth/logout', { method: 'POST', token: peterToken })).status === 200)
  pruefe('Token nach Abmeldung ungültig', (await ruf('/state', { token: peterToken })).status === 401)


  // --- Schutz gegen Durchprobieren von Passwörtern ---
  const rateMail = `rate-${Date.now()}@sobe-notfall.local`
  for (let n = 1; n <= 5; n++) {
    const r = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: rateMail, password: 'falsch' }) })
    pruefe(`Fehlversuch ${n} wird abgewiesen`, r.status === 401)
  }
  const gesperrt = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: rateMail, password: 'falsch' }) })
  pruefe('nach fünf Fehlversuchen gesperrt', gesperrt.status === 429, `Status ${gesperrt.status}`)

  const fehlversuchProtokoll = (await ruf('/state', { token: adminToken })).body.audit as { type: string; message: string }[]
  pruefe(
    'fehlgeschlagene Anmeldung steht im Ereignisprotokoll',
    fehlversuchProtokoll.some((e) => e.type === 'anmeldung' && e.message.startsWith('Anmeldung gesperrt')),
  )

  console.log(`\n${bestanden} bestanden, ${gescheitert} fehlgeschlagen`)
  process.exit(gescheitert === 0 ? 0 : 1)
}

main().catch((f) => {
  console.error(f)
  process.exit(1)
})
