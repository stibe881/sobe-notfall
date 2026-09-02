import { Router, type NextFunction, type Request, type Response } from 'express'
import {
  createSession, destroySession, destroyUserSessions, hashPassword, newSalt, normalizeEmail,
  passwordProblem, publicUser, sessionUserId, verifyPassword,
} from './auth.js'
import { addClient } from './events.js'
import { broadcast } from './events.js'
import { UEBUNG, alarmPush, ausgehendeWebhooks, entwarnungPush, lagemeldungPush, testPush } from './engine.js'
import {
  erstelleKonferenz, graphToken, lorawanTokenAusRequest, lorawanTokenGueltig,
  mergeIntegrationen, neuesLorawanToken, normierteSerie, parseLorawanUplink, sendeSms, sendeTeamsKarte,
} from './integrationen.js'
import { sendeAlarmKanaele, sendeInfoKanaele } from './kanaele.js'
import { rolleAusGruppen, ssoAbbruch, ssoCallback, ssoKonfiguriert, ssoStartUrl, ssoTest, ssoZiel } from './sso.js'
import { geraeteProPerson, letzterTestpush, pushDienstStatus, registerPushToken, removePushToken } from './push.js'
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { aktuellerJob, starteUpdate, updateLaeuft, versionsInfo, type UpdateScope } from './update.js'
import { einrichtungAbschliessen, einrichtungOffen, ensureAdmin } from './setup.js'
import {
  erzeugeAbzug, neuesRedundanzGeheimnis, peerErreichbar, redundanzConfig, redundanzStatus,
  replikationsZugriffErlaubt, serverInfo, speichereRedundanz, uebernehmeRueckmeldung,
} from './replikation.js'
import {
  addAudit, allAlarms, allButtons, allGroups, allLocations, allLoneWork, allStoredUsers, createAlarm, deleteDoc, deleteUser, findAlarm,
  findStoredUser, findStoredUserByEmail, fullState, integrations, presenceMap, saveAlarm, saveIntegrations, setPresence, uid,
  upsertDoc, upsertGroup, upsertLocation, upsertUser,
} from './store.js'
import type { AckStatus, Alarm, AlarmUpdate, Role, StoredUser } from './types.js'

export const router = Router()

// ---------- Authentifizierung ----------

interface AuthRequest extends Request {
  user?: StoredUser
  token?: string
}

function auth(req: AuthRequest, res: Response, next: NextFunction): void {
  const kopf = req.header('authorization') ?? ''
  const token = kopf.startsWith('Bearer ') ? kopf.slice(7) : ''
  const userId = token ? sessionUserId(token) : null
  const user = userId ? findStoredUser(userId) : null
  if (!user) {
    res.status(401).json({ error: 'Nicht angemeldet.' })
    return
  }
  req.user = user
  req.token = token
  next()
}

/** Nur Administratoren dürfen die Konfiguration ändern */
function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Diese Aktion ist Administratoren vorbehalten.' })
    return
  }
  next()
}

/** Verwaltungsdaten dürfen Administratoren und Krisenstab pflegen */
function staffOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin' && req.user?.role !== 'krisenstab') {
    res.status(403).json({ error: 'Diese Aktion ist Administration und Krisenstab vorbehalten.' })
    return
  }
  next()
}

const FALSCHE_ANMELDUNG = 'E-Mail-Adresse oder Passwort ist falsch.'

/**
 * Öffentliche Auskunft für die Anmeldemaske: Ist der Server frisch eingerichtet?
 * Bewusst minimal – nur, ob genau ein Administratorkonto mit unverändertem
 * Erstpasswort besteht, und dessen Adresse. Sobald das Passwort geändert wurde,
 * verschwindet die Auskunft.
 */
router.get('/setup', (_req, res) => {
  const users = allStoredUsers()
  const frisch =
    users.length === 1 && users[0].role === 'admin' && users[0].mustChangePassword === true
  const info = serverInfo()
  res.json({
    freshInstall: frisch,
    adminEmail: frisch ? users[0].email : null,
    userCount: users.length,
    // Zeigt die Anmeldemaske den Knopf «Mit Microsoft anmelden»?
    sso: ssoKonfiguriert(integrations().sso),
    // Name der Organisation – App und Portal zeigen ihn vor der Anmeldung
    organization: integrations().organization.name || null,
    // Der Einrichtungsassistent im Portal steht noch aus
    setupPending: einrichtungOffen(),
    // Redundanz: Rolle dieses Servers und Ausweichadresse für die App
    serverRolle: info.rolle,
    fallbackUrl: info.fallbackUrl,
    failover: info.failover,
  })
})

/**
 * Einrichtungsassistent: Grunddaten eines neuen Kunden in einem Schritt –
 * Organisation, interne Notfallnummer und erster Standort.
 */
router.post('/einrichtung', auth, adminOnly, (req: AuthRequest, res) => {
  const o = req.body ?? {}
  const name = String(o.name ?? '').trim()
  if (!name) {
    res.status(400).json({ error: 'Bitte den Namen der Organisation angeben.' })
    return
  }
  const shortName = String(o.shortName ?? '').trim().slice(0, 11)
  const hotline = String(o.hotline ?? '').trim()
  const standortName = String(o.standortName ?? '').trim()

  const integ = integrations()
  integ.organization = { name, shortName }
  if (hotline) integ.hotline = { enabled: true, number: hotline }
  // SMS-Absender nur setzen, solange noch die Vorgabe drinsteht
  const senderAusKurzname = shortName.replace(/[^A-Za-z0-9]/g, '').slice(0, 11)
  if (senderAusKurzname && (integ.smsGateway.senderId === 'ALARM' || !integ.smsGateway.senderId)) {
    integ.smsGateway.senderId = senderAusKurzname
  }
  saveIntegrations(integ)

  if (standortName) {
    const standort = {
      id: uid('loc'),
      name: standortName,
      address: String(o.standortAdresse ?? '').trim(),
      operatingHours: { days: 'Mo–Fr', open: '07:00', close: '18:00' },
    }
    upsertLocation(standort)
    // Das Admin-Konto hängt noch an keinem Standort – jetzt gibt es einen
    const admin = req.user!
    if (!admin.locationId) upsertUser({ ...admin, locationId: standort.id })
  }

  einrichtungAbschliessen()
  addAudit('admin', `Einrichtung abgeschlossen: ${name}${standortName ? ` – erster Standort «${standortName}»` : ''}`, req.user!.id)
  broadcast('state')
  res.json({ ok: true })
})

