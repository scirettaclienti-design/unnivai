#!/bin/bash
# Gate F — Vercel "Ignored Build Step": blocca il deploy se il CI GitHub Actions
# è rosso sullo stesso commit.
#
# Convenzione Vercel (controintuitiva ma documentata):
#   exit 0 = SKIP the build (deploy bloccato)
#   exit 1 = PROCEED with the build (deploy va avanti)
#
# Endpoint scelto:
#   /repos/{owner}/{repo}/actions/runs?head_sha={sha}
# Richiede SOLO permesso "Actions: Read" sul PAT. L'endpoint alternativo
# /commits/{sha}/check-runs richiederebbe "Checks: Read" che nei
# fine-grained PAT non è esposto per Repository permissions — Ivano l'ha
# verificato, quindi usiamo actions/runs come single source of truth.
#
# Setup — vedi docs/vercel-ci-gate.md per istruzioni passo-passo.

set -e

REPO="scirettaclienti-design/unnivai"
SHA="$VERCEL_GIT_COMMIT_SHA"

# ── Guardie: fail-CLOSED (blocca) su config mancante ────────────────────────
# Regola locked (Ivano): "Mai fail-open silenzioso. È la malattia che stiamo
# curando." Sotto: se il gate non può verificare, blocca. L'unica via per
# disabilitare è cancellare esplicitamente GH_TOKEN dalla env var Vercel.

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

echo "🔍 Checking CI status for commit: $SHA"

# Poll GitHub Actions API: aspetta che i workflow_runs siano completed.
# Il push su main triggera GitHub Actions che parte in pochi secondi;
# Vercel può arrivare qui prima → aspettiamo max ~3 minuti.
MAX_ATTEMPTS=18   # 18 x 10s = 180s (3 minuti)
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT+1))

  # HTTP status separato dal body per distinguere 401/403/404 da 200 con body vuoto.
  HTTP_CODE=$(curl -sL -o /tmp/gh_response.json -w "%{http_code}" \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$REPO/actions/runs?head_sha=$SHA&per_page=100")

  # 401/403: PAT invalido o senza permessi.
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "🛑 GitHub API returned $HTTP_CODE — PAT invalido o senza permesso 'Actions: Read'."
    echo "   Fix: rigenera il PAT su GitHub → Settings → Developer settings → Fine-grained tokens,"
    echo "        assicurati che 'Actions' sia impostato su Read-only per il repo unnivai,"
    echo "        aggiorna GH_TOKEN nelle env var Vercel."
    exit 0
  fi
  # Altri errori API: log + blocco (fail-closed).
  if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️  GitHub API returned $HTTP_CODE — retrying..."
    sleep 10
    continue
  fi

  RESPONSE=$(cat /tmp/gh_response.json)
  TOTAL=$(echo "$RESPONSE" | jq '.total_count // 0')

  if [ "$TOTAL" = "0" ]; then
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — no workflow_runs yet for this SHA"
    sleep 10
    continue
  fi

  # Estrai per ogni run: name, status, conclusion.
  # status:      queued | in_progress | completed
  # conclusion:  success | failure | cancelled | skipped | timed_out | action_required | null
  IN_PROGRESS=$(echo "$RESPONSE" | jq '[.workflow_runs[] | select(.status!="completed")] | length')
  # Failure = conclusion appartenente all'insieme "davvero rotto".
  # 'skipped' NON è failure (il workflow non è girato → non fa danno).
  # 'action_required' è pending manuale → aspettiamo.
  FAILED=$(echo "$RESPONSE" | jq '[.workflow_runs[] | select(.status=="completed" and (.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out"))] | length')
  SUCCESS_OR_SKIPPED=$(echo "$RESPONSE" | jq '[.workflow_runs[] | select(.status=="completed" and (.conclusion=="success" or .conclusion=="skipped"))] | length')

  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — total=$TOTAL in_progress=$IN_PROGRESS failed=$FAILED success_or_skipped=$SUCCESS_OR_SKIPPED"

  # Se anche UN solo run è failed → blocca subito (non serve aspettare gli altri).
  if [ "$FAILED" -gt "0" ]; then
    echo ""
    echo "🛑 CI has $FAILED failing workflow_run(s) — BLOCKING deploy"
    echo "$RESPONSE" | jq -r '.workflow_runs[] | select(.status=="completed" and (.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")) | "   ❌ [\(.name)] \(.conclusion) — \(.html_url)"'
    exit 0
  fi

  # Se tutti i run sono completed e tutti sono success/skipped → procedi.
  if [ "$IN_PROGRESS" = "0" ] && [ "$SUCCESS_OR_SKIPPED" = "$TOTAL" ]; then
    echo ""
    echo "✅ All $TOTAL workflow_run(s) passed (success or skipped) — proceeding with build"
    echo "$RESPONSE" | jq -r '.workflow_runs[] | "   ✓ [\(.name)] \(.conclusion)"'
    exit 1
  fi

  # Ancora work in progress → aspetta.
  sleep 10
done

# Timeout: 3 minuti senza risoluzione → blocca (fail-closed).
echo ""
echo "⏰ Timeout waiting for CI after ${MAX_ATTEMPTS} attempts — BLOCKING deploy (fail-closed)"
echo "   Il CI su GitHub Actions è più lento del solito o non è partito."
echo "   Ripushando lo stesso commit forzeresti un retry del gate."
exit 0
