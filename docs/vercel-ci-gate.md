# Vercel CI Gate — setup passo per passo

Blocca il deploy Vercel se il CI GitHub Actions è rosso sullo stesso commit.

Serve perché di default la Git Integration Vercel deploya al push su main
indipendentemente dallo stato dei check GitHub (l'abbiamo verificato: 2 commit
consecutivi con CI rosso sono comunque finiti in prod).

Lo script è già nel repo: `vercel-ignored-build-step.sh`.
Ti servono **due configurazioni manuali**:

---

## Passo 1 — Crea un Personal Access Token GitHub

Serve al gate per leggere lo stato dei check-runs GitHub via API.

1. Apri https://github.com/settings/personal-access-tokens/new
   (o: GitHub → **Settings** → **Developer settings** → **Personal access
   tokens** → **Fine-grained tokens** → **Generate new token**).

2. Compila:
   - **Token name**: `vercel-ci-gate-unnivai`
   - **Expiration**: 90 days (o **No expiration** se vuoi non pensarci più)
   - **Resource owner**: `scirettaclienti-design` (il tuo account)
   - **Repository access**: *Only select repositories* → seleziona `unnivai`

3. **Repository permissions** — dai SOLO letture (nessun write):
   - **Actions**: Read-only  ← usato dal gate
   - **Metadata**: Read-only (obbligatorio di default)

   Tutti gli altri: **No access**. Se il PAT trapelasse, l'attaccante non
   potrebbe scrivere nulla.

   NOTE: nei fine-grained PAT il permesso "Checks: Read" non è esposto per
   Repository permissions. Lo script del gate legge da
   `/repos/{owner}/{repo}/actions/runs?head_sha=SHA` (Actions API), non da
   `check-runs` (Checks API), proprio per stare dentro i permessi disponibili.

4. Clicca **Generate token** in fondo alla pagina.

5. **COPIA IL TOKEN SUBITO** (inizia con `github_pat_...`). Non lo rivedrai.

---

## Passo 2 — Salva il PAT come env var Vercel

1. Apri https://vercel.com/dashboard → seleziona il progetto `unnivai`.

2. **Settings** → **Environment Variables**.

3. Clicca **Add New**:
   - **Key**: `GH_TOKEN`
   - **Value**: incolla il PAT copiato al Passo 1
   - **Environments**: seleziona SOLO **Production** e **Preview**
     (deseleziona Development)
   - **Type**: **Sensitive** (importante: nasconde il valore dai log)

4. **Save**.

---

## Passo 3 — Attiva l'Ignored Build Step

1. Sempre nel progetto `unnivai` su Vercel: **Settings** → **Git**.

2. Scorri fino a **Ignored Build Step**.

3. Nel dropdown a sinistra, seleziona **Run my Bash script**.

4. Nel campo testo che appare, incolla ESATTAMENTE questo:
   ```
   bash vercel-ignored-build-step.sh
   ```

5. **Save**.

---

## Passo 4 — Verifica

1. Torna nel repo, fai un piccolo commit qualsiasi (es. spazio in README) e
   pusha su main.

2. Su Vercel, vai al deploy che parte. Nei log del build, in cima, vedrai:
   ```
   Running "ignoredBuildStep"...
   🔍 Checking CI status for commit: abc1234...
     Attempt 1/18 — total=2 completed=1 failed=0
     Attempt 2/18 — total=2 completed=2 failed=0
   ✅ All 2 CI check(s) passed — proceeding with build
   ```
   E il build prosegue normalmente.

3. **Test negativo** — per verificare che davvero blocca:
   - Introduci volutamente un test failing (es. `expect(1).toBe(2)` in un test
     nuovo `regression-check.test.js`).
   - Committa + pusha.
   - Su GitHub Actions il job `Lint & Test` diventerà rosso.
   - Su Vercel dovresti vedere:
     ```
     🛑 CI has 1 failed check(s) on this commit — BLOCKING deploy
       ❌ Lint & Test: failure — https://github.com/...
     ```
     E il build **non parte**. Nella dashboard Vercel il deploy appare come
     "Skipped" invece di "Ready".
   - Fai revert del test failing per tornare verde.

---

## Come funziona sotto il cofano

- **exit 1** = "questo commit va buildato" → Vercel procede.
- **exit 0** = "SKIP il build per questo commit" → Vercel salta.
  (È la convenzione Vercel dell'Ignored Build Step, sembra invertita ma è
   documentata così: https://vercel.com/docs/projects/overview#ignored-build-step)

Lo script fa polling di GitHub Actions API su
`/repos/{owner}/{repo}/actions/runs?head_sha={SHA}`, aspetta max 3 minuti che
i workflow_runs risolvano, poi:
- **Ogni workflow_run completed con conclusion=success o skipped** → procedi.
- **Anche un solo workflow_run con conclusion=failure/cancelled/timed_out** →
  blocca subito, elenca quali (con link al run GH per debug).
- **Timeout senza risoluzione** → blocca (fail-closed).
- **HTTP 401/403 dall'API** → blocca + log con istruzioni per rigenerare il PAT.

Regola locked (Ivano): **mai fail-open silenzioso**. In ogni caso di dubbio, si
blocca. L'unica via per disabilitare volutamente è cancellare `GH_TOKEN` dalle
env var Vercel — e lo script log ne dice esplicitamente il motivo.

## Rollback rapido

Se lo script rompe qualcosa (es. bug nel gate stesso):
- Vercel → Settings → Environment Variables → cancella `GH_TOKEN`.
- Lo script vede `GH_TOKEN` vuoto → esce con `exit 0` (BLOCK).
- Vuoi che i deploy ripartano invece? **Elimina anche l'Ignored Build Step**
  (Vercel → Settings → Git → Ignored Build Step → **Don't ignore**).

Zero rischi lasciando lo script attivo senza il PAT: fallisce chiuso, non
aperto. Se hai bisogno di deployare in emergenza senza CI, il rollback vero è
disattivare l'Ignored Build Step.