/** Öffentliche Adresse des Servers – für Weiterleitungen und Endpunkt-Auskünfte */
function basisAdresse(req: Request): string {
  return process.env.SOBE_PUBLIC_URL?.replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`
}

// ---------- Single Sign-On (Microsoft Entra ID, OpenID Connect) ----------

router.get('/auth/sso/start', (req, res) => {
  const sso = integrations().sso
  if (!ssoKonfiguriert(sso)) {
    res.status(400).send('Single Sign-On ist unter Integrationen nicht eingerichtet.')
    return
  }
  const target = req.query.target === 'app' ? 'app' : 'web'
  res.redirect(ssoStartUrl(sso, `${basisAdresse(req)}/api/auth/sso/callback`, target))
})

router.get('/auth/sso/callback', async (req, res) => {
  const sso = integrations().sso
  const basis = basisAdresse(req)
  const zurueck = (target: 'web' | 'app', fehler?: string, token?: string) => {
    const teil = fehler ? `error=${encodeURIComponent(fehler)}` : `token=${encodeURIComponent(token ?? '')}`
    if (target === 'app') {
      // Nicht per 302 aufs App-Schema: iOS' Anmelde-Fenster folgt einer
      // Weiterleitung auf ein eigenes Schema nicht zuverlässig und verschluckt
      // dabei mitunter das Token. Eine kleine Seite springt per JavaScript –
      // das fängt ASWebAuthenticationSession verlässlich ab.
      const ziel = `sobenotfall://auth?${teil}`
      res.set('Content-Type', 'text/html; charset=utf-8').send(
        `<!doctype html><meta charset="utf-8"><title>SOBE Notfall</title>` +
          `<body style="font-family:-apple-system,sans-serif;background:#0f172a;color:#cbd5e1;text-align:center;padding:48px 24px">` +
          `<p>Anmeldung abgeschlossen – zurück zur App …</p>` +
          `<p><a href="${ziel}" style="color:#fff">Weiter zur SOBE-Notfall-App</a></p>` +
          `<script>location.replace(${JSON.stringify(ziel)})</script>`,
      )
    } else {
      res.redirect(fehler ? `${basis}/#ssoFehler=${encodeURIComponent(fehler)}` : `${basis}/#sso=${encodeURIComponent(token ?? '')}`)
    }
  }

  const state = String(req.query.state ?? '')
  if (req.query.error) {
    const meldung = String(req.query.error_description ?? 'Die Anmeldung bei Microsoft wurde abgebrochen.')
    addAudit('anmeldung', `Microsoft-Anmeldung von Microsoft abgewiesen: ${meldung.slice(0, 200)}`)
    zurueck(ssoAbbruch(state), meldung)
    return
  }
  if (!ssoKonfiguriert(sso)) {
    zurueck(ssoAbbruch(state), 'Single Sign-On ist unter Integrationen nicht eingerichtet.')
    return
  }
  // Das Ziel vor dem Token-Tausch bestimmen – auch ein Fehler muss an die
  // richtige Stelle zurück (App-Schema statt Portal-Adresse)
  const ziel = ssoZiel(state) ?? 'web'
  let ergebnis
  try {
    ergebnis = await ssoCallback(sso, `${basis}/api/auth/sso/callback`, String(req.query.code ?? ''), state)
  } catch (fehler) {
    addAudit('anmeldung', `Microsoft-Anmeldung fehlgeschlagen (${ziel}): ${(fehler as Error).message}`)
    zurueck(ziel, (fehler as Error).message)
    return
  }

  let user = findStoredUserByEmail(ergebnis.email)
  const rolle = rolleAusGruppen(sso, ergebnis.groups)
  if (!user) {
    if (!sso.autoCreate) {
      addAudit('anmeldung', `Microsoft-Anmeldung ohne Konto abgewiesen: ${ergebnis.email} (automatische Kontenanlage ist aus)`)
      zurueck(ergebnis.target, `Für ${ergebnis.email} besteht kein Konto. Bitte an die Administration wenden.`)
      return
    }
    user = {
      id: uid('u'),
      firstName: ergebnis.firstName,
      lastName: ergebnis.lastName,
      email: ergebnis.email,
      phone: '',
      role: rolle ?? 'mitarbeiter',
      groupIds: allGroups().some((g) => g.id === 'gr-alle') ? ['gr-alle'] : [],
      locationId: allLocations()[0]?.id ?? '',
      language: 'de',
      lastLoginAt: Date.now(),
      ssoLoginAt: Date.now(),
    }
    upsertUser(user)
    addAudit('anmeldung', `Konto über Microsoft-Anmeldung angelegt: ${user.firstName} ${user.lastName} (${user.email})`, user.id)
    broadcast('state')
  } else {
    // Rolle aus den Entra-Gruppen nachführen – aber nie den letzten Administrator herabstufen
    if (rolle && rolle !== user.role && !(istLetzterAdmin(user.id) && rolle !== 'admin')) {
      user = { ...user, role: rolle }
      addAudit('admin', `Rolle über Entra-Gruppen angepasst: ${user.firstName} ${user.lastName} → ${rolle}`, user.id)
      broadcast('state')
    }
    user = { ...user, lastLoginAt: Date.now(), ssoLoginAt: Date.now() }
    upsertUser(user)
  }

  const { token } = createSession(user.id)
  addAudit('anmeldung', `Anmeldung über Microsoft: ${user.firstName} ${user.lastName} (${user.email})`, user.id)
  zurueck(ergebnis.target, undefined, token)
})

/** Verbindungstest: Mandant erreichbar, Anwendungs-ID und Geheimnis gültig */
router.post('/integrations/sso/test', auth, adminOnly, async (_req, res) => {
  const sso = integrations().sso
  if (!ssoKonfiguriert(sso)) {
    res.status(400).json({ error: 'Single Sign-On ist nicht vollständig eingerichtet (Mandant, Anwendungs-ID, Geheimnis).' })
    return
  }
  try {
    await ssoTest(sso)
    res.json({ ok: true })
  } catch (fehler) {
    res.status(502).json({ error: (fehler as Error).message })
  }
})

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    res.status(400).json({ error: 'Bitte E-Mail-Adresse und Passwort eingeben.' })
    return
  }
  const user = findStoredUserByEmail(normalizeEmail(String(email)))
  // Bewusst dieselbe Meldung für unbekannte Adresse und falsches Passwort
  if (!user) {
    res.status(401).json({ error: FALSCHE_ANMELDUNG })
    return
  }
  if (!user.passwordHash || !user.passwordSalt) {
    res.status(401).json({ error: 'Für dieses Konto ist noch kein Passwort gesetzt. Bitte an die Administration wenden.' })
    return
  }
  if (!verifyPassword(user, String(password))) {
    res.status(401).json({ error: FALSCHE_ANMELDUNG })
    return
  }

  const { token, expiresAt } = createSession(user.id)
  upsertUser({ ...user, lastLoginAt: Date.now() })
  addAudit('anmeldung', `Anmeldung: ${user.firstName} ${user.lastName} (${user.email})`, user.id)
  res.json({ token, expiresAt, user: publicUser({ ...user, lastLoginAt: Date.now() }) })
})

router.post('/auth/logout', auth, (req: AuthRequest, res) => {
  if (req.token) destroySession(req.token)
  res.json({ ok: true })
})

