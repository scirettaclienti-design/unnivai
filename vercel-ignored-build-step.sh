#!/bin/bash
# Gate F / F43 — Vercel "Ignored Build Step": blocca il deploy se il CI GitHub
# Actions non è verde sullo stesso commit.
#
# Convenzione Vercel (controintuitiva ma documentata):
#   exit 0 = SKIP the build (deploy bloccato)
#   exit 1 = PROCEED with the build (deploy va avanti)
#
# VINCOLO NOTO: Vercel legge SOLO 0 e 1. Non esistono exit code 2/3 per
# distinguere "CI lenta" da "CI rossa": verrebbero interpretati come skip.
# La distinzione vive nel marker REASON dell'ultima riga di log, non nell'exit.
#
# ── Cosa è cambiato con F43 (19/08) e perché ────────────────────────────────
# Il gate contava i workflow_run. Nel repo esiste UN SOLO workflow
# (.github/workflows/ci.yml, name "CI"), quindi /actions/runs?head_sha=
# restituisce total_count = 1 — non 2. I due job "Lint & Test" ed "E2E Smoke"
# vivono solo in /actions/runs/{id}/jobs, endpoint che il gate non chiamava.
#
# Tre difetti, non uno:
#   1. BUDGET. 18 x 10s = 180s, sotto la coda della distribuzione reale della
#      CI (ultimi 40 run: mediana 93s, p90 126s, coda 228s e 277s). Un E2E
#      lento produceva un Cancel muto identico a quello di una CI rossa.
#   2. LOGICA. "nessun run in_progress" veniva letto come "CI verde", anche
#      nella finestra in cui le check non sono ancora registrate. Alzare il
#      solo timeout avrebbe reso quella finestra PIÙ probabile: un fail-closed
#      che diventa fail-open.
#   3. BUDGET NON VINCOLANTE (trovato nel dry-run, Fase 2). Il budget era
#      contato in tentativi, non in tempo, e curl non aveva timeout: una
#      singola chiamata appesa 35s ha portato una fase da 30s a 69s. Con
#      curl illimitato il tetto reale non esisteva.
#
# Ora: deadline wall-clock, timeout su ogni chiamata, lista NOMINALE dei job
# attesi, e la decisione in un parser puro testato (scripts/ci-gate-parser.mjs
# + src/test/ci-gate-parser.test.js).
#
# Dipendenze runtime: curl e node (entrambi presenti su Vercel). NON jq.
# Setup — vedi docs/vercel-ci-gate.md.

REPO="scirettaclienti-design/unnivai"
SHA="$VERCEL_GIT_COMMIT_SHA"

# Gate F43 Fase 2 — path derivato da BASH_SOURCE, non relativo alla CWD.
# vercel.json NON contiene `ignoreCommand`: l'Ignored Build Step e' configurato
# nella dashboard Vercel, quindi la working directory di invocazione NON e'
# provabile da dentro il repo. Invece di assumerla, la si rende irrilevante:
# il parser sta accanto a questo script e lo si trova a partire da qui.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
PARSER="${SCRIPT_DIR}/scripts/ci-gate-parser.mjs"

START_TS=$(date +%s)

# ── Timeout per singola chiamata (Fase 3) ───────────────────────────────────
# 15s, non 30: deve stare MOLTO sotto la deadline della fase A (30s), altrimenti
# una sola chiamata appesa la consuma tutta e produce un falso NOT_REGISTERED.
# Latenza misurata sul campo: 0,43–0,63s. 15s non taglia mai una chiamata sana.
# CURL_MAX_TIME e' override-abile SOLO per poter testare il ramo di scadenza
# (caso E del dry-run). Non e' un parametro di tuning: il default resta 15.
CURL_MAX_TIME="${CURL_MAX_TIME:-15}"
CURL_CONNECT_TIMEOUT=5

# ── Budget come DEADLINE WALL-CLOCK, non come conteggio di tentativi ────────
# "300s" deve significare 300 secondi. Contando i tentativi non lo significava:
# il tempo delle chiamate non entrava nel conto (vedi difetto 3 sopra).
PHASE_A_BUDGET=30    # secondi — propagazione push → workflow_run visibile in API
PHASE_B_BUDGET=300   # secondi — fonte: p90 storico 126s, coda osservata 277s
PHASE_A_SLEEP=5
PHASE_B_SLEEP=10

# ── Contatori di chiamata ───────────────────────────────────────────────────
# Servono a distinguere "GitHub irraggiungibile" da "CI lenta": sono diagnosi
# opposte che senza questi numeri producono lo stesso identico log.
CALLS_TOTAL=0
CALLS_TIMEOUT=0
ROUND_CALLS=0        # chiamate del giro corrente
ROUND_TIMEOUTS=0     # di cui scadute

