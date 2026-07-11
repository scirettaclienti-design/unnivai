#!/bin/bash
# Gate F — Vercel "Ignored Build Step": blocca il deploy se il CI GitHub Actions
# è rosso sullo stesso commit.
#
# Convenzione Vercel:
#   exit 0 = SKIP the build (deploy bloccato)
#   exit 1 = PROCEED with the build (deploy va avanti)
#
# Come Vercel usa questo script:
#   1) Al push su main, Vercel legge lo script dalla dashboard.
#   2) Lo esegue nel runner Vercel prima del build.
#   3) In base al codice di uscita, procede o skippa.
#
# Setup — vedi docs/vercel-ci-gate.md per istruzioni passo-passo.

set -e

REPO="scirettaclienti-design/unnivai"
SHA="$VERCEL_GIT_COMMIT_SHA"

# Guardia 1: se manca il PAT, permetti il deploy (opt-in gate).
# Consente rollback rapido se lo script rompe qualcosa: basta rimuovere GH_TOKEN.
if [ -z "$GH_TOKEN" ]; then
  echo "⚠️  GH_TOKEN not set — gate disabled, allowing deploy"
  exit 1
fi

# Guardia 2: se manca il SHA (build locale, preview stateless), permetti.
if [ -z "$SHA" ]; then
  echo "⚠️  VERCEL_GIT_COMMIT_SHA not set — no commit to gate on, allowing deploy"
  exit 1
fi

echo "🔍 Checking CI status for commit: $SHA"

# Poll GitHub check-runs API: aspetta che i job CI siano completed.
# Il push su main triggera GitHub Actions che parte in pochi secondi;
# Vercel può arrivare qui prima → aspettiamo max ~3 minuti.
MAX_ATTEMPTS=18   # 18 x 10s = 180s (3 minuti)
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT+1))

  RESPONSE=$(curl -sL \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$REPO/commits/$SHA/check-runs?per_page=100")

  # Conteggi separati per stato completed/failed/success.
  TOTAL=$(echo "$RESPONSE" | jq '.total_count // 0')
  COMPLETED=$(echo "$RESPONSE" | jq '[.check_runs[]? | select(.status=="completed")] | length')
  FAILED=$(echo "$RESPONSE" | jq '[.check_runs[]? | select(.status=="completed" and .conclusion!="success" and .conclusion!="skipped" and .conclusion!="neutral")] | length')

  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — total=$TOTAL completed=$COMPLETED failed=$FAILED"

  # Nessun check ancora registrato: aspetta.
  if [ "$TOTAL" = "0" ]; then
    sleep 10
    continue
  fi

  # C'è già un fallimento definitivo: blocca subito.
  if [ "$FAILED" -gt "0" ]; then
    echo "🛑 CI has $FAILED failed check(s) on this commit — BLOCKING deploy"
    echo "$RESPONSE" | jq -r '.check_runs[] | select(.status=="completed" and .conclusion!="success" and .conclusion!="skipped") | "  ❌ \(.name): \(.conclusion) — \(.html_url)"'
    exit 0
  fi

  # Tutti i check completed sono success/skipped/neutral, e almeno UN check
  # atteso è già completato: proseguiamo se il numero di check finali
  # eguaglia il totale registrato in questo momento (evita di procedere
  # con solo 1 check completato mentre altri devono ancora partire).
  if [ "$COMPLETED" -gt "0" ] && [ "$COMPLETED" = "$TOTAL" ]; then
    echo "✅ All $COMPLETED CI check(s) passed — proceeding with build"
    exit 1
  fi

  sleep 10
done

# Timeout: dopo 3 min senza risoluzione, blocchiamo. Meglio missing deploy
# che deploy con CI incerto.
echo "⏰ Timeout waiting for CI (${MAX_ATTEMPTS} attempts) — BLOCKING deploy"
echo "   Il CI su GitHub Actions è più lento del solito o non è partito."
echo "   Ripushando lo stesso commit forzeresti un retry del gate."
exit 0