router.get('/auth/me', auth, (req: AuthRequest, res) => {
  res.json({ user: publicUser(req.user!) })
})

/** Eigenes Passwort ändern – Kenntnis des bisherigen vorausgesetzt */
router.post('/auth/password', auth, (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  const user = req.user!
  // Beim erzwungenen Erstwechsel ist das bisherige Passwort das Erstpasswort
  if (!verifyPassword(user, String(currentPassword ?? ''))) {
    res.status(400).json({ error: 'Das aktuelle Passwort ist falsch.' })
    return
  }
  const problem = passwordProblem(String(newPassword ?? ''))
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const salt = newSalt()
  upsertUser({ ...user, passwordSalt: salt, passwordHash: hashPassword(String(newPassword), salt), mustChangePassword: false })
  // Andere Geräte abmelden, das aktuelle bleibt angemeldet
  destroyUserSessions(user.id, req.token)
  addAudit('anmeldung', `Passwort geändert: ${user.firstName} ${user.lastName}`, user.id)
  broadcast('state')
  res.json({ ok: true })
})

// ---------- Datenbestand ----------

router.get('/state', auth, (_req, res) => {
  // serverInfo: Rolle und Ausweichadresse – die App merkt sich den Partner
  res.json({ ...fullState(), serverInfo: serverInfo() })
})