# ── Verdetto finale: SEMPRE l'ultima riga, su ogni percorso di uscita ───────
# Marker: ALL_GREEN CI_FAILED NOT_REGISTERED TIMEOUT_JOB_PENDING
#         MISSING_EXPECTED_JOB AUTH_ERROR RATE_LIMITED API_UNREACHABLE
#         HTTP_ERROR PARSE_ERROR NO_TOKEN NO_SHA
finish() {
  local code="$1" reason="$2"
  local elapsed=$(( $(date +%s) - START_TS ))
  echo ""
  echo "GATE_VERDICT exit=${code} REASON=${reason} elapsed=${elapsed}s chiamate: ${CALLS_TOTAL}, scadute: ${CALLS_TIMEOUT}"
  exit "$code"
}

# ── Guardie: fail-CLOSED su config mancante ─────────────────────────────────
# Regola locked (Ivano): "Mai fail-open silenzioso. È la malattia che stiamo
# curando." L'unica via per disabilitare il gate è rimuovere GH_TOKEN.

if [ -z "$GH_TOKEN" ]; then
  echo "🛑 GH_TOKEN not set — BLOCKING deploy (fail-closed)."
  echo "   Per disabilitare il gate, rimuovi esplicitamente GH_TOKEN dalle env var Vercel."
  finish 0 NO_TOKEN
fi

if [ -z "$SHA" ]; then
  echo "🛑 VERCEL_GIT_COMMIT_SHA not set — BLOCKING deploy (fail-closed)."
  echo "   Nessun commit da verificare. Deploy locale/manuale? Configura un context Vercel."
  finish 0 NO_SHA
fi

if ! command -v node >/dev/null 2>&1; then
  echo "🛑 node not found — BLOCKING deploy (fail-closed)."
  echo "   La decisione passa da un parser Node; senza Node non può decidere."
  finish 0 PARSE_ERROR
fi

if [ ! -f "$PARSER" ]; then
  echo "🛑 Parser non trovato: $PARSER — BLOCKING deploy (fail-closed)."
  echo "   Atteso accanto allo script. SCRIPT_DIR=$SCRIPT_DIR — CWD=$(pwd)"
  finish 0 PARSE_ERROR
fi

echo "🔍 Gate CI per commit: $SHA"
echo "   Budget: fase A ${PHASE_A_BUDGET}s · fase B ${PHASE_B_BUDGET}s · timeout per chiamata ${CURL_MAX_TIME}s"

