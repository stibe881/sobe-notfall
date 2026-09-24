import { darfOeffnen, gehoertInsMenue, wirksameRolle } from './ansicht'

let fehler = 0
function pruefe(name: string, bedingung: boolean): void {
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

pruefe('Administration sieht die Verwaltung', darfOeffnen('admin', '/benutzer'))
pruefe('Administration sieht die Einstellungen', darfOeffnen('admin', '/integrationen'))
pruefe('Krisenstab sieht keine Konten', !darfOeffnen('krisenstab', '/benutzer'))
pruefe('Krisenstab sieht keine Gruppen', !darfOeffnen('krisenstab', '/gruppen'))
pruefe('Krisenstab sieht keine Standorte', !darfOeffnen('krisenstab', '/standorte'))
pruefe('Krisenstab sieht keine Einstellungen', !darfOeffnen('krisenstab', '/integrationen'))
pruefe('Krisenstab sieht die Alarmzentrale', darfOeffnen('krisenstab', '/monitor'))
pruefe('Krisenstab sieht die Szenarien', darfOeffnen('krisenstab', '/szenarien'))
pruefe('Krisenstab sieht die Alarmknöpfe', darfOeffnen('krisenstab', '/alarmknoepfe'))

pruefe('App-Vorschau steht nicht im Menü des Krisenstabs', !gehoertInsMenue('krisenstab', '/app'))
pruefe('App-Vorschau bleibt dem Krisenstab aber zugänglich', darfOeffnen('krisenstab', '/app'))
pruefe('Die Administration behält den Menüeintrag', gehoertInsMenue('admin', '/app'))
pruefe('Gesperrte Seiten stehen auch nicht im Menü', !gehoertInsMenue('krisenstab', '/benutzer'))
pruefe('Die Alarmzentrale steht im Menü des Krisenstabs', gehoertInsMenue('krisenstab', '/monitor'))

pruefe('Umgeschaltete Administration gilt als Krisenstab', wirksameRolle('admin', 'krisenstab') === 'krisenstab')
pruefe('Nicht umgeschaltet bleibt Administration', wirksameRolle('admin', 'admin') === 'admin')
pruefe('Der Krisenstab kann sich nicht selbst erhöhen', wirksameRolle('krisenstab', 'admin') === 'krisenstab')

console.log(`\n${17 - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