/** Live-Aktualisierung: Der Client lädt bei jedem Ereignis den Stand neu */
router.get('/events', (req, res) => {
  const token = String(req.query.token ?? '')
  if (!token || !sessionUserId(token)) {
    res.status(401).end()
    return
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()
  const entfernen = addClient(res)
  req.on('close', entfernen)
})

// ---------- Benutzerverwaltung ----------

function istLetzterAdmin(userId: string): boolean {
  const admins = allStoredUsers().filter((u) => u.role === 'admin')
  return admins.length === 1 && admins[0].id === userId
}

router.post('/users', auth, adminOnly, (req, res) => {
  const eingabe = req.body ?? {}
  const bestehend = eingabe.id ? findStoredUser(String(eingabe.id)) : null

  if (bestehend && istLetzterAdmin(bestehend.id) && eingabe.role !== 'admin') {
    res.status(400).json({ error: 'Dies ist der einzige Administrator – die Rolle kann nicht geändert werden.' })
    return
  }
  const email = normalizeEmail(String(eingabe.email ?? ''))
  if (!email) {
    res.status(400).json({ error: 'Bitte eine E-Mail-Adresse angeben.' })
    return
  }
  const belegt = findStoredUserByEmail(email)
  if (belegt && belegt.id !== bestehend?.id) {
    res.status(400).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' })
    return
  }

  const user: StoredUser = {
    id: bestehend?.id ?? String(eingabe.id ?? uid('u')),
    firstName: String(eingabe.firstName ?? '').trim(),
    lastName: String(eingabe.lastName ?? '').trim(),
    email,
    phone: String(eingabe.phone ?? ''),
    role: (['admin', 'krisenstab', 'mitarbeiter'].includes(eingabe.role) ? eingabe.role : 'mitarbeiter') as Role,
    groupIds: Array.isArray(eingabe.groupIds) ? eingabe.groupIds : [],
    locationId: String(eingabe.locationId ?? ''),
    language: (['de', 'en', 'fr', 'it'].includes(eingabe.language) ? eingabe.language : 'de') as StoredUser['language'],
    absence: eingabe.absence ?? undefined,
    partTimeNote: eingabe.partTimeNote || undefined,
    passwordHash: bestehend?.passwordHash,
    passwordSalt: bestehend?.passwordSalt,
    mustChangePassword: Boolean(eingabe.mustChangePassword),
    lastLoginAt: bestehend?.lastLoginAt,
    ssoLoginAt: bestehend?.ssoLoginAt,
  }
  if (!user.firstName || !user.lastName) {
    res.status(400).json({ error: 'Bitte Vor- und Nachname angeben.' })
    return
  }

  // Passwort optional mitgeben – es wird nie im Klartext gespeichert
  if (eingabe.password) {
    const problem = passwordProblem(String(eingabe.password))
    if (problem) {
      res.status(400).json({ error: problem })
      return
    }
    const salt = newSalt()
    user.passwordSalt = salt
    user.passwordHash = hashPassword(String(eingabe.password), salt)
    destroyUserSessions(user.id)
  }

  upsertUser(user)
  addAudit('admin', `${bestehend ? 'Benutzer aktualisiert' : 'Benutzer erstellt'}: ${user.firstName} ${user.lastName}`)
  broadcast('state')
  res.json({ user: publicUser(user) })
})

/** Passwort eines fremden Kontos setzen – nur für die Administration */
router.post('/users/:id/password', auth, adminOnly, (req, res) => {
  const ziel = findStoredUser(req.params.id)
  if (!ziel) {
    res.status(404).json({ error: 'Benutzer nicht gefunden.' })
    return
  }
  const problem = passwordProblem(String(req.body?.password ?? ''))
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const salt = newSalt()
  upsertUser({
    ...ziel,
    passwordSalt: salt,
    passwordHash: hashPassword(String(req.body.password), salt),
    mustChangePassword: Boolean(req.body?.mustChange),
  })
  // Bestehende Anmeldungen dieses Kontos beenden
  destroyUserSessions(ziel.id)
  addAudit('admin', `Passwort gesetzt für ${ziel.firstName} ${ziel.lastName}`)
  broadcast('state')
  res.json({ ok: true })
})

router.delete('/users/:id', auth, adminOnly, (req, res) => {
  if (istLetzterAdmin(req.params.id)) {
    res.status(400).json({ error: 'Der letzte Administrator kann nicht gelöscht werden.' })
    return
  }
  deleteUser(req.params.id)
  destroyUserSessions(req.params.id)
  addAudit('admin', 'Benutzer gelöscht')
  ensureAdmin()
  broadcast('state')
  res.json({ ok: true })
})

// ---------- Stammdaten ----------

const sammlungen = {
  scenarios: 'scenarios',
  plans: 'plans',
  contacts: 'contacts',
  buttons: 'buttons',
} as const

for (const [pfad, tabelle] of Object.entries(sammlungen)) {
  router.post(`/${pfad}`, auth, staffOnly, (req, res) => {
    const doc = req.body ?? {}
    const id = String(doc.id ?? uid(pfad.slice(0, 2)))
    upsertDoc(tabelle, id, { ...doc, id })
    addAudit('admin', `${pfad} gespeichert: ${doc.name ?? doc.title ?? id}`)
    broadcast('state')
    res.json({ id })
  })
  router.delete(`/${pfad}/:id`, auth, staffOnly, (req, res) => {
    deleteDoc(tabelle, req.params.id)
    addAudit('admin', `${pfad} gelöscht: ${req.params.id}`)
    broadcast('state')
    res.json({ ok: true })
  })
}

router.post('/groups', auth, adminOnly, (req, res) => {
  const g = req.body ?? {}
  const id = String(g.id ?? uid('gr'))
  upsertGroup({ id, name: String(g.name ?? ''), description: String(g.description ?? ''), isCrisisTeam: Boolean(g.isCrisisTeam) })
  addAudit('admin', `Gruppe gespeichert: ${g.name}`)
  broadcast('state')
  res.json({ id })
})

router.delete('/groups/:id', auth, adminOnly, (req, res) => {
  deleteDoc('groups', req.params.id)
  addAudit('admin', 'Gruppe gelöscht')
  broadcast('state')
  res.json({ ok: true })
})

router.post('/locations', auth, adminOnly, (req, res) => {
  const l = req.body ?? {}
  const id = String(l.id ?? uid('loc'))
  upsertLocation({
    id,
    name: String(l.name ?? ''),
    address: String(l.address ?? ''),
    geofence: l.geofence ?? undefined,
    operatingHours: l.operatingHours ?? { days: '', open: '', close: '' },
  })
  addAudit('admin', `Standort gespeichert: ${l.name}`)
  broadcast('state')
  res.json({ id })
})

router.delete('/locations/:id', auth, adminOnly, (req, res) => {
  deleteDoc('locations', req.params.id)
  addAudit('admin', 'Standort gelöscht')
  broadcast('state')
  res.json({ ok: true })
})

router.post('/integrations', auth, adminOnly, (req, res) => {
  // Maskierte Geheimnisse aus dem Client lassen den gespeicherten Wert unangetastet
  saveIntegrations(mergeIntegrationen(req.body ?? {}, integrations()))
  addAudit('admin', 'Integrationen gespeichert')
  broadcast('state')
  res.json({ ok: true })
})

// ---------- Redundanz: zweiter Alarmserver ----------

/** Konfiguration dieser Instanz samt Abgleich-Status – nur Administration */
router.get('/redundanz', auth, adminOnly, async (_req, res) => {
  const cfg = redundanzConfig()
  res.json({
    config: cfg,
    status: redundanzStatus(),
    peerErreichbar: await peerErreichbar(),
  })
})

router.post('/redundanz', auth, adminOnly, (req: AuthRequest, res) => {
  const o = req.body ?? {}
  const bisher = redundanzConfig()
  const peerUrl = String(o.peerUrl ?? '').trim().replace(/\/+$/, '')
  if (o.enabled && peerUrl && !/^https?:\/\//.test(peerUrl)) {
    res.status(400).json({ error: 'Die Adresse des Partnerservers muss mit http:// oder https:// beginnen.' })
    return
  }
  const cfg = {
    enabled: Boolean(o.enabled),
    role: o.role === 'standby' ? ('standby' as const) : ('primary' as const),
    peerUrl,
    // Leeres Feld: gespeichertes Geheimnis behalten; beim Einschalten ohne Geheimnis eines erzeugen
    secret: String(o.secret ?? '').trim() || bisher.secret || (o.enabled ? neuesRedundanzGeheimnis() : ''),
    intervalS: Math.min(600, Math.max(10, Number(o.intervalS) || 30)),
  }
  speichereRedundanz(cfg)
  addAudit('admin', `Redundanz ${cfg.enabled ? `aktiviert – Rolle ${cfg.role === 'primary' ? 'Hauptserver' : 'Standby'}, Partner ${cfg.peerUrl || '–'}` : 'deaktiviert'}.`, req.user!.id)
  broadcast('state')
  res.json({ config: redundanzConfig() })
})

/** Neues gemeinsames Geheimnis erzeugen – muss auf beiden Servern gleich sein */
router.post('/redundanz/schluessel', auth, adminOnly, (req: AuthRequest, res) => {
  const cfg = redundanzConfig()
  cfg.secret = neuesRedundanzGeheimnis()
  speichereRedundanz(cfg)
  addAudit('admin', 'Neues Redundanz-Geheimnis erzeugt – auf dem Partnerserver eintragen.', req.user!.id)
  res.json({ secret: cfg.secret })
})

// ---------- Replikation (Server-zu-Server, geschützt durch das gemeinsame Geheimnis) ----------

/** Vollständiger Datenbank-Abzug für den Partner */
router.get('/replikation/abzug', (req, res) => {
  if (!replikationsZugriffErlaubt(req.header('authorization'))) {
    res.status(401).json({ error: 'Replikation nicht erlaubt – Redundanz aus oder Geheimnis falsch.' })
    return
  }
  res.json(erzeugeAbzug())
})

/** Rückmeldung des Standby: während eines Failovers Erfasstes einarbeiten */
router.post('/replikation/rueckmeldung', (req, res) => {
  if (!replikationsZugriffErlaubt(req.header('authorization'))) {
    res.status(401).json({ error: 'Replikation nicht erlaubt – Redundanz aus oder Geheimnis falsch.' })
    return
  }
  const uebernommen = uebernehmeRueckmeldung(req.body ?? {})
  if (uebernommen > 0) {
    addAudit('system', `Redundanz: ${uebernommen} Einträge vom Standby-Server übernommen (während eines Ausfalls erfasst).`)
    broadcast('state')
  }
  res.json({ ok: true, uebernommen })
})

// ---------- Integrationen: Verbindungstests ----------

/** Test-SMS an die eigene Telefonnummer – prüft Zugangsdaten und Absender */
router.post('/integrations/sms/test', auth, adminOnly, async (req: AuthRequest, res) => {
  const sms = integrations().smsGateway
  if (!sms.enabled || !((sms.provider === 'http' && sms.httpUrl) || (sms.username && sms.password))) {
    res.status(400).json({ error: 'Das SMS-Gateway ist nicht vollständig eingerichtet (Anbieter, Zugangsdaten).' })
    return
  }
  const nummer = String(req.body?.to ?? req.user!.phone).trim()
  if (!nummer) {
    res.status(400).json({ error: 'Keine Telefonnummer: im eigenen Profil hinterlegen oder im Test angeben.' })
    return
  }
  const ergebnis = await sendeSms(sms, [nummer], 'Testmeldung SOBE Notfall: Das SMS-Gateway ist eingerichtet. Diese Meldung ist kein Alarm.')
  const r = [...ergebnis.values()][0]
  if (!r?.ok) {
    res.status(502).json({ error: `Versand fehlgeschlagen: ${r?.fehler ?? 'unbekannter Fehler'}` })
    return
  }
  const aktuell = integrations()
  aktuell.smsGateway.sentCount = (aktuell.smsGateway.sentCount ?? 0) + 1
  saveIntegrations(aktuell)
  addAudit('system', `Test-SMS an ${nummer} versendet (${sms.provider}).`, req.user!.id)
  broadcast('state')
  res.json({ ok: true })
})

/** Testkarte in den Teams-Kanal */
router.post('/integrations/teams/test', auth, adminOnly, async (req: AuthRequest, res) => {
  const teams = integrations().teams
  if (!teams.enabled || !teams.webhookUrl) {
    res.status(400).json({ error: 'Die Teams-Integration ist nicht eingerichtet (Kanal-Webhook-URL).' })
    return
  }
  const r = await sendeTeamsKarte(teams, {
    titel: 'Testmeldung SOBE Notfall',
    text: 'Die Teams-Integration ist eingerichtet. Diese Meldung ist kein Alarm.',
  })
  if (!r.ok) {
    res.status(502).json({ error: `Teams-Meldung fehlgeschlagen: ${r.fehler}` })
    return
  }
  addAudit('system', 'Testmeldung in den Teams-Kanal versendet.', req.user!.id)
  res.json({ ok: true })
})

/** Verbindung zu Microsoft Graph prüfen und eine Test-Konferenz anlegen */
router.post('/integrations/telephony/test', auth, adminOnly, async (req: AuthRequest, res) => {
  const tel = integrations().telephony
  if (!tel.enabled || !tel.tenantId || !tel.clientId || !tel.clientSecret) {
    res.status(400).json({ error: 'Sprachanrufe/Telefonkonferenz sind nicht eingerichtet (Mandant, Anwendungs-ID, Geheimnis).' })
    return
  }
  try {
    await graphToken(tel)
  } catch (fehler) {
    res.status(502).json({ error: (fehler as Error).message })
    return
  }
  if (!tel.organizerEmail) {
    res.json({ ok: true, hinweis: 'Anmeldung bei Microsoft erfolgreich. Für Telefonkonferenzen fehlt noch der Organisator.' })
    return
  }
  try {
    const konferenz = await erstelleKonferenz(tel, 'SOBE Notfall – Verbindungstest (kein Alarm)')
    addAudit('system', 'Verbindungstest Sprachanrufe/Telefonkonferenz erfolgreich.', req.user!.id)
    res.json({ ok: true, joinUrl: konferenz.joinUrl })
  } catch (fehler) {
    res.status(502).json({ error: `Anmeldung erfolgreich, aber die Test-Konferenz schlug fehl: ${(fehler as Error).message}` })
  }
})

// ---------- LoRaWAN: Alarmknöpfe ----------

/** Endpunkt-Adresse und Token für die Konfiguration im Netzserver – nur Administration */
router.get('/integrations/lorawan', auth, adminOnly, (req, res) => {
  const lorawan = integrations().lorawan
  res.json({ url: `${basisAdresse(req)}/api/hooks/lorawan`, token: lorawan.token || null, enabled: lorawan.enabled, provider: lorawan.provider })
})

/** Neues Token erzeugen – das alte gilt danach nicht mehr */
router.post('/integrations/lorawan/token', auth, adminOnly, (req: AuthRequest, res) => {
  const aktuell = integrations()
  aktuell.lorawan.token = neuesLorawanToken()
  saveIntegrations(aktuell)
  addAudit('admin', 'Neues Zugangstoken für den LoRaWAN-Endpunkt erzeugt.', req.user!.id)
  broadcast('state')
  res.json({ token: aktuell.lorawan.token })
})

/** Zwei Knopfdrücke kurz nacheinander gelten als ein Ereignis */
const KNOPF_DEBOUNCE_MS = 2 * 60_000

/**
 * Uplink-Endpunkt für das LoRaWAN-Netz (TTN, ChirpStack) oder GSM-Bridges.
 * Statusmeldungen aktualisieren Batterie und «letztes Signal»; ein Knopfdruck
 * löst den Alarm gemäss der Konfiguration des Knopfs aus.
 */
router.post('/hooks/lorawan', async (req, res) => {
  const lorawan = integrations().lorawan
  if (!lorawan.enabled) {
    res.status(403).json({ error: 'Der LoRaWAN-Endpunkt ist unter Integrationen nicht aktiviert.' })
    return
  }
  const token = lorawanTokenAusRequest(req.header('authorization'), typeof req.query.token === 'string' ? req.query.token : undefined)
  if (!lorawanTokenGueltig(lorawan, token)) {
    res.status(401).json({ error: 'Ungültiges Zugangstoken.' })
    return
  }
  const ereignis = parseLorawanUplink(req.body)
  if (!ereignis) {
    res.status(400).json({ error: 'Uplink nicht verstanden – erwartet TTN v3, ChirpStack v4 oder { serial, event, battery, lat, lng }.' })
    return
  }
  const knopf = allButtons().find((b) => normierteSerie(b.serial) === normierteSerie(ereignis.geraet))
  if (!knopf) {
    res.status(404).json({ error: `Kein Alarmknopf mit der Seriennummer ${ereignis.geraet} registriert.` })
    return
  }

  const aktualisiert = {
    ...knopf,
    lastSeen: Date.now(),
    batteryPct: ereignis.batteryPct ?? knopf.batteryPct,
    gps: ereignis.gps ?? knopf.gps,
  }
  upsertDoc('buttons', knopf.id, aktualisiert)

  if (!ereignis.alarm) {
    broadcast('state')
    res.json({ ok: true, alarm: null })
    return
  }

  // Doppelte Drücke desselben Knopfs innert kurzer Zeit nicht erneut auslösen
  const laufend = allAlarms().find(
    (a) => a.status === 'active' && a.triggeredVia === 'button' && a.message.includes(knopf.serial) && Date.now() - a.triggeredAt < KNOPF_DEBOUNCE_MS,
  )
  if (laufend) {
    broadcast('state')
    res.json({ ok: true, alarm: laufend.id, merged: true })
    return
  }

  const alarm = createAlarm({
    scenarioId: knopf.scenarioId ?? 'sc-gewalt',
    message: `${knopf.messageTemplate} (Knopf: ${knopf.name}, ${knopf.serial}${
      aktualisiert.gps ? `, GPS ${aktualisiert.gps.lat.toFixed(4)}/${aktualisiert.gps.lng.toFixed(4)}` : ''
    })`,
    silent: true,
    requireAck: true,
    channels: ['push', 'sms'],
    groupIds: knopf.targetGroupIds,
    locationIds: knopf.locationId ? [knopf.locationId] : [],
    triggeredByUserId: knopf.assignedUserId ?? 'system',
    triggeredVia: 'button',
    escalation: [
      { afterMinutes: knopf.escalateToEmergencyServicesAfterMin, channels: ['voice', 'sms'], groupIds: ['gr-krisenstab'], notifyEmergencyServices: true },
    ],
  })
  saveAlarm(alarm)
  addAudit('alarm', `Alarmknopf ausgelöst: ${knopf.name} (${knopf.serial}) – stille Alarmierung`, knopf.assignedUserId)
  broadcast('state')
  res.json({ ok: true, alarm: alarm.id })
  await alarmPush(alarm)
  await sendeAlarmKanaele(alarm)
  await ausgehendeWebhooks(alarm)
})

/** Rückrufe der Microsoft-Graph-Anrufschnittstelle – nur bestätigen */
router.post('/graph/callback', (_req, res) => {
  res.status(202).end()
})

// ---------- Geofencing: Aufenthaltsmeldung der App ----------

/**
 * Die App meldet beim Betreten oder Verlassen eines Standort-Geofences nur den
 * Standort-Namen (locationId) oder null («an keinem erfassten Standort») –
 * nie GPS-Koordinaten. Die Meldung dient allein der Empfängerauflösung.
 */
router.post('/geo/report', auth, (req: AuthRequest, res) => {
  if (!integrations().geofencing) {
    // Kein Fehler: Die App kann eine ältere Konfiguration haben – sie soll
    // daraus keinen Alarmzustand machen, sondern nur aufhören zu melden.
    res.json({ ok: false, disabled: true })
    return
  }
  const roh = req.body?.locationId
  const locationId = roh === null || roh === undefined || roh === '' ? null : String(roh)
  if (locationId !== null && !allLocations().some((l) => l.id === locationId)) {
    res.status(400).json({ error: 'Unbekannter Standort.' })
    return
  }
  setPresence(req.user!.id, locationId)
  res.json({ ok: true })
})

// ---------- Alarme ----------

/** Meldungen, die kein eigenes Ereignis sind (Einzelinfo, Krisenteam-Aufgebot) */
function istNebenmeldung(message: string): boolean {
  return message.startsWith('Info an') || message.startsWith('Krisenteam-Aufgebot')
}

/** Wie lange eine zweite Auslösung noch als dasselbe Ereignis gilt */
const ZUSAMMENFUEHREN_MS = 2 * 3600_000

/**
 * Läuft für dieses Szenario bereits ein Alarm am selben Standort, ist die neue
 * Auslösung eine weitere Meldung zum selben Ereignis – kein zweiter Alarm.
 */
function laufenderAlarmZu(neu: Alarm): Alarm | null {
  if (istNebenmeldung(neu.message)) return null
  return (
    allAlarms().find(
      (a) =>
        a.status === 'active' && a.scenarioId === neu.scenarioId && Boolean(a.drill) === Boolean(neu.drill) &&
        !istNebenmeldung(a.message) && Date.now() - a.triggeredAt < ZUSAMMENFUEHREN_MS &&
        (a.locationIds.length === 0 || neu.locationIds.length === 0 || a.locationIds.some((id) => neu.locationIds.includes(id))),
    ) ?? null
  )
}

router.post('/alarms', auth, async (req: AuthRequest, res) => {
  const o = req.body ?? {}
  const ausloeser = req.user!
  const alarm: Alarm = {
    ...createAlarm({
      scenarioId: String(o.scenarioId ?? ''),
      message: String(o.message ?? ''),
      silent: Boolean(o.silent),
      requireAck: Boolean(o.requireAck),
      channels: Array.isArray(o.channels) && o.channels.length ? o.channels : ['push'],
      groupIds: Array.isArray(o.groupIds) ? o.groupIds : [],
      locationIds: Array.isArray(o.locationIds) ? o.locationIds : [],
      triggeredByUserId: ausloeser.id,
      triggeredVia: o.triggeredVia ?? 'app',
      planId: o.planId,
      escalation: o.escalation,
      recipientUserIds: o.recipientUserIds,
    }),
    drill: Boolean(o.drill) || undefined,
  }
  const praefix = alarm.drill ? `${UEBUNG}: ` : ''

  // --- Zweite Auslösung zum selben Ereignis: zusammenführen ---
  const laufend = laufenderAlarmZu(alarm)
  if (laufend) {
    const jetzt = Date.now()
    const bekannt = new Set(laufend.deliveries.map((d) => d.userId))
    const neueEmpfaenger = [...new Set(alarm.deliveries.map((d) => d.userId))].filter((id) => !bekannt.has(id))
    const neueOrte = alarm.locationIds.filter((id) => !laufend.locationIds.includes(id))
    const update: AlarmUpdate = {
      ts: jetzt,
      kind: 'meldung',
      byUserId: ausloeser.id,
      message: `Weitere Meldung von ${ausloeser.firstName} ${ausloeser.lastName}: ${alarm.message}`,
    }
    const zusammengefuehrt: Alarm = {
      ...laufend,
      locationIds: laufend.locationIds.length === 0 ? [] : [...laufend.locationIds, ...neueOrte],
      updates: [...(laufend.updates ?? []), update],
      deliveries: [...laufend.deliveries, ...alarm.deliveries.filter((d) => neueEmpfaenger.includes(d.userId))],
      log: [
        ...laufend.log,
        {
          ts: jetzt,
          message: `Zweite Auslösung von ${ausloeser.firstName} ${ausloeser.lastName} zusammengeführt${
            neueEmpfaenger.length ? ` – ${neueEmpfaenger.length} zusätzliche Empfänger` : ''
          }: ${alarm.message}`,
        },
      ],
    }
    saveAlarm(zusammengefuehrt)
    addAudit('alarm', `${praefix}Weitere Meldung zum laufenden Alarm von ${ausloeser.firstName} ${ausloeser.lastName}: ${alarm.message}`, ausloeser.id)
    broadcast('state')
    res.json({ alarm: zusammengefuehrt, merged: true })
    if (neueEmpfaenger.length) {
      await alarmPush(zusammengefuehrt, neueEmpfaenger)
      await sendeAlarmKanaele(zusammengefuehrt, neueEmpfaenger)
    }
    await lagemeldungPush(zusammengefuehrt, update, [...bekannt])
    await sendeInfoKanaele(zusammengefuehrt, 'meldung', update.message)
    return
  }

  saveAlarm(alarm)
  addAudit('alarm', `${praefix}Alarm ausgelöst von ${ausloeser.firstName} ${ausloeser.lastName}: ${alarm.message}`, ausloeser.id)
  broadcast('state')
  // Versand nach der Antwort – ein langsamer Push darf die Auslösung nicht bremsen
  res.json({ alarm, merged: false })
  await alarmPush(alarm)
  await sendeAlarmKanaele(alarm)
  if (!alarm.drill) await ausgehendeWebhooks(alarm)
})

/**
 * Lagemeldung des Krisenstabs oder Fehlalarm-Meldung der auslösenden Person.
 * Beides geht als Push an alle Empfänger und steht in der Handlungsanweisung.
 */
router.post('/alarms/:id/update', auth, async (req: AuthRequest, res) => {
  const alarm = findAlarm(req.params.id)
  if (!alarm) {
    res.status(404).json({ error: 'Alarm nicht gefunden.' })
    return
  }
  if (alarm.status !== 'active') {
    res.status(409).json({ error: 'Der Alarm ist bereits beendet.' })
    return
  }
  const person = req.user!
  const istFuehrung = person.role === 'admin' || person.role === 'krisenstab'
  const istAusloeser = alarm.triggeredByUserId === person.id
  if (!istFuehrung && !istAusloeser) {
    res.status(403).json({ error: 'Lagemeldungen sind Krisenstab, Administration und der auslösenden Person vorbehalten.' })
    return
  }
  const text = String(req.body?.message ?? '').trim()
  const kind: AlarmUpdate['kind'] = req.body?.kind === 'fehlalarm' ? 'fehlalarm' : 'lage'
  if (kind === 'lage' && !istFuehrung) {
    res.status(403).json({ error: 'Lagemeldungen sind Krisenstab und Administration vorbehalten.' })
    return
  }
  if (kind === 'lage' && !text) {
    res.status(400).json({ error: 'Bitte eine Meldung eingeben.' })
    return
  }
  const jetzt = Date.now()
  const name = `${person.firstName} ${person.lastName}`
  const update: AlarmUpdate = {
    ts: jetzt,
    kind,
    byUserId: person.id,
    message: kind === 'fehlalarm'
      ? `FEHLALARM gemeldet von ${name}${text ? `: ${text}` : ''} – bitte auf die Entwarnung durch den Krisenstab warten.`
      : text,
  }
  const aktualisiert: Alarm = {
    ...alarm,
    updates: [...(alarm.updates ?? []), update],
    log: [...alarm.log, { ts: jetzt, message: kind === 'fehlalarm' ? update.message : `Lagemeldung von ${name}: ${text}` }],
  }
  saveAlarm(aktualisiert)
  addAudit('alarm', `${alarm.drill ? `${UEBUNG}: ` : ''}${kind === 'fehlalarm' ? 'Fehlalarm gemeldet' : 'Lagemeldung'} von ${name}: ${text || '(ohne Text)'}`, person.id)
  broadcast('state')
  res.json({ alarm: aktualisiert })
  // Ein gemeldeter Fehlalarm geht zusätzlich an den Krisenstab, damit jemand entwarnt
  const empfaenger = new Set(aktualisiert.deliveries.map((d) => d.userId))
  if (kind === 'fehlalarm') {
    const krisenGruppen = allGroups().filter((g) => g.isCrisisTeam).map((g) => g.id)
    for (const u of allStoredUsers()) if (u.groupIds.some((g) => krisenGruppen.includes(g))) empfaenger.add(u.id)
  }
  await lagemeldungPush(aktualisiert, update, [...empfaenger])
  await sendeInfoKanaele(aktualisiert, kind, update.message)
})

/** Bereitschaft: Geräte pro Standort, Sicherung, Push-Dienst, letzte Testmeldung */
router.get('/bereitschaft', auth, staffOnly, (_req, res) => {
  const geraete = geraeteProPerson()
  const personen = allStoredUsers()
  const geofencing = integrations().geofencing
  const aufenthalt = geofencing ? presenceMap() : new Map<string, { locationId: string | null; updatedAt: number }>()
  const standorte = allLocations().map((l) => {
    const dort = personen.filter((u) => u.locationId === l.id)
    return {
      id: l.id,
      name: l.name,
      personen: dort.length,
      mitGeraet: dort.filter((u) => geraete.has(u.id)).length,
      critical: dort.filter((u) => geraete.get(u.id)?.critical).length,
      // Geofencing: wie viele Personen sich laut App gerade hier aufhalten
      vorOrt: geofencing ? personen.filter((u) => aufenthalt.get(u.id)?.locationId === l.id).length : null,
    }
  })
  const ohneGeraet = personen
    .filter((u) => !geraete.has(u.id))
    .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, locationId: u.locationId }))
  res.json({
    standorte,
    ohneGeraet,
    tokensGesamt: [...geraete.values()].reduce((s, g) => s + g.geraete, 0),
    letzteSicherung: letzteSicherung(),
    pushDienst: pushDienstStatus(),
    letzterTestpush: letzterTestpush(),
    geofencing,
    ortsmeldungen: geofencing ? aufenthalt.size : null,
  })
})

