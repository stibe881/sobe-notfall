// Muss als erstes stehen: lädt server/.env, bevor andere Module process.env lesen
import './env.js'
import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { purgeExpiredSessions } from './auth.js'
import { repoRoot } from './update.js'
import { startEngine } from './engine.js'
import { startHeartbeat } from './events.js'
import { starteReplikation } from './replikation.js'
import { router } from './routes.js'
import { INITIAL_ADMIN_EMAIL, seedDatabase } from './setup.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

/**
 * Verzeichnis mit dem gebauten Webportal.
 * Liegt es vor, liefert der Server Portal und Schnittstelle unter derselben
 * Adresse aus – im Hosting die einfachste Variante: ein Zertifikat, keine
 * CORS-Fragen, kein Mixed-Content.
 */
const WEB_ROOT = resolve(process.env.SOBE_WEB_ROOT ?? resolve(process.cwd(), '..', 'dist'))
const webVorhanden = existsSync(resolve(WEB_ROOT, 'index.html'))

const app = express()
// Hinter dem Proxy des Hosters steht die echte Adresse im Weiterleitungskopf
app.set('trust proxy', true)
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }))
app.use('/api', router)

// Die Handbücher aus docs/ liefert der Server direkt mit aus – sie liegen im
// Arbeitsverzeichnis und sind damit nach jeder Aktualisierung automatisch auf
// dem Stand der installierten Version. Das Portal verlinkt sie unter «Hilfe».
const DOCS_ROOT = resolve(repoRoot(), 'docs')
if (existsSync(resolve(DOCS_ROOT, 'handbuch-1-administration.html'))) {
  app.use('/handbuecher', express.static(DOCS_ROOT, { maxAge: '1h', etag: true }))
}

if (webVorhanden) {
  // Gebaute Dateien mit Prüfsumme im Namen dürfen lange zwischengespeichert
  // werden, index.html nie – sonst sehen Geräte nach einem Update den alten Stand
  app.use(express.static(WEB_ROOT, { index: false, maxAge: '1y', etag: true }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.set('Cache-Control', 'no-store')
    res.sendFile(resolve(WEB_ROOT, 'index.html'))
  })
}

// Fehler nie ungefiltert nach aussen geben
app.use((fehler: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api]', fehler)
  res.status(500).json({ error: 'Interner Serverfehler.' })
})

seedDatabase()
purgeExpiredSessions()
startEngine()
startHeartbeat()
starteReplikation()

app.listen(PORT, HOST, () => {
  console.log(`SOBE-Notfall-Alarmserver läuft auf http://localhost:${PORT}`)
  console.log(
    webVorhanden
      ? `Webportal wird mit ausgeliefert aus ${WEB_ROOT}`
      : `Kein Webportal unter ${WEB_ROOT} – nur die Schnittstelle unter /api`,
  )
  console.log(`Administrator: ${INITIAL_ADMIN_EMAIL}`)
})
