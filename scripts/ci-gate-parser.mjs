/**
 * Gate F43 — parser puro del gate CI di Vercel.
 *
 * Perché esiste questo file
 * ─────────────────────────
 * La logica di decisione viveva dentro un heredoc bash (`NODE_PARSER`) in
 * vercel-ignored-build-step.sh: non testabile, non leggibile, e sbagliata in
 * un modo che nessun test avrebbe potuto intercettare perché nessun test
 * poteva esistere.
 *
 * Cosa sbagliava
 * ──────────────
 * Decideva contando i workflow_run: `inProgress.length === 0 && ok.length === total`.
 * Ma nel repo esiste UN SOLO workflow (.github/workflows/ci.yml, name: "CI"),
 * quindi /actions/runs?head_sha= restituisce total_count = 1, non 2. I due job
 * "Lint & Test" ed "E2E Smoke" vivono solo dentro /actions/runs/{id}/jobs —
 * endpoint che lo script non chiamava mai.
 *
 * Conseguenza: "nessun run in_progress" veniva letto come "CI finita e verde",
 * anche in una finestra in cui le check non erano ancora registrate. Alzare il
 * solo timeout avrebbe reso quella finestra più probabile, non meno: un
 * fail-closed che diventa fail-open.
 *
 * La correzione: si guarda la LISTA NOMINALE dei job attesi, non un conteggio.
 * Un job che non c'è ancora è "aspetta"; un job che non c'è più quando tutto è
 * completed è un'anomalia e blocca.
 *
 * `decide()` è pura: nessuna I/O, nessuna rete, nessun process.exit. Tutta la
 * I/O sta nell'entrypoint CLI in fondo.
 */

/** I job che la CI DEVE produrre. Definiti in un solo posto (regola locked #8). */
export const EXPECTED_JOBS = ['Lint & Test', 'E2E Smoke'];

/** Conclusioni che consideriamo un successo. Tutto il resto blocca (fail-closed). */
const OK_CONCLUSIONS = new Set(['success', 'skipped']);

/** Conclusioni esplicitamente di fallimento — distinte solo per il messaggio. */
const FAIL_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out']);

/**
 * Gate F43 Fase 2 — un 403 di GitHub non significa una cosa sola.
 *
 * GitHub risponde 403 sia quando il PAT non ha i permessi, sia quando il rate
 * limit è esaurito. Il gate li trattava entrambi come AUTH_ERROR con il
 * messaggio "rigenera il PAT": una diagnosi sbagliata che manda a caccia di un
 * token sano mentre il problema si risolve da solo aspettando. È la stessa
 * classe di errore della vicenda dei 18 giorni, girata al contrario.
 *
 * Discriminante, in ordine: x-ratelimit-remaining == 0, oppure il body che
 * contiene "rate limit". 401 è sempre autenticazione, mai rate limit.
 *
 * Pura: riceve valori già estratti, non legge header né file.
 *
 * @param {object} input
 * @param {number} input.status     codice HTTP (401, 403, 429)
 * @param {string|null} input.remaining  header x-ratelimit-remaining
 * @param {string|null} input.reset      header x-ratelimit-reset (epoch secondi)
 * @param {string} input.body       corpo della risposta (anche parziale)
 * @returns {{reason:'AUTH_ERROR'|'RATE_LIMITED', detail:string[]}}
 */
export function classifyForbidden({ status, remaining = null, reset = null, body = '' } = {}) {
    // 401 = credenziale non valida. Il rate limit non produce mai 401.
    if (Number(status) === 401) {
        return { reason: 'AUTH_ERROR', detail: ['HTTP 401: credenziale non valida o scaduta'] };
    }

    const exhausted = String(remaining).trim() === '0';
    const saysRateLimit = /rate limit/i.test(String(body));

    if (exhausted || saysRateLimit) {
        const detail = [`HTTP ${status}: rate limit GitHub esaurito`];
        if (exhausted) detail.push('   · x-ratelimit-remaining: 0');
        if (saysRateLimit) detail.push('   · il body cita "rate limit"');

        const resetEpoch = Number(reset);
        if (Number.isFinite(resetEpoch) && resetEpoch > 0) {
            const d = new Date(resetEpoch * 1000);
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            const waitS = Math.max(0, Math.round(resetEpoch - Date.now() / 1000));
            detail.push(`   · il limite si azzera alle ${hh}:${mm} UTC (fra ~${waitS}s)`);
        } else {
            detail.push('   · x-ratelimit-reset non fornito da GitHub');
        }
        detail.push('   · NON è il PAT: non rigenerarlo. Il gate ripassa da solo dopo il reset.');
        return { reason: 'RATE_LIMITED', detail };
    }

    return {
        reason: 'AUTH_ERROR',
        detail: [
            `HTTP ${status}: PAT invalido, scaduto, o senza permesso 'Actions: Read'`,
            "   · rate limit escluso: remaining non è 0 e il body non cita 'rate limit'",
        ],
    };
}

