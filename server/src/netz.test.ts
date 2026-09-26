import { createServer } from 'node:http'
import { fetchMitFrist } from './netz.js'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

// Ein Dienst, der nie antwortet – so sieht ein hängender Push-Dienst aus
const stumm = createServer(() => { /* absichtlich keine Antwort */ })
await new Promise<void>((ok) => stumm.listen(0, '127.0.0.1', () => ok()))
const port = (stumm.address() as { port: number }).port

const start = Date.now()
let abgebrochen = false
try {
  await fetchMitFrist(`http://127.0.0.1:${port}/`, {}, 300)
} catch {
  abgebrochen = true
}
const dauer = Date.now() - start
pruefe('ein stummer Dienst wird abgebrochen', abgebrochen)
pruefe(`der Abbruch kommt zur Frist (${dauer} ms, erwartet ~300)`, dauer >= 250 && dauer < 2000)

// Ein Dienst, der antwortet, bleibt unbehelligt
const flink = createServer((_req, res) => { res.end('ok') })
await new Promise<void>((ok) => flink.listen(0, '127.0.0.1', () => ok()))
const port2 = (flink.address() as { port: number }).port
const antwort = await fetchMitFrist(`http://127.0.0.1:${port2}/`, {}, 2000)
pruefe('ein antwortender Dienst wird nicht gestört', antwort.ok && (await antwort.text()) === 'ok')

// Eine eigene Abbruchsteuerung hat Vorrang
const eigene = new AbortController()
eigene.abort()
let eigenerAbbruch = false
try { await fetchMitFrist(`http://127.0.0.1:${port2}/`, { signal: eigene.signal }, 5000) } catch { eigenerAbbruch = true }
pruefe('eine mitgegebene Abbruchsteuerung bleibt massgebend', eigenerAbbruch)

stumm.closeAllConnections?.(); stumm.close(); flink.close()
console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
