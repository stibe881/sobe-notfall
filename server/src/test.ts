/**
 * Integrationstest gegen die laufende API.
 * Aufruf: SOBE_TEST_URL=http://localhost:3099 npx tsx src/test.ts
 */
const BASIS = process.env.SOBE_TEST_URL ?? 'http://localhost:3099'
const ERSTPASSWORT = process.env.SOBE_ADMIN_PASSWORD ?? 'SOBE-Start2026!'
const ADMIN_MAIL = process.env.SOBE_ADMIN_EMAIL ?? 'stefan.gross@sonnenberg-baar.ch'

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
  pruefe('22 Szenarien vorhanden', stand.body.scenarios.length === 22, `gefunden: ${stand.body.scenarios?.length}`)
  pruefe('3 Standorte vorhanden', stand.body.locations.length === 3)
  pruefe('7 Gruppen vorhanden', stand.body.groups.length === 7)
  pruefe('Notrufnummern vorhanden', stand.body.contacts.length === 8)
  pruefe('keine Demo-Benutzer im Live-Bestand', stand.body.users.length === 1)
  pruefe('Benutzerliste ohne Passwortdaten', stand.body.users.every((u: any) => !('passwordHash' in u)))

  // --- Ablauf der Szenarien: Alarmieren steht in callGuidance, nicht in den Sofortmassnahmen ---
  const aktive = stand.body.scenarios.filter((s: any) => s.active !== false)
  pruefe('11 Szenarien für Mitarbeitende freigegeben', aktive.length === 11, `gefunden: ${aktive.length}`)
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
  pruefe('jedes freigegebene Szenario hat Schritte für Empfänger',
    aktive.every((s: any) => Array.isArray(s.responseSteps) && s.responseSteps.length >= 3),
    aktive.filter((s: any) => (s.responseSteps?.length ?? 0) < 3).map((s: any) => s.id).join(', '))
  const empfaengerLoest = aktive.flatMap((s: any) =>
    (s.responseSteps ?? [])
      .filter((st: any) => /Alarm in der App auslösen|Aufgebot in der App|(118|144) (anrufen|alarmieren)/i.test(st.text))
      .map((st: any) => `${s.id}: ${st.text.slice(0, 60)}`),
  )
  pruefe('Empfänger werden nicht zum erneuten Alarmieren angehalten', empfaengerLoest.length === 0, empfaengerLoest.join(' | '))

  // Gruppenzuordnung: Jede genannte Gruppe muss existieren, und jedes Szenario
  // braucht mindestens einen Schritt, der für alle gilt - sonst stünde jemand
  // ohne Gruppe vor einer leeren Seite.
  const gruppenIds = new Set(stand.body.groups.map((g: any) => g.id))
  const fremdeGruppen = aktive.flatMap((s: any) =>
    (s.responseSteps ?? []).flatMap((st: any) => (st.groupIds ?? []).filter((g: string) => !gruppenIds.has(g)).map((g: string) => `${s.id}: ${g}`)),
  )
  pruefe('Empfängerschritte verweisen nur auf vorhandene Gruppen', fremdeGruppen.length === 0, fremdeGruppen.join(', '))
  const ohneAllgemein = aktive.filter((s: any) => !(s.responseSteps ?? []).some((st: any) => !st.groupIds?.length)).map((s: any) => s.id)
  pruefe('jedes Szenario hat mindestens einen Schritt für alle Empfänger', ohneAllgemein.length === 0, ohneAllgemein.join(', '))

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
  pruefe('Benutzer angelegt', angelegt.status === 200)
  const peterId: string = angelegt.body.user.id

  const doppelt = await ruf('/users', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ firstName: 'Andere', lastName: 'Person', email: 'PETER.muster@sonnenberg-baar.ch', role: 'mitarbeiter' }),
  })
  pruefe('doppelte E-Mail-Adresse abgelehnt', doppelt.status === 400)

  const peterAn = await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'peter.muster@sonnenberg-baar.ch', password: 'Muster2026' }) })
  pruefe('neu angelegter Benutzer kann sich anmelden', peterAn.status === 200)
  const peterToken: string = peterAn.body.token

  const ohnePasswort = await ruf('/users', {
    method: 'POST', token: adminToken,
    body: JSON.stringify({ firstName: 'Ohne', lastName: 'Passwort', email: 'ohne@sonnenberg-baar.ch', role: 'mitarbeiter' }),
  })
  pruefe('Benutzer ohne Passwort anlegbar', ohnePasswort.status === 200 && ohnePasswort.body.user.hasPassword === false)
  pruefe('ohne Passwort keine Anmeldung',
    (await ruf('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ohne@sonnenberg-baar.ch', password: 'egal1234' }) })).status === 401)

  // --- Rechte ---
  const fremdAnlage = await ruf('/users', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({ firstName: 'Heimlich', lastName: 'Admin', email: 'heimlich@x.ch', role: 'admin' }),
  })
  pruefe('Mitarbeitende dürfen keine Benutzer anlegen', fremdAnlage.status === 403)
  pruefe('Mitarbeitende dürfen keine Szenarien ändern',
    (await ruf('/scenarios', { method: 'POST', token: peterToken, body: JSON.stringify({ id: 'sc-brand', title: 'Manipuliert' }) })).status === 403)
  pruefe('Mitarbeitende sehen den Datenbestand', (await ruf('/state', { token: peterToken })).status === 200)

  // --- Letzter Administrator ---
  const admins = (await ruf('/state', { token: adminToken })).body.users.filter((u: any) => u.role === 'admin')
  pruefe('genau ein Administrator vorhanden', admins.length === 1)
  pruefe('letzter Administrator nicht löschbar',
    (await ruf(`/users/${admins[0].id}`, { method: 'DELETE', token: adminToken })).status === 400)
  pruefe('letzter Administrator nicht herabstufbar',
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
  pruefe('Empfänger wurden aufgelöst', alarm.body.alarm.deliveries.length > 0)
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
      scenarioId: 'sc-medizin', message: 'SOS-Alarm von Peter Muster (App) – Standort: Hauptsitz Baar', silent: false,
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
  pruefe('App sieht die im Portal angelegten Benutzer',
    standPeter.body.users.some((u: any) => u.email === 'peter.muster@sonnenberg-baar.ch'))
  pruefe('App sieht den beendeten Alarm', standPeter.body.alarms.some((a: any) => a.id === alarmId && a.status === 'ended'))

  // --- Alleinarbeit ---
  const timer = await ruf('/lone-work', {
    method: 'POST', token: peterToken,
    body: JSON.stringify({ activity: 'Kontrollgang', durationMin: 30, locationId: 'loc-baar', alertGroupIds: ['gr-krisenstab'], alertUserIds: [peterId] }),
  })
  pruefe('Alleinarbeits-Timer gestartet', timer.status === 200 && timer.body.session.status === 'running')
  pruefe('Empfänger bei Ablauf werden gespeichert',
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
  pruefe('Knopf-Alarm still, via Knopf, mit Eskalation',
    knopfAlarm?.silent === true && knopfAlarm?.triggeredVia === 'button' && knopfAlarm?.escalation?.length === 1)
  const doppel = await ruf('/hooks/lorawan', { method: 'POST', token: lwToken.body.token, body: JSON.stringify(ttnUplink) })
  pruefe('Doppeldruck löst keinen zweiten Alarm aus', doppel.body.merged === true && doppel.body.alarm === gedrueckt.body.alarm)
  pruefe('Knopf-Alarm beendet',
    (await ruf(`/alarms/${gedrueckt.body.alarm}/end`, { method: 'POST', token: adminToken })).status === 200)

  // Aufräumen: SMS-Gateway und LoRaWAN wieder deaktivieren
  const aufraeumen = (await ruf('/state', { token: adminToken })).body.integrations
  aufraeumen.smsGateway.enabled = false
  aufraeumen.lorawan.enabled = false
  await ruf('/integrations', { method: 'POST', token: adminToken, body: JSON.stringify(aufraeumen) })

  // --- Abmelden ---
  pruefe('Abmeldung möglich', (await ruf('/auth/logout', { method: 'POST', token: peterToken })).status === 200)
  pruefe('Token nach Abmeldung ungültig', (await ruf('/state', { token: peterToken })).status === 401)

  console.log(`\n${bestanden} bestanden, ${gescheitert} fehlgeschlagen`)
  process.exit(gescheitert === 0 ? 0 : 1)
}

main().catch((f) => {
  console.error(f)
  process.exit(1)
})
