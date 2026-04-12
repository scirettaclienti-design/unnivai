#!/bin/bash
set -euo pipefail

export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?Imposta ANTHROPIC_API_KEY prima di eseguire}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== DOVEVAI MANAGED AGENT SETUP ===${NC}"

echo -e "${YELLOW}[1/3] Creazione Agent...${NC}"

agent=$(
  curl -sS --fail-with-body https://api.anthropic.com/v1/agents \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d '{
      "name": "dovevai-stabilizer",
      "model": "claude-sonnet-4-6",
      "system": "Sei il DoveVAI Stabilizer Agent. Leggi DOVEVAI_MASTER_AUDIT.md nella root del repo per il contesto completo. Esegui i task da DVAI-001 a DVAI-047 in ordine di priorità. Per ogni task: leggi i file coinvolti, implementa la soluzione, verifica con npm run build. Se un task fallisce dopo 3 tentativi, crea ESCALATION_DVAI-XXX.md e passa avanti. MAI esporre API key nel client. MAI usare alert(). SEMPRE try/catch con toast. SEMPRE RLS su ogni tabella.",
      "tools": [{"type": "agent_toolset_20260401"}]
    }'
)

AGENT_ID=$(echo "$agent" | jq -er '.id')
echo -e "${GREEN}  Agent ID: $AGENT_ID${NC}"

echo -e "${YELLOW}[2/3] Creazione Environment...${NC}"

environment=$(
  curl -sS --fail-with-body https://api.anthropic.com/v1/environments \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d '{
      "name": "dovevai-env",
      "config": {
        "type": "cloud",
        "networking": {"type": "unrestricted"}
      }
    }'
)

ENVIRONMENT_ID=$(echo "$environment" | jq -er '.id')
echo -e "${GREEN}  Environment ID: $ENVIRONMENT_ID${NC}"

echo -e "${YELLOW}[3/3] Lancio sessione Fase 1...${NC}"

session=$(
  curl -sS --fail-with-body https://api.anthropic.com/v1/sessions \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d "{
      \"agent\": \"$AGENT_ID\",
      \"environment_id\": \"$ENVIRONMENT_ID\",
      \"title\": \"DoveVAI Fase 1 - Stabilizer\"
    }"
)

SESSION_ID=$(echo "$session" | jq -er '.id')
echo -e "${GREEN}  Session ID: $SESSION_ID${NC}"

curl -sS --fail-with-body \
  "https://api.anthropic.com/v1/sessions/$SESSION_ID/events" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "events": [{
      "type": "user.message",
      "content": [{
        "type": "text",
        "text": "Clona il repo https://github.com/scirettaclienti-design/unnivai.git branch main. Fai npm install. Leggi DOVEVAI_MASTER_AUDIT.md. Poi esegui i task DVAI-001 a DVAI-010 in ordine. Per ogni task: leggi i file, implementa, npm run build, git commit. Quando hai finito tutti i 10 task, fai git push. INIZIA."
      }]
    }]
  }' >/dev/null

echo -e "${GREEN}=== Agent avviato! Streaming... ===${NC}"

while IFS= read -r line; do
  [[ $line == data:* ]] || continue
  json=${line#data: }
  case $(echo "$json" | jq -r '.type' 2>/dev/null) in
    agent.message) echo "$json" | jq -j '.content[] | select(.type == "text") | .text' 2>/dev/null ;;
    agent.tool_use) printf '\n[tool: %s]\n' "$(echo "$json" | jq -r '.name' 2>/dev/null)" ;;
    session.status_idle) printf '\n\nAgent completato.\n'; break ;;
    session.error) printf '\nErrore: %s\n' "$(echo "$json" | jq -r '.error.message' 2>/dev/null)"; break ;;
  esac
done < <(
  curl -sS -N --fail-with-body \
    "https://api.anthropic.com/v1/sessions/$SESSION_ID/stream" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "Accept: text/event-stream"
)
