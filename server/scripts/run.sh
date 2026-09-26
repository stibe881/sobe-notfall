#!/usr/bin/env bash
# Startet den Alarmserver, startet ihn nach einem Absturz oder einer
# Aktualisierung neu – und beendet ihn, wenn er zwar läuft, aber nicht mehr
# antwortet.
#
# Der Neustart nach Absturz genügte nicht: Ein Prozess, der hängt, stürzt
# nicht ab. Deshalb fragt die Schleife alle 30 Sekunden /api/health ab.
# Bleibt die Antwort dreimal in Folge aus, wird der Prozess beendet und
# frisch gestartet. Ein Alarmserver, der nicht antwortet, ist keiner.
#
# Der Server beendet sich nach einem erfolgreichen Update mit Code 0; die
# Schleife startet ihn dann mit dem neuen Stand wieder.
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-3001}"
HEALTH="http://127.0.0.1:${PORT}/api/health"
ABFRAGE_S="${SOBE_WACHHUND_S:-30}"
FEHLER_BIS_NEUSTART=3

while true; do
  node dist/index.js &
  pid=$!
  fehl=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep "$ABFRAGE_S"
    kill -0 "$pid" 2>/dev/null || break
    if curl -fsS -m 10 "$HEALTH" >/dev/null 2>&1; then
      fehl=0
    else
      fehl=$((fehl + 1))
      echo "[run] $(date '+%F %T') Health-Abfrage ohne Antwort ($fehl/$FEHLER_BIS_NEUSTART)"
      if [ "$fehl" -ge "$FEHLER_BIS_NEUSTART" ]; then
        echo "[run] $(date '+%F %T') Server antwortet nicht mehr – wird beendet und neu gestartet."
        kill "$pid" 2>/dev/null
        sleep 5
        kill -9 "$pid" 2>/dev/null
        break
      fi
    fi
  done
  wait "$pid"
  code=$?
  if [ $code -ne 0 ]; then
    echo "[run] $(date '+%F %T') Server mit Code $code beendet - Neustart in 5 Sekunden."
    sleep 5
  else
    echo "[run] $(date '+%F %T') Neustart nach Aktualisierung."
    sleep 1
  fi
done