# ── Helper: GET autenticata ─────────────────────────────────────────────────
# Stampa "<http_code> <curl_exit_code>". Il chiamante incrementa i contatori:
# NON possono essere incrementati qui dentro, perche' `X=$(gh_get ...)` esegue
# la funzione in una SUBSHELL e ogni assegnamento andrebbe perso al ritorno.
gh_get() {
  local url="$1" out="$2"
  local code rc
  rm -f /tmp/gh_headers.txt
  code=$(curl -sL -o "$out" -D /tmp/gh_headers.txt -w "%{http_code}" \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$url" 2>/dev/null)
  rc=$?
  echo "${code:-000} ${rc}"
}

# Registra l'esito di una chiamata nei contatori e dice se e' scaduta.
# curl esce con 28 su timeout (connect o max-time) e http_code resta 000:
# "scaduta" e "HTTP 000" NON sono la stessa cosa e non vanno loggate uguale.
note_call() {
  local rc="$1"
  CALLS_TOTAL=$((CALLS_TOTAL+1))
  ROUND_CALLS=$((ROUND_CALLS+1))
  if [ "$rc" = "28" ]; then
    CALLS_TIMEOUT=$((CALLS_TIMEOUT+1))
    ROUND_TIMEOUTS=$((ROUND_TIMEOUTS+1))
    return 0   # scaduta
  fi
  return 1     # non scaduta
}

# Dorme senza mai sfondare la deadline passata.
sleep_within() {
  local deadline="$1" want="$2" left
  left=$(( deadline - $(date +%s) ))
  [ "$left" -le 0 ] && return 1
  if [ "$left" -lt "$want" ]; then sleep "$left"; else sleep "$want"; fi
  return 0
}

# Un 403 di GitHub non significa una cosa sola: puo' essere "PAT senza
# permessi" o "rate limit esaurito". La discriminazione vive nel parser puro
# (classifyForbidden), testata; qui si stampa e si esce. 401 e' sempre auth.
deny_and_exit() {
  local status="$1" body="$2" phase="$3"
  local out reason
  out=$(node "$PARSER" classify "$status" "$body" 2>&1)
  reason=$(echo "$out" | head -n 1 | awk '{print $1}')
  echo ""
  if [ "$reason" = "RATE_LIMITED" ]; then
    echo "🛑 Rate limit GitHub (${phase}) — BLOCKING deploy (fail-closed)."
  else
    echo "🛑 GitHub API $status (${phase}) — BLOCKING deploy (fail-closed)."
  fi
  echo "$out" | tail -n +2
  if [ "$reason" != "RATE_LIMITED" ]; then
    echo "   Fix: rigenera il fine-grained PAT (Actions: Read-only sul repo unnivai)"
    echo "        e aggiorna GH_TOKEN nelle env var Vercel."
  fi
  finish 0 "${reason:-AUTH_ERROR}"
}

# Se il giro finale è stato TUTTO timeout, il problema non è la CI: è che
# GitHub non risponde. Diagnosi opposta, marker diverso.
verdict_on_deadline() {
  local fallback="$1"
  if [ "$ROUND_CALLS" -gt 0 ] && [ "$ROUND_TIMEOUTS" -eq "$ROUND_CALLS" ]; then
    echo "   L'ultimo giro non ha ricevuto risposta (${ROUND_TIMEOUTS}/${ROUND_CALLS} chiamate scadute):"
    echo "   non è la CI a essere lenta, è api.github.com a non rispondere."
    finish 0 API_UNREACHABLE
  fi
  finish 0 "$fallback"
}

RUNS_URL="https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA&per_page=100"

# ── FASE A — registrazione ──────────────────────────────────────────────────
DEADLINE_A=$(( $(date +%s) + PHASE_A_BUDGET ))
REGISTERED=0

while [ "$(date +%s)" -lt "$DEADLINE_A" ]; do
  ROUND_CALLS=0
  ROUND_TIMEOUTS=0

  read -r HTTP_CODE CURL_RC <<<"$(gh_get "$RUNS_URL" /tmp/gh_runs.json)"
  TIMED_OUT=0
  note_call "$CURL_RC" && TIMED_OUT=1

  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "429" ]; then
    deny_and_exit "$HTTP_CODE" /tmp/gh_runs.json "fase A"
  fi

  LEFT=$(( DEADLINE_A - $(date +%s) ))

  if [ "$TIMED_OUT" = "1" ]; then
    echo "  [A] chiamata scaduta dopo ${CURL_MAX_TIME}s — restano ${LEFT}s"
  elif [ "$HTTP_CODE" != "200" ]; then
    echo "  [A] HTTP $HTTP_CODE — restano ${LEFT}s"
  else
    RUN_IDS=$(node "$PARSER" run-ids 2>/dev/null)
    if [ -n "$RUN_IDS" ]; then
      REGISTERED=1
      echo "  [A] run registrato: $(echo "$RUN_IDS" | tr '\n' ' ')"
      break
    fi
    echo "  [A] nessun workflow_run per lo SHA — restano ${LEFT}s"
  fi

  sleep_within "$DEADLINE_A" "$PHASE_A_SLEEP" || break
done

if [ "$REGISTERED" != "1" ]; then
  echo ""
  echo "🛑 Nessun workflow_run per $SHA entro ${PHASE_A_BUDGET}s — BLOCKING (fail-closed)."
  echo "   Il workflow non è partito, oppure il commit non è su un branch che lo attiva."
  verdict_on_deadline NOT_REGISTERED
fi

# ── FASE B — attesa dei job ─────────────────────────────────────────────────
DEADLINE_B=$(( $(date +%s) + PHASE_B_BUDGET ))