/** Jüngste Sicherungsdatei im Sicherungsordner (siehe scripts/sicherung.mjs) */
function letzteSicherung(): { ts: number; datei: string } | null {
  const ordner = resolve(process.env.SOBE_BACKUP_DIR ?? join(homedir(), 'sicherung'))
  try {
    let beste: { ts: number; datei: string } | null = null
    for (const name of readdirSync(ordner)) {
      if (!/^sobe-.*\.sqlite$/.test(name)) continue
      const ts = statSync(join(ordner, name)).mtimeMs
      if (!beste || ts > beste.ts) beste = { ts, datei: name }
    }
    return beste
  } catch {
    return null
  }
}

/** Testmeldung an die eigenen Geräte – prüft die Kette bis aufs Telefon */
router.post('/bereitschaft/testpush', auth, staffOnly, async (req: AuthRequest, res) => {
  const anzahl = await testPush([req.user!.id])
  addAudit('system', `Testmeldung an ${anzahl} Gerät(e) von ${req.user!.firstName} ${req.user!.lastName} gesendet.`, req.user!.id)
  res.json({ ok: true, geraete: anzahl })
})

router.post('/alarms/:id/ack', auth, (req: AuthRequest, res) => {
  const alarm = findAlarm(req.params.id)
  if (!alarm) {
    res.status(404).json({ error: 'Alarm nicht gefunden.' })
    return
  }
  const ack: AckStatus = req.body?.ack === 'declined' ? 'declined' : 'acknowledged'
  const person = req.user!
  const jetzt = Date.now()
  const warEmpfaenger = alarm.deliveries.some((d) => d.userId === person.id)
  // Wer den Alarm gesehen hat, aber nicht zur alarmierten Gruppe gehört, wird
  // trotzdem erfasst – sonst behauptet das Journal eine Quittierung ohne Beleg
  const deliveries = warEmpfaenger
    ? alarm.deliveries.map((d) => (d.userId === person.id ? { ...d, ack, updatedAt: jetzt } : d))
    : [
        ...alarm.deliveries,
        { id: uid('dlv'), userId: person.id, channel: alarm.channels[0] ?? 'push', status: 'delivered' as const, ack, updatedAt: jetzt },
      ]
  const aktualisiert: Alarm = {
    ...alarm,
    deliveries,
    log: [
      ...alarm.log,
      {
        ts: jetzt,
        message: `${person.firstName} ${person.lastName} hat ${ack === 'acknowledged' ? 'quittiert (kommt)' : 'abgelehnt (nicht verfügbar)'}${
          warEmpfaenger ? '' : ' – war nicht Teil der Alarmierung'
        }`,
      },
    ],
  }
  saveAlarm(aktualisiert)
  broadcast('state')
  res.json({ alarm: aktualisiert })
})

