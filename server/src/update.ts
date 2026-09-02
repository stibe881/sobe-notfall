import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { broadcast } from './events.js'
import { getSetting, setSetting } from './db.js'
import { addAudit } from './store.js'

/**
 * Aktualisierung per Knopfdruck.
 *
 * Statt über SSH zu pullen und von Hand zu bauen, führt der Server die immer
 * gleichen Schritte selbst aus: Quellcode holen, Abhängigkeiten aktualisieren,
 * Portal und Server bauen, optional den iOS-Build anstossen und zuletzt neu
 * starten. Es laufen ausschliesslich fest hinterlegte Befehle – der Client
 * wählt nur den Umfang, nie den Befehl.
 */

export type UpdateScope = 'server' | 'server+ios'
export type SchrittStatus = 'offen' | 'laufend' | 'erfolgreich' | 'fehlgeschlagen' | 'übersprungen'

export interface UpdateSchritt {
  id: string
  titel: string
  status: SchrittStatus
  /** Gekürzte Ausgabe des Befehls */
  ausgabe: string
  startedAt?: number
  finishedAt?: number
}

export interface UpdateJob {
  id: string
  scope: UpdateScope
  status: 'laufend' | 'erfolgreich' | 'fehlgeschlagen' | 'neustart'
  startedAt: number
  finishedAt?: number
  gestartetVon: string
  schritte: UpdateSchritt[]
  /** Link zum EAS-Build, sobald bekannt */
  buildUrl?: string
  /** Auftrag durchgelaufen, aber mit einer Einschränkung */
  hinweis?: string
  fehler?: string
}

const JOB_KEY = 'update_job'
const MAX_AUSGABE = 20_000

let laufenderJob: UpdateJob | null = null

/** Wurzel des Arbeitsverzeichnisses – der Server liegt in server/ darunter */
export function repoRoot(): string {
  return resolve(process.env.SOBE_REPO_ROOT ?? resolve(process.cwd(), '..'))
}

export function ladeLetztenJob(): UpdateJob | null {
  const roh = getSetting(JOB_KEY)
  if (!roh) return null
  try {
    const job = JSON.parse(roh) as UpdateJob
    // Ein gespeicherter Auftrag stammt aus einem früheren Prozess, sobald in
    // diesem keiner mehr läuft. Dann ist er abgeschlossen: «laufend» wurde vom
    // Neustart unterbrochen, «neustart» hat stattgefunden – sonst liefe dieser
    // Server nicht. Ohne diese Umschreibung bliebe der Auftrag dauerhaft auf
    // «Server startet neu» stehen und der Dialog zeigte nie wieder eine Auswahl.
    if (!laufenderJob && (job.status === 'laufend' || job.status === 'neustart')) {
      return { ...job, status: 'erfolgreich', finishedAt: job.finishedAt ?? Date.now() }
    }
    return job
  } catch {
    return null
  }
}

function speichereJob(job: UpdateJob): void {
  setSetting(JOB_KEY, JSON.stringify(job))
  broadcast('update')
}

export const aktuellerJob = () => laufenderJob ?? ladeLetztenJob()

// ---------- Befehlsausführung ----------

interface BefehlErgebnis {
  code: number
  ausgabe: string
}

/**
 * Geheimnisse aus der Ausgabe entfernen.
 * Das Protokoll eines Laufs wird im Portal angezeigt – ein Zugangstoken, das
 * ein Werkzeug versehentlich ausgibt, darf dort nicht landen.
 */