const secondsSince = (iso) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 1000));
};

/**
 * Decide il verdetto del gate.
 *
 * @param {object}   input
 * @param {object[]} input.runs         workflow_run[] da /actions/runs?head_sha=
 * @param {object[]} input.jobs         job[] aggregati da /actions/runs/{id}/jobs
 * @param {string[]} input.expectedJobs nomi dei job attesi
 * @param {number}   input.elapsedMs    ms trascorsi dall'inizio del gate (solo log)
 * @returns {{verdict:'BLOCK'|'PROCEED'|'WAIT', reason:string, detail:string[]}}
 */
export function decide({ runs = [], jobs = [], expectedJobs = EXPECTED_JOBS, elapsedMs = 0 } = {}) {
    const detail = [];
    const elapsedS = Math.round(elapsedMs / 1000);

    // ── Nessun run: la CI non risulta ancora registrata per questo SHA. ──────
    if (!Array.isArray(runs) || runs.length === 0) {
        return {
            verdict: 'WAIT',
            reason: 'NOT_REGISTERED',
            detail: [`nessun workflow_run per questo SHA (elapsed=${elapsedS}s)`],
        };
    }

    const runById = new Map(runs.map(r => [r.id, r]));
    const allRunsCompleted = runs.every(r => r.status === 'completed');

    // Indicizza i job attesi per nome. Se GitHub ne restituisse due con lo
    // stesso nome (re-run), vince l'ultimo: è quello che descrive lo stato ora.
    const byName = new Map();
    for (const j of jobs) {
        if (j && typeof j.name === 'string') byName.set(j.name, j);
    }

    // Job non attesi: si loggano, ma NON entrano nel verdetto. Un job aggiunto
    // domani al workflow non deve rompere il deploy in silenzio.
    const extras = jobs.filter(j => j && !expectedJobs.includes(j.name));
    for (const j of extras) {
        detail.push(`   · [extra, ignorato] ${j.name}: ${j.status}/${j.conclusion ?? '—'}`);
    }

    // ── (a) un job atteso è fallito → BLOCK ─────────────────────────────────
    const failed = expectedJobs
        .map(name => byName.get(name))
        .filter(j => j && j.status === 'completed' && !OK_CONCLUSIONS.has(j.conclusion));

    if (failed.length > 0) {
        for (const j of failed) {
            const kind = FAIL_CONCLUSIONS.has(j.conclusion) ? j.conclusion : `${j.conclusion ?? 'null'} (conclusione inattesa)`;
            detail.push(`   ❌ ${j.name}: ${kind}`);
            if (j.html_url) detail.push(`      ${j.html_url}`);
        }
        return { verdict: 'BLOCK', reason: 'CI_FAILED', detail };
    }

    // ── job attesi mancanti o non ancora conclusi ───────────────────────────
    const missing = expectedJobs.filter(name => !byName.has(name));
    const pending = expectedJobs
        .map(name => byName.get(name))
        .filter(j => j && j.status !== 'completed');

    if (missing.length > 0 || pending.length > 0) {
        // ── (d) tutti i run sono completed ma un job atteso non è MAI comparso.
        // Non è lentezza: è un'anomalia (workflow rinominato, job rimosso,
        // matrice che non ha prodotto quel job). Fail-closed.
        if (allRunsCompleted && missing.length > 0) {
            detail.push(`   ❌ run completed ma job atteso mai comparso: ${missing.join(', ')}`);
            detail.push(`   · job visti: ${jobs.map(j => j.name).join(', ') || '(nessuno)'}`);
            detail.push('   · workflow rinominato? job rimosso da ci.yml? EXPECTED_JOBS da aggiornare?');
            return { verdict: 'BLOCK', reason: 'MISSING_EXPECTED_JOB', detail };
        }

        // ── (b) altrimenti si aspetta, dicendo CHI si sta aspettando. ────────
        for (const name of missing) {
            detail.push(`   ⏳ ${name}: non ancora presente`);
        }
        for (const j of pending) {
            const run = runById.get(j.run_id);
            const age = secondsSince(j.started_at || run?.run_started_at);
            detail.push(`   ⏳ ${j.name}: ${j.status}${age !== null ? ` da ${age}s` : ''}`);
        }
        return { verdict: 'WAIT', reason: 'JOB_PENDING', detail };
    }

    // ── (c) tutti presenti, completed, verdi ────────────────────────────────
    for (const name of expectedJobs) {
        const j = byName.get(name);
        const age = secondsSince(j.started_at);
        detail.push(`   ✓ ${j.name}: ${j.conclusion}${age !== null ? ` (${age}s fa)` : ''}`);
    }
    return { verdict: 'PROCEED', reason: 'ALL_GREEN', detail };
}