/**
 * Ein SOS-Alarm oder ein abgelaufener Alleinarbeits-Timer darf von der Person
 * beendet werden, um die es geht («mir geht es gut») – etwa wenn sie vergessen
 * hat, den Timer zu verlängern.
 */
function darfSelbstEntwarnen(alarm: Alarm, person: StoredUser): boolean {
  return alarm.triggeredByUserId === person.id && (alarm.message.startsWith('SOS-Alarm') || alarm.triggeredVia === 'timer')
}

router.post('/alarms/:id/end', auth, async (req: AuthRequest, res) => {
  const alarm = findAlarm(req.params.id)
  if (!alarm) {
    res.status(404).json({ error: 'Alarm nicht gefunden.' })
    return
  }
  const person = req.user!
  const istFuehrung = person.role === 'admin' || person.role === 'krisenstab'
  if (!istFuehrung && !darfSelbstEntwarnen(alarm, person)) {
    res.status(403).json({ error: 'Alarme beenden dürfen Administration und Krisenstab – oder die betroffene Person ihren eigenen SOS- oder Alleinarbeits-Alarm.' })
    return
  }
  const note = String(req.body?.note ?? '').trim()
  const beendet: Alarm = {
    ...alarm,
    status: 'ended',
    endedAt: Date.now(),
    endNote: note || undefined,
    log: [...alarm.log, { ts: Date.now(), message: `Alarm beendet durch ${person.firstName} ${person.lastName} – Entwarnung versendet.${note ? ` «${note}»` : ''}` }],
  }
  saveAlarm(beendet)
  addAudit('alarm', `${alarm.drill ? `${UEBUNG}: ` : ''}Alarm beendet: ${alarm.message}${note ? ` – Entwarnung: ${note}` : ''}`, person.id)
  broadcast('state')
  res.json({ alarm: beendet })
  // Ein bereits beendeter Alarm soll nicht bei jedem Klick erneut «entwarnen»
  if (alarm.status === 'active') {
    await entwarnungPush(beendet)
    await sendeInfoKanaele(beendet, 'entwarnung', note || 'Der Alarm ist beendet.')
  }
})

