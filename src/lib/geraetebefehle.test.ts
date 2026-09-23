import { HALTEZEIT, haltezeitBefehl } from './geraetebefehle'

let fehler = 0
function pruefe(name: string, bedingung: boolean): void {
  console.log(`${bedingung ? 'OK  ' : 'FEHL'} ${name}`)
  if (!bedingung) fehler++
}

pruefe('TrackerD: 2 Sekunden ergeben BA02', haltezeitBefehl('dragino-trackerd', 2)?.downlink === 'BA02')
pruefe('TrackerD: 10 Sekunden ergeben BA0A', haltezeitBefehl('dragino-trackerd', 10)?.downlink === 'BA0A')
pruefe('TrackerD: AT-Befehl passt', haltezeitBefehl('dragino-trackerd', 3)?.at === 'AT+EAT=3')
pruefe('TrackerD: über der Grenze wird gekappt', haltezeitBefehl('dragino-trackerd', 99)?.downlink === 'BA0A')
pruefe('TrackerD: unter der Grenze wird gekappt', haltezeitBefehl('dragino-trackerd', -5)?.downlink === 'BA00')

pruefe('PB01: 500 ms ergeben A201F4', haltezeitBefehl('dragino-pb01', 500)?.downlink === 'A201F4')
pruefe('PB01: 1000 ms ergeben A203E8', haltezeitBefehl('dragino-pb01', 1000)?.downlink === 'A203E8')
pruefe('PB01: AT-Befehl passt', haltezeitBefehl('dragino-pb01', 500)?.at === 'AT+STIME=500')

pruefe('Unbekanntes Modell ergibt keinen Befehl', haltezeitBefehl('auto', 2) === null)
pruefe('Ohne Modell ergibt keinen Befehl', haltezeitBefehl(undefined, 2) === null)
pruefe('Beim PB01 steht der Vorbehalt der Herstellerangabe', Boolean(HALTEZEIT['dragino-pb01'].vorbehalt))

console.log(`\n${11 - fehler} bestanden, ${fehler} fehlgeschlagen`)
if (fehler > 0) throw new Error(`${fehler} Prüfung(en) fehlgeschlagen`)