while [ "$(date +%s)" -lt "$DEADLINE_B" ]; do
  ROUND_CALLS=0
  ROUND_TIMEOUTS=0

  # Ri-legge i run (lo stato cambia) e poi i job di ciascuno.
  read -r HTTP_CODE CURL_RC <<<"$(gh_get "$RUNS_URL" /tmp/gh_runs.json)"
  TIMED_OUT=0
  note_call "$CURL_RC" && TIMED_OUT=1

  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "429" ]; then
    deny_and_exit "$HTTP_CODE" /tmp/gh_runs.json "fase B, endpoint runs"
  fi

  LEFT=$(( DEADLINE_B - $(date +%s) ))

  if [ "$TIMED_OUT" = "1" ]; then
    echo "  [B] chiamata scaduta dopo ${CURL_MAX_TIME}s (runs) — restano ${LEFT}s"
    sleep_within "$DEADLINE_B" "$PHASE_B_SLEEP" || break
    continue
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    echo "  [B] HTTP $HTTP_CODE sui run — restano ${LEFT}s"
    sleep_within "$DEADLINE_B" "$PHASE_B_SLEEP" || break
    continue
  fi

  # Pulizia: i job del giro precedente non devono sopravvivere a questo.
  rm -f /tmp/gh_jobs_*.json

  JOBS_OK=1
  for RID in $(node "$PARSER" run-ids 2>/dev/null); do
    read -r JOB_CODE JOB_RC <<<"$(gh_get "https://api.github.com/repos/$REPO/actions/runs/$RID/jobs?per_page=100" "/tmp/gh_jobs_${RID}.json")"
    JOB_TIMED_OUT=0
    note_call "$JOB_RC" && JOB_TIMED_OUT=1

    if [ "$JOB_CODE" = "401" ] || [ "$JOB_CODE" = "403" ] || [ "$JOB_CODE" = "429" ]; then
      deny_and_exit "$JOB_CODE" "/tmp/gh_jobs_${RID}.json" "fase B, endpoint jobs"
    fi

    if [ "$JOB_TIMED_OUT" = "1" ]; then
      echo "  [B] chiamata scaduta dopo ${CURL_MAX_TIME}s (job del run $RID)"
      rm -f "/tmp/gh_jobs_${RID}.json"
      JOBS_OK=0
    elif [ "$JOB_CODE" != "200" ]; then
      echo "  [B] HTTP $JOB_CODE sui job del run $RID"
      rm -f "/tmp/gh_jobs_${RID}.json"
      JOBS_OK=0
    fi
  done

  # Se una GET jobs è fallita, i job sono incompleti: non si decide su dati
  # parziali (si leggerebbe "job assente" e, a run completed, un
  # MISSING_EXPECTED_JOB che non esiste).
  if [ "$JOBS_OK" != "1" ]; then
    LEFT=$(( DEADLINE_B - $(date +%s) ))
    echo "  [B] job incompleti, non decido su dati parziali — restano ${LEFT}s"
    sleep_within "$DEADLINE_B" "$PHASE_B_SLEEP" || break
    continue
  fi

  ELAPSED_MS=$(( ( $(date +%s) - START_TS ) * 1000 ))
  DECISION=$(node "$PARSER" decide "$ELAPSED_MS" 2>&1)
  HEAD_LINE=$(echo "$DECISION" | head -n 1)
  VERDICT=$(echo "$HEAD_LINE" | awk '{print $1}')
  REASON=$(echo "$HEAD_LINE" | awk '{print $2}')

  case "$VERDICT" in
    BLOCK)
      echo ""
      echo "🛑 CI non verde — BLOCKING deploy"
      echo "$DECISION" | tail -n +2
      finish 0 "${REASON:-CI_FAILED}"
      ;;

    PROCEED)
      echo ""
      echo "✅ Tutti i job attesi sono verdi — procedo con la build"
      echo "$DECISION" | tail -n +2
      finish 1 ALL_GREEN
      ;;

    WAIT)
      LEFT=$(( DEADLINE_B - $(date +%s) ))
      echo "  [B] ${REASON} — restano ${LEFT}s:"
      echo "$DECISION" | tail -n +2
      sleep_within "$DEADLINE_B" "$PHASE_B_SLEEP" || break
      ;;

    *)
      # VERDICT vuoto o inatteso → crash Node non catturato. Fail-closed.
      echo ""
      echo "🛑 Output del parser inatteso — BLOCKING deploy (fail-closed)."
      echo "   Output raw:"
      echo "$DECISION" | sed 's/^/     /'
      finish 0 PARSE_ERROR
      ;;
  esac
done

# ── Deadline fase B ─────────────────────────────────────────────────────────
# Non è "CI rossa": è "CI non ha finito in tempo". L'exit code è lo stesso
# (Vercel legge solo 0/1), la differenza è il marker.
echo ""
echo "⏰ Deadline: i job attesi non sono conclusi entro ${PHASE_B_BUDGET}s — BLOCKING (fail-closed)"
echo "   NON significa che la CI sia rossa: significa che è più lenta del budget."
echo "   Distinguile dal marker qui sotto: TIMEOUT_JOB_PENDING ≠ CI_FAILED."
echo "   Se la CI è poi diventata verde, un redeploy manuale su questo commit passa"
echo "   al primo tentativo (i job risultano già completed)."
verdict_on_deadline TIMEOUT_JOB_PENDING