// ---------- Alleinarbeit ----------

router.post('/lone-work', auth, (req: AuthRequest, res) => {
  const o = req.body ?? {}
  const dauer = Math.max(1, Number(o.durationMin ?? 30))
  const jetzt = Date.now()
  const sitzung = {
    id: uid('lw'),
    userId: req.user!.id,
    locationId: String(o.locationId ?? req.user!.locationId),
    activity: String(o.activity ?? 'Alleinarbeit'),
    startedAt: jetzt,
    durationMin: dauer,
    expiresAt: jetzt + dauer * 60_000,
    silent: Boolean(o.silent),
    status: 'running' as const,
    // Wer beim Ablauf alarmiert wird – leer heisst: Standardgruppen
    alertGroupIds: Array.isArray(o.alertGroupIds) ? o.alertGroupIds.map(String) : undefined,
    alertUserIds: Array.isArray(o.alertUserIds) ? o.alertUserIds.map(String) : undefined,
  }
  upsertDoc('lone_work', sitzung.id, sitzung)
  const ziele = [
    ...allGroups().filter((g) => (sitzung.alertGroupIds ?? []).includes(g.id)).map((g) => g.name),
    ...allStoredUsers().filter((u) => (sitzung.alertUserIds ?? []).includes(u.id)).map((u) => `${u.firstName} ${u.lastName}`),
  ]
  addAudit('alleinarbeit', `Alleinarbeits-Timer gestartet (${sitzung.activity}, ${dauer} Min.${ziele.length ? `, alarmiert bei Ablauf: ${ziele.join(', ')}` : ''})`, req.user!.id)
  broadcast('state')
  res.json({ session: sitzung })
})

