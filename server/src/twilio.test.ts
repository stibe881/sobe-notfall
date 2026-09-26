import { alsE164, twilioAnrufAnfrage, twilioKopf, twilioSmsAnfrage } from './twilio.js'

let fehler = 0
let gezaehlt = 0
function pruefe(name: string, bedingung: boolean): void {
  gezaehlt++
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

// --- Nummern: so stehen sie im Bestand, so verlangt sie Twilio ---
pruefe('079 123 45 67 → +41791234567', alsE164('079 123 45 67') === '+41791234567')
pruefe('+41 79 123 45 67 bleibt', alsE164('+41 79 123 45 67') === '+41791234567')
pruefe('0041… wird zu +41…', alsE164('0041791234567') === '+41791234567')
pruefe('041 767 78 33 (Festnetz) → +41417677833', alsE164('041 767 78 33') === '+41417677833')
pruefe('deutsche Nummer mit +49 bleibt', alsE164('+49 170 1234567') === '+491701234567')
pruefe('leer bleibt leer', alsE164('') === '')

// --- SMS-Anfrage ---
const sms = twilioSmsAnfrage('ACabc', 'SOBE', '079 123 45 67', 'Brand im Trakt B')
pruefe('SMS geht an den Messages-Endpunkt des Kontos', sms.url === 'https://api.twilio.com/2010-04-01/Accounts/ACabc/Messages.json')
const smsFelder = new URLSearchParams(sms.body)
pruefe('Ziel ist E.164', smsFelder.get('To') === '+41791234567')
pruefe('alphanumerischer Absender bleibt', smsFelder.get('From') === 'SOBE')
pruefe('Text kommt unverändert', smsFelder.get('Body') === 'Brand im Trakt B')
pruefe('Nummer als Absender wird normiert',
  new URLSearchParams(twilioSmsAnfrage('AC', '+41 44 000 00 00', '079', 'x').body).get('From') === '+41440000000')

// --- Anruf ---
const anruf = twilioAnrufAnfrage('ACabc', '+41440000000', '0791234567', 'Brand & Rauch <Trakt B>')
pruefe('Anruf geht an den Calls-Endpunkt', anruf.url.endsWith('/Accounts/ACabc/Calls.json'))
const twiml = new URLSearchParams(anruf.body).get('Twiml') ?? ''
pruefe('der Text wird zweimal vorgelesen', (twiml.match(/<Say/g) ?? []).length === 2)
pruefe('Sonderzeichen können das TwiML nicht zerlegen', twiml.includes('Brand &amp; Rauch &lt;Trakt B&gt;') && !twiml.includes('<Trakt'))
pruefe('auf Deutsch', twiml.includes('language="de-DE"'))

// --- Zugang ---
const kopf = twilioKopf('ACabc', 'geheim')
pruefe('Basic-Auth aus SID und Token', kopf.Authorization === `Basic ${Buffer.from('ACabc:geheim').toString('base64')}`)
pruefe('Formular-Kodierung, wie Twilio sie verlangt', kopf['Content-Type'] === 'application/x-www-form-urlencoded')

console.log(`\n${gezaehlt - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