// ─── ENTRYPOINT CLI ─────────────────────────────────────────────────────────
// Tutta la I/O vive qui. Due modi:
//   node ci-gate-parser.mjs run-ids            → stampa gli id dei workflow_run
//   node ci-gate-parser.mjs decide <elapsedMs> → stampa "VERDICT REASON" + dettagli
//
// Il guard evita che l'import dal test esegua il CLI.
//
// NON usare `import.meta.url === \`file://${process.argv[1]}\``: il path del
// repo contiene uno spazio ("unnivai ricresa"), quindi import.meta.url è
// percent-encoded (%20) e il confronto è sempre falso. Il CLI non stampava
// nulla, e lo script bash lo leggeva come output inatteso → PARSE_ERROR →
// deploy bloccato a ogni push. pathToFileURL applica la stessa codifica.
const { pathToFileURL } = await import('node:url');
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
    const { readFileSync, readdirSync } = await import('node:fs');

    const readJson = (path) => {
        try {
            return JSON.parse(readFileSync(path, 'utf8'));
        } catch {
            return null;
        }
    };

    const mode = process.argv[2] || 'decide';

    // ── classify <status> — discrimina 403 permessi da 403 rate limit ───────
    // Legge gli header dumpati da curl (-D) e il body grezzo. Stampa
    // "REASON" sulla prima riga e i dettagli sotto, come `decide`.
    if (mode === 'classify') {
        const status = Number(process.argv[3]) || 0;
        let headersRaw = '';
        let bodyRaw = '';
        try { headersRaw = readFileSync('/tmp/gh_headers.txt', 'utf8'); } catch { /* assente */ }
        try { bodyRaw = readFileSync(process.argv[4] || '/tmp/gh_runs.json', 'utf8').slice(0, 2000); } catch { /* assente */ }

        const header = (name) => {
            // curl -D accumula anche i blocchi di redirect: vince l'ultimo.
            const re = new RegExp(`^${name}:\\s*(.+)$`, 'gim');
            let m, last = null;
            while ((m = re.exec(headersRaw)) !== null) last = m[1].trim();
            return last;
        };

        const { reason, detail } = classifyForbidden({
            status,
            remaining: header('x-ratelimit-remaining'),
            reset: header('x-ratelimit-reset'),
            body: bodyRaw,
        });
        console.log(reason);
        for (const line of detail) console.log(`   ${line}`);
        process.exit(0);
    }

    const runsJson = readJson('/tmp/gh_runs.json');

    if (mode === 'run-ids') {
        const runs = Array.isArray(runsJson?.workflow_runs) ? runsJson.workflow_runs : [];
        for (const r of runs) if (r?.id) console.log(r.id);
        process.exit(0);
    }

    if (!runsJson) {
        console.log('BLOCK PARSE_ERROR');
        console.log('   /tmp/gh_runs.json illeggibile o non JSON');
        process.exit(0);
    }

    // I job arrivano da N file /tmp/gh_jobs_<runId>.json, uno per workflow_run.
    const jobs = [];
    let jobFiles = 0;
    try {
        for (const f of readdirSync('/tmp')) {
            if (!/^gh_jobs_.*\.json$/.test(f)) continue;
            jobFiles++;
            const j = readJson(`/tmp/${f}`);
            if (Array.isArray(j?.jobs)) jobs.push(...j.jobs);
        }
    } catch { /* /tmp illeggibile: jobs resta vuoto → WAIT, mai PROCEED */ }

    const runs = Array.isArray(runsJson.workflow_runs) ? runsJson.workflow_runs : [];
    const elapsedMs = Number(process.argv[3]) || 0;
    const { verdict, reason, detail } = decide({ runs, jobs, elapsedMs });

    console.log(`${verdict} ${reason}`);
    console.log(`   · run: ${runs.length}, file job letti: ${jobFiles}, job totali: ${jobs.length}`);
    for (const line of detail) console.log(line);
}