/** Lebenszeichen: die zusätzlichen Minuten kommen zur bestehenden Restzeit hinzu */
router.post('/lone-work/:id/extend', auth, (req: AuthRequest, res) => {
  const sitzung = allLoneWork().find((s) => s.id === req.params.id)
  if (!sitzung) {
    res.status(404).json({ error: 'Timer nicht gefunden.' })
    return
  }
  const minuten = Math.max(1, Number(req.body?.minutes ?? 15))
  const aktualisiert = {
    ...sitzung,
    expiresAt: sitzung.expiresAt + minuten * 60_000,
    durationMin: sitzung.durationMin + minuten,
  }
  upsertDoc('lone_work', sitzung.id, aktualisiert)
  addAudit('alleinarbeit', `Alleinarbeits-Timer verlängert (+${minuten} Min. – Lebenszeichen erhalten)`, req.user!.id)
  broadcast('state')
  res.json({ session: aktualisiert })
})

router.post('/lone-work/:id/complete', auth, (req: AuthRequest, res) => {
  const sitzung = allLoneWork().find((s) => s.id === req.params.id)
  if (!sitzung) {
    res.status(404).json({ error: 'Timer nicht gefunden.' })
    return
  }
  upsertDoc('lone_work', sitzung.id, { ...sitzung, status: 'completed' })
  addAudit('alleinarbeit', 'Alleinarbeit sicher beendet', req.user!.id)
  broadcast('state')
  res.json({ ok: true })
})

// ---------- Aktualisierung ----------

router.get('/update/status', auth, adminOnly, async (_req, res) => {
  res.json({ version: await versionsInfo(), job: aktuellerJob() })
})

/** Schnelle Abfrage ohne Netzzugriff – für regelmässiges Nachsehen */
router.get('/update/job', auth, adminOnly, (_req, res) => {
  res.json({ job: aktuellerJob() })
})

router.post('/update', auth, adminOnly, async (req: AuthRequest, res) => {
  if (updateLaeuft()) {
    res.status(409).json({ error: 'Es läuft bereits eine Aktualisierung.' })
    return
  }
  const scope: UpdateScope = req.body?.scope === 'server+ios' ? 'server+ios' : 'server'
  if (scope === 'server+ios') {
    const info = await versionsInfo(false)
    if (!info.iosMoeglich) {
      res.status(400).json({ error: info.iosHinweis ?? 'Der iOS-Build ist auf diesem Server nicht eingerichtet.' })
      return
    }
  }
  const person = req.user!
  const job = starteUpdate(scope, `${person.firstName} ${person.lastName}`)
  addAudit('system', `Aktualisierung gestartet (${scope === 'server+ios' ? 'Server und iOS-App' : 'Server'})`, person.id)
  res.json({ job })
})

// ---------- Push-Registrierung ----------

router.post('/push/register', auth, (req: AuthRequest, res) => {
  const token = String(req.body?.token ?? '')
  if (!token.startsWith('ExponentPushToken') && !token.startsWith('ExpoPushToken')) {
    res.status(400).json({ error: 'Kein gültiges Expo-Push-Token.' })
    return
  }
  registerPushToken(
    req.user!.id,
    token,
    String(req.body?.platform ?? 'ios'),
    Boolean(req.body?.criticalAlerts),
  )
  res.json({ ok: true })
})

router.post('/push/unregister', auth, (req, res) => {
  removePushToken(String(req.body?.token ?? ''))
  res.json({ ok: true })
})