function unkenntlich(text: string): string {
  let sauber = text
  for (const name of ['EXPO_TOKEN', 'SOBE_ADMIN_PASSWORD', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const wert = process.env[name]
    if (wert && wert.length >= 8) sauber = sauber.split(wert).join(`«${name} entfernt»`)
  }
  return sauber
}

/**
 * Unter Windows sind npm und npx Batch-Dateien (npm.cmd, npx.cmd). Node kann
 * solche Dateien seit den Sicherheitskorrekturen von 2024 nicht mehr direkt
 * starten – ohne Shell scheitert der Aufruf mit ENOENT. Für diese beiden
 * Befehle wird dort deshalb die Shell verwendet. Die Argumente stammen
 * ausschliesslich aus dem fest hinterlegten Ablaufplan, nie vom Client.
 */
function brauchtShell(befehl: string): boolean {
  return process.platform === 'win32' && (befehl === 'npm' || befehl === 'npx')
}

/**
 * Einen fest hinterlegten Befehl ausführen. Argumente werden als Array
 * übergeben; ausser für npm und npx unter Windows läuft alles ohne Shell,
 * damit keine Befehlsverkettung möglich ist.
 */
function fuehreAus(
  befehl: string,
  argumente: string[],
  arbeitsverzeichnis: string,
  beiAusgabe: (text: string) => void,
  timeoutMs = 45 * 60_000,
  zusatzUmgebung: Record<string, string> = {},
): Promise<BefehlErgebnis> {
  return new Promise((fertig) => {
    let ausgabe = ''
    const sammeln = (daten: Buffer) => {
      const text = unkenntlich(daten.toString())
      ausgabe = (ausgabe + text).slice(-MAX_AUSGABE)
      beiAusgabe(text)
    }

    const kind = spawn(befehl, argumente, {
      cwd: arbeitsverzeichnis,
      env: { ...process.env, CI: '1', npm_config_fund: 'false', npm_config_audit: 'false', ...zusatzUmgebung },
      shell: brauchtShell(befehl),
      windowsHide: true,
    })
    const uhr = setTimeout(() => {
      kind.kill('SIGKILL')
      ausgabe += '\n[abgebrochen: Zeitüberschreitung]'
    }, timeoutMs)

    kind.stdout.on('data', sammeln)
    kind.stderr.on('data', sammeln)
    kind.on('error', (fehler) => {
      clearTimeout(uhr)
      const hinweis =
        (fehler as NodeJS.ErrnoException).code === 'ENOENT'
          ? `\n[${befehl} wurde nicht gefunden. Ist es installiert und im Suchpfad des Benutzers, unter dem der Server läuft?]`
          : `\n[${befehl} nicht ausführbar: ${fehler.message}]`
      fertig({ code: 127, ausgabe: ausgabe + hinweis })
    })
    kind.on('close', (code) => {
      clearTimeout(uhr)
      fertig({ code: code ?? 1, ausgabe })
    })
  })
}

/** Kurzausgabe eines Befehls, für Versionsabfragen */
async function still(befehl: string, argumente: string[], verzeichnis: string): Promise<string> {
  const { code, ausgabe } = await fuehreAus(befehl, argumente, verzeichnis, () => {}, 60_000)
  return code === 0 ? ausgabe.trim() : ''
}

// ---------- Versionsinformationen ----------

export interface VersionsInfo {
  branch: string
  commit: string
  commitKurz: string
  commitDatum: string
  commitTitel: string
  /** Anzahl Commits, die auf dem Server noch fehlen */
  hinterher: number
  /**
   * Gibt es diesen Branch auch auf dem Repository (origin)? Ein nur lokal
   * angelegter Branch hat dort nichts zu holen – die Aktualisierung baut dann
   * den vorhandenen Stand neu, statt an einem Pull zu scheitern.
   */
  remoteVorhanden: boolean
  /** Ob der iOS-Build möglich ist (Zugangstoken hinterlegt) */
  iosMoeglich: boolean
  iosHinweis?: string
  /** Ob ein Neustart nach dem Update möglich ist */
  neustartMoeglich: boolean
}

/**
 * Aktueller Branch des Arbeitsverzeichnisses. Bei losgelöstem HEAD (checkout
 * eines Commits statt eines Branches) liefert git «HEAD» – dann gibt es keinen
 * Branch, von dem sich ziehen liesse.
 */
async function aktuellerBranch(root: string): Promise<string | null> {
  const branch = await still('git', ['rev-parse', '--abbrev-ref', 'HEAD'], root)
  return branch && branch !== 'HEAD' ? branch : null
}

/** Existiert der Branch nach dem Holen auch auf origin? */
async function branchAufOrigin(root: string, branch: string): Promise<boolean> {
  return Boolean(await still('git', ['rev-parse', '--verify', '--quiet', `origin/${branch}`], root))
}

export async function versionsInfo(pruefeRemote = true): Promise<VersionsInfo> {
  const root = repoRoot()
  const branch = await aktuellerBranch(root)
  const commit = (await still('git', ['rev-parse', 'HEAD'], root)) || ''
  const commitTitel = (await still('git', ['log', '-1', '--pretty=%s'], root)) || ''
  const commitDatum = (await still('git', ['log', '-1', '--pretty=%cI'], root)) || ''

  let hinterher = 0
  let remoteVorhanden = false
  if (branch) {
    if (pruefeRemote) await still('git', ['fetch', 'origin', branch], root)
    remoteVorhanden = await branchAufOrigin(root, branch)
    if (remoteVorhanden) {
      const zaehler = await still('git', ['rev-list', '--count', `HEAD..origin/${branch}`], root)
      hinterher = Number(zaehler) || 0
    }
  }

  const expoToken = Boolean(process.env.EXPO_TOKEN)
  const mobileDa = existsSync(resolve(root, 'mobile', 'package.json'))

  return {
    branch: branch ?? 'unbekannt',
    commit,
    commitKurz: commit.slice(0, 7),
    commitDatum,
    commitTitel,
    hinterher,
    remoteVorhanden,
    iosMoeglich: expoToken && mobileDa,
    iosHinweis: !mobileDa
      ? 'Der Ordner mobile/ fehlt auf dem Server.'
      : !expoToken
        ? 'Für den iOS-Build fehlt die Umgebungsvariable EXPO_TOKEN (Zugangstoken von expo.dev).'
        : undefined,
    neustartMoeglich: process.env.SOBE_AUTO_RESTART !== 'false',
  }
}

// ---------- Ablauf ----------

interface SchrittDefinition {
  id: string
  titel: string
  befehl: string
  argumente: string[]
  verzeichnis: (root: string) => string
  /** Fehler hier bricht den Auftrag nicht ab */
  optional?: boolean
  timeoutMs?: number
  /** Zusätzliche Umgebungsvariablen nur für diesen Schritt */
  umgebung?: Record<string, string>
  /** Schritt entfällt in diesem Lauf – der Text erklärt, warum */
  uebersprungen?: string
}

function schrittPlan(scope: UpdateScope, branch: string | null, remoteVorhanden: boolean): SchrittDefinition[] {
  // Der Pull nennt Branch und origin ausdrücklich, damit die Aktualisierung
  // auf jedem Branch funktioniert – auch auf einem, der ohne Tracking
  // ausgecheckt wurde. Für einen Branch, den es nur auf diesem Server gibt
  // (oder bei losgelöstem HEAD), gibt es nichts zu holen: Der Schritt entfällt
  // sichtbar, und der vorhandene Stand wird trotzdem neu gebaut.
  const pull: SchrittDefinition =
    branch && remoteVorhanden
      ? {
          id: 'pull', titel: 'Quellcode aktualisieren',
          befehl: 'git', argumente: ['pull', '--ff-only', 'origin', branch], verzeichnis: (r) => r,
        }
      : {
          id: 'pull', titel: 'Quellcode aktualisieren',
          befehl: 'git', argumente: [], verzeichnis: (r) => r,
          uebersprungen: branch
            ? `Der Branch «${branch}» existiert nur auf diesem Server – es gibt nichts zu holen. Der vorhandene Stand wird neu gebaut.`
            : 'Das Arbeitsverzeichnis steht auf keinem Branch (losgelöster Commit) – es gibt nichts zu holen. Der vorhandene Stand wird neu gebaut.',
        }

  const schritte: SchrittDefinition[] = [
    {
      id: 'fetch', titel: 'Änderungen vom Repository holen',
      befehl: 'git', argumente: ['fetch', '--all', '--prune'], verzeichnis: (r) => r,
    },
    pull,
    {
      id: 'deps-web', titel: 'Abhängigkeiten des Portals aktualisieren',
      // --foreground-scripts: Neuere npm-Versionen sperren Installationsskripte, wenn
      // das Paket nicht unter allowScripts in package.json steht. Ohne diesen Schalter
      // steht die Warnung nirgends und der Build scheitert später ohne erkennbaren Grund.
      befehl: 'npm', argumente: ['install', '--no-audit', '--no-fund', '--foreground-scripts'], verzeichnis: (r) => r,
    },
    {
      id: 'build-web', titel: 'Portal bauen',
      befehl: 'npm', argumente: ['run', 'build'], verzeichnis: (r) => r,
    },
    {
      id: 'deps-server', titel: 'Abhängigkeiten des Servers aktualisieren',
      befehl: 'npm', argumente: ['install', '--no-audit', '--no-fund', '--foreground-scripts'], verzeichnis: (r) => resolve(r, 'server'),
    },
    {
      id: 'build-server', titel: 'Server bauen',
      befehl: 'npm', argumente: ['run', 'build'], verzeichnis: (r) => resolve(r, 'server'),
    },
  ]

  if (scope === 'server+ios') {
    schritte.push(
      {
        id: 'deps-app', titel: 'Abhängigkeiten der App aktualisieren',
        befehl: 'npm', argumente: ['install', '--no-audit', '--no-fund', '--foreground-scripts'], verzeichnis: (r) => resolve(r, 'mobile'),
      },
      {
        id: 'ios-build', titel: 'iOS-Build anstossen (läuft bei Expo weiter)',
        befehl: 'npx',
        argumente: [
          '--yes', 'eas-cli', 'build',
          '--platform', 'ios',
          '--profile', 'production',
          '--non-interactive',
          '--auto-submit',
          // Nicht auf den Build warten: Er läuft auf den Servern von Expo, die
          // Übermittlung an TestFlight schliesst dort automatisch an. Ohne dies
          // hinge der Auftrag 20 bis 45 Minuten, der Server könnte nicht neu
          // starten, und ein Abbruch der Verbindung sähe wie ein Fehlschlag aus.
          '--no-wait',
        ],
        verzeichnis: (r) => resolve(r, 'mobile'),
        // Hochladen des Projekts kann bei langsamer Leitung dauern
        timeoutMs: 20 * 60_000,
        // Ohne diese Einstellung verlangt eas-cli im nicht interaktiven Betrieb
        // ein sauberes Git-Verzeichnis. Nach npm install sind die Lock-Dateien
        // aber oft verändert, und der Build bräche nach allen anderen Schritten
        // ab. Mit EAS_NO_VCS packt EAS das Arbeitsverzeichnis direkt und
        // beachtet dabei weiterhin .gitignore und .easignore.
        umgebung: { EAS_NO_VCS: '1' },
      },
    )
  }
  return schritte
}

/** Build-Adresse aus der Ausgabe der EAS-CLI herausziehen */
/**
 * Ohne Rückfragen kann EAS die Übermittlung an TestFlight nur anstossen, wenn
 * die App-Store-Connect-ID der App in eas.json steht (submit.production.ios.ascAppId).
 * Fehlt sie, wird der Build zwar angelegt, aber nie übermittelt.
 */
function fehltAscAppId(root: string): boolean {
  try {
    const eas = JSON.parse(readFileSync(resolve(root, 'mobile', 'eas.json'), 'utf8')) as {
      submit?: { production?: { ios?: { ascAppId?: string } } }
    }
    return !eas.submit?.production?.ios?.ascAppId
  } catch {
    return true
  }
}

/** Die letzten Fehlerzeilen der EAS-Ausgabe, damit der Hinweis den echten Grund nennt */
function easFehlerzeilen(text: string): string {
  const zeilen = text
    .split('\n')
    .map((z) => z.replace(/\u001b\[[0-9;]*m/g, '').trim())
    .filter((z) => /error|✖|fehl|ascAppId|non-interactive|credentials/i.test(z))
  return zeilen.slice(-3).join(' · ')
}

function findeBuildUrl(text: string): string | undefined {
  // Nur echte Build-Adressen zählen: Fehlermeldungen enthalten auch Links auf
  // Projekt- oder Credentials-Seiten unter expo.dev/accounts/… – die belegen
  // keinen angelegten Build.
  const treffer = text.match(/https:\/\/expo\.dev\/accounts\/[^\s)]+\/builds\/[^\s)]+/g)
  return treffer?.[treffer.length - 1]
}

