#!/bin/bash
# Gate F — Vercel "Ignored Build Step": blocca il deploy se il CI GitHub Actions
# è rosso sullo stesso commit.
#
# Convenzione Vercel (controintuitiva ma documentata):
#   exit 0 = SKIP the build (deploy bloccato)
#   exit 1 = PROCEED with the build (deploy va avanti)
#
# Endpoint:
#   /repos/{owner}/{repo}/actions/runs?head_sha={sha}
# Richiede SOLO permesso "Actions: Read" sul PAT — l'unico permesso disponibile
# nei Fine-grained PAT per lettura workflow runs. Verificato da Ivano.
#
# Dipendenze runtime:
#   - curl (presente nell'ambiente Vercel)
#   - node (presente: è quello che builda l'app)
# NON dipende da jq (non installato di default su Vercel — vecchio bug).
#
# Setup — vedi docs/vercel-ci-gate.md per istruzioni passo-passo.

REPO="scirettaclienti-design/unnivai"
SHA="$VERCEL_GIT_COMMIT_SHA"

# ── Guardie: fail-CLOSED (blocca) su config mancante ────────────────────────
# Regola locked (Ivano): "Mai fail-open silenzioso. È la malattia che stiamo
# curando." L'unica via per disabilitare il gate è cancellare esplicitamente
# GH_TOKEN dalle env var Vercel; lo script logga chiaramente il motivo.

if [ -z "$GH_TOKEN" ]; then
  echo "🛑 GH_TOKEN not set — BLOCKING deploy (fail-closed)."
  echo "   Per disabilitare il gate, rimuovi esplicitamente GH_TOKEN dalle env var Vercel."
  exit 0
fi

if [ -z "$SHA" ]; then
  echo "🛑 VERCEL_GIT_COMMIT_SHA not set — BLOCKING deploy (fail-closed)."
  echo "   Nessun commit da verificare. Deploy locale/manuale? Configura un context Vercel."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "🛑 node not found — BLOCKING deploy (fail-closed)."
  echo "   Lo script parse JSON via Node; senza Node non può decidere."
  exit 0
fi

echo "🔍 Checking CI status for commit: $SHA"

# Il parser Node è definito UNA VOLTA come stringa. Legge /tmp/gh_response.json
# e stampa una decisione in UNA riga:
#   BLOCK <n_failed> <list>     → blocca subito
#   PROCEED <n_total> <list>    → procedi
#   WAIT <total>/<in_progress>  → riprova
#   ERROR <messaggio>           → errore parsing → blocca (fail-closed)
NODE_PARSER='
(() => {
  try {
    const raw = require("fs").readFileSync("/tmp/gh_response.json", "utf8");
    const j = JSON.parse(raw);
    const runs = Array.isArray(j.workflow_runs) ? j.workflow_runs : [];
    const total = typeof j.total_count === "number" ? j.total_count : runs.length;
    if (total === 0) { console.log("WAIT 0/0"); return; }
    const FAIL = new Set(["failure", "cancelled", "timed_out"]);
    const OK   = new Set(["success", "skipped"]);
    const inProgress = runs.filter(r => r.status !== "completed");
    const failed     = runs.filter(r => r.status === "completed" && FAIL.has(r.conclusion));
    const ok         = runs.filter(r => r.status === "completed" && OK.has(r.conclusion));
    if (failed.length > 0) {
      console.log(`BLOCK ${failed.length}`);
      failed.forEach(r => console.log(`   ❌ [${r.name}] ${r.conclusion} — ${r.html_url}`));
      return;
    }
    if (inProgress.length === 0 && ok.length === total) {
      console.log(`PROCEED ${total}`);
      ok.forEach(r => console.log(`   ✓ [${r.name}] ${r.conclusion}`));
      return;
    }
    console.log(`WAIT ${total}/${inProgress.length}`);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
})();
'

# ── Polling loop ────────────────────────────────────────────────────────────
# 18 tentativi x 10s = 180s (3 minuti) di attesa massima.
MAX_ATTEMPTS=18
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT+1))

  # Chiamata API con codice HTTP separato dal body.
  HTTP_CODE=$(curl -sL -o /tmp/gh_response.json -w "%{http_code}" \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA&per_page=100" || echo "000")

  # 401/403: PAT invalido o senza permessi.
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo ""
    echo "🛑 GitHub API returned $HTTP_CODE — BLOCKING deploy (fail-closed)."
    echo "   PAT invalido o senza permesso 'Actions: Read'."
    echo "   Fix: rigenera il PAT su GitHub → Settings → Developer settings → Fine-grained tokens,"
    echo "        assicurati che 'Actions' sia impostato su Read-only per il repo unnivai,"
    echo "        aggiorna GH_TOKEN nelle env var Vercel."
    exit 0
  fi

  # Altri HTTP status (5xx, 000 per rete morta): retry.
  if [ "$HTTP_CODE" != "200" ]; then
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — HTTP $HTTP_CODE, retrying..."
    sleep 10
    continue
  fi

  # Parse via Node → una riga di decisione + eventuali dettagli.
  DECISION=$(node -e "$NODE_PARSER" 2>&1)
  # Prima riga = decisione; il resto è dettaglio human-readable.
  HEAD_LINE=$(echo "$DECISION" | head -n 1)
  KIND=$(echo "$HEAD_LINE" | awk '{print $1}')

  case "$KIND" in
    BLOCK)
      echo ""
      COUNT=$(echo "$HEAD_LINE" | awk '{print $2}')
      echo "🛑 CI has $COUNT failing workflow_run(s) — BLOCKING deploy"
      echo "$DECISION" | tail -n +2
      exit 0
      ;;

    PROCEED)
      echo ""
      TOTAL=$(echo "$HEAD_LINE" | awk '{print $2}')
      echo "✅ All $TOTAL workflow_run(s) passed (success or skipped) — proceeding with build"
      echo "$DECISION" | tail -n +2
      exit 1
      ;;

    WAIT)
      STATS=$(echo "$HEAD_LINE" | awk '{print $2}')
      echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — status=$STATS (total/in_progress), waiting..."
      sleep 10
      ;;

    ERROR)
      ERR_MSG=$(echo "$HEAD_LINE" | cut -d' ' -f2-)
      echo ""
      echo "🛑 JSON parse error: $ERR_MSG — BLOCKING deploy (fail-closed)."
      echo "   Body ricevuto (primi 500 char):"
      head -c 500 /tmp/gh_response.json | sed 's/^/     /'
      exit 0
      ;;

    *)
      # KIND vuoto o inatteso → probabile crash Node non catturato dal try.
      echo ""
      echo "🛑 Unexpected parser output — BLOCKING deploy (fail-closed)."
      echo "   Output raw:"
      echo "$DECISION" | sed 's/^/     /'
      exit 0
      ;;
  esac
done

# Timeout: 3 minuti senza risoluzione → blocca (fail-closed).
echo ""
echo "⏰ Timeout waiting for CI after ${MAX_ATTEMPTS} attempts — BLOCKING deploy (fail-closed)"
echo "   Il CI su GitHub Actions è più lento del solito o non è partito."
echo "   Ripushando lo stesso commit forzeresti un retry del gate."
exit 0