/**
 * Fehlen bei Expo die App-Store-Connect-Zugangsdaten, bricht eas-cli mit
 * --auto-submit im nicht interaktiven Betrieb den ganzen Befehl ab, bevor
 * überhaupt ein Build angelegt ist («Run this command again in interactive
 * mode»). Dann lohnt sich ein zweiter Versuch ohne Übermittlung.
 */
function istCredentialsAbbruch(ausgabe: string, buildUrl: string | undefined): boolean {
  return !buildUrl && /credentials|interactive mode/i.test(ausgabe)
}

export function updateLaeuft(): boolean {
  return laufenderJob?.status === 'laufend'
}

export async function starteUpdate(scope: UpdateScope, gestartetVon: string): Promise<UpdateJob> {
  // Branch und Herkunft vor dem Lauf bestimmen – davon hängt der Pull-Schritt ab
  const root = repoRoot()
  const branch = await aktuellerBranch(root)
  const remoteVorhanden = branch ? await branchAufOrigin(root, branch) : false
  const plan = schrittPlan(scope, branch, remoteVorhanden)
  const job: UpdateJob = {
    id: `upd-${Date.now().toString(36)}`,
    scope,
    status: 'laufend',
    startedAt: Date.now(),
    gestartetVon,
    schritte: plan.map((s) => ({ id: s.id, titel: s.titel, status: 'offen', ausgabe: '' })),
  }
  laufenderJob = job
  speichereJob(job)
  void abarbeiten(job, plan)
  return job
}

async function abarbeiten(job: UpdateJob, plan: SchrittDefinition[]): Promise<void> {
  const root = repoRoot()

  for (let i = 0; i < plan.length; i++) {
    const definition = plan[i]
    const schritt = job.schritte[i]

    if (definition.uebersprungen) {
      schritt.status = 'übersprungen'
      schritt.ausgabe = definition.uebersprungen
      speichereJob(job)
      continue
    }

    schritt.status = 'laufend'
    schritt.startedAt = Date.now()
    speichereJob(job)

    let letzterFunk = 0
    const { code, ausgabe } = await fuehreAus(
      definition.befehl,
      definition.argumente,
      definition.verzeichnis(root),
      (text) => {
        schritt.ausgabe = (schritt.ausgabe + text).slice(-MAX_AUSGABE)
        // Nicht bei jedem Zeichen senden, sonst überflutet es die Clients
        if (Date.now() - letzterFunk > 1000) {
          letzterFunk = Date.now()
          speichereJob(job)
        }
      },
      definition.timeoutMs,
      definition.umgebung,
    )

    schritt.ausgabe = ausgabe
    schritt.finishedAt = Date.now()
    schritt.status = code === 0 ? 'erfolgreich' : 'fehlgeschlagen'

    let fehlgeschlagen = code !== 0

    // Der einzige Grund, aus dem der ausdrückliche Pull scheitert: Auf dem
    // Server liegen eigene Commits, die es auf origin nicht gibt. Das darf die
    // Aktualisierung nicht stillschweigend überschreiben - aber der Hinweis
    // soll den Weg nennen.
    if (fehlgeschlagen && definition.id === 'pull' && /fast-forward|divergent|rebase/i.test(ausgabe)) {
      schritt.ausgabe = (schritt.ausgabe +
        '\n\n[Auf diesem Server liegen eigene Commits, die es auf dem Repository nicht gibt - der Stand lässt sich nicht ' +
        'automatisch zusammenführen. Auf dem Server per SSH prüfen: «git status» und «git log origin/' +
        `${(await aktuellerBranch(root)) ?? ''}..HEAD». Entweder die eigenen Commits pushen oder mit ` +
        '«git reset --hard origin/<branch>» verwerfen - Letzteres löscht sie unwiderruflich.]'
      ).slice(-MAX_AUSGABE)
    }
    if (definition.id === 'ios-build') {
      job.buildUrl = findeBuildUrl(ausgabe)

      // Übermittlungs-Zugangsdaten fehlen bei Expo: Der Abbruch kommt vor dem
      // Build. Zweiter Versuch ohne --auto-submit, damit der Build wenigstens
      // läuft; die Übermittlung braucht die einmalige interaktive Einrichtung.
      if (fehlgeschlagen && istCredentialsAbbruch(ausgabe, job.buildUrl)) {
        schritt.ausgabe = (schritt.ausgabe +
          '\n\n[Die App-Store-Connect-Zugangsdaten sind bei Expo nicht hinterlegt – zweiter Versuch ohne Übermittlung an TestFlight …]\n'
        ).slice(-MAX_AUSGABE)
        speichereJob(job)
        const zweiter = await fuehreAus(
          definition.befehl,
          definition.argumente.filter((a) => a !== '--auto-submit'),
          definition.verzeichnis(root),
          (text) => {
            schritt.ausgabe = (schritt.ausgabe + text).slice(-MAX_AUSGABE)
            if (Date.now() - letzterFunk > 1000) {
              letzterFunk = Date.now()
              speichereJob(job)
            }
          },
          definition.timeoutMs,
          definition.umgebung,
        )
        job.buildUrl = findeBuildUrl(zweiter.ausgabe)
        if (zweiter.code === 0 || job.buildUrl) {
          fehlgeschlagen = false
          schritt.status = 'erfolgreich'
          job.hinweis =
            'Der iOS-Build läuft bei Expo – aber ohne automatische Übermittlung an TestFlight: ' +
            'Die App-Store-Connect-Zugangsdaten sind bei Expo noch nicht hinterlegt. Einmalig auf einem Rechner ' +
            '«npx eas-cli build --platform ios --profile production --auto-submit» mit Rückfragen ausführen ' +
            '(mobile/CRITICAL-ALERTS.md, Abschnitt «Übermittlung an TestFlight»); danach übermittelt auch der ' +
            'Server automatisch. Diesen Build von Hand übergeben: «npx eas-cli submit --platform ios --latest».'
          schritt.ausgabe = (schritt.ausgabe + `\n\n[${job.hinweis}]`).slice(-MAX_AUSGABE)
        }
      }
      // Steht eine Build-Adresse in der Ausgabe, wurde der Build bei Expo
      // angelegt und läuft dort weiter. Ein Fehler danach betrifft die
      // Übermittlung an TestFlight, nicht den Build. Der Auftrag darf deshalb
      // nicht als gescheitert gelten - sonst bliebe der frisch gebaute Server
      // auf dem alten Stand, weil der Neustart ausbliebe.
      if (fehlgeschlagen && job.buildUrl) {
        fehlgeschlagen = false
        schritt.status = 'erfolgreich'
        const grund = fehltAscAppId(repoRoot())
          ? 'In mobile/eas.json fehlt submit.production.ios.ascAppId (die Apple-ID der App aus App Store Connect).'
          : easFehlerzeilen(ausgabe) || 'Grund siehe Ausgabe des Schritts.'
        job.hinweis =
          'Der iOS-Build läuft bei Expo, die Übermittlung an TestFlight ist aber nicht angelaufen. ' +
          grund + ' Siehe mobile/CRITICAL-ALERTS.md, Abschnitt «Übermittlung an TestFlight».'
        schritt.ausgabe += `\n\n[${job.hinweis}]`
      } else if (!fehlgeschlagen && fehltAscAppId(repoRoot())) {
        // Der Build wurde angenommen, aber ohne ascAppId legt Expo keine Übermittlung an
        job.hinweis =
          'Der iOS-Build läuft bei Expo. Die Übermittlung an TestFlight wird nicht anlaufen: ' +
          'In mobile/eas.json fehlt submit.production.ios.ascAppId (die Apple-ID der App aus App Store Connect). ' +
          'Siehe mobile/CRITICAL-ALERTS.md, Abschnitt «Übermittlung an TestFlight».'
        schritt.ausgabe += `\n\n[${job.hinweis}]`
      }
    }

    if (fehlgeschlagen && !definition.optional) {
      job.status = 'fehlgeschlagen'
      job.fehler = `Schritt «${definition.titel}» ist fehlgeschlagen.`
      job.finishedAt = Date.now()
      for (const rest of job.schritte.slice(i + 1)) rest.status = 'übersprungen'
      speichereJob(job)
      addAudit('system', `Aktualisierung fehlgeschlagen: ${definition.titel}`)
      laufenderJob = null
      return
    }
    speichereJob(job)
  }

  job.finishedAt = Date.now()
  const neustart = process.env.SOBE_AUTO_RESTART !== 'false'
  job.status = neustart ? 'neustart' : 'erfolgreich'
  speichereJob(job)
  addAudit('system', `Aktualisierung abgeschlossen (${job.scope === 'server+ios' ? 'Server und iOS-App' : 'Server'})`)
  laufenderJob = null

  if (neustart) {
    // Der Prozess beendet sich; ein Dienstverwalter (systemd, pm2 oder das
    // mitgelieferte Startskript) startet ihn mit dem neuen Stand wieder
    setTimeout(() => process.exit(0), 2000)
  }
}
