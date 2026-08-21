/**
 * Gate F43 — unit test del parser del gate CI.
 *
 * Prima di questo file la decisione viveva in un heredoc bash e non era
 * testabile: il difetto (contare i workflow_run invece di guardare i job per
 * nome) è sopravvissuto proprio perché nessun test poteva esistere.
 *
 * Fixture inline, zero rete.
 */
import { describe, it, expect } from 'vitest';
import { decide, classifyForbidden, EXPECTED_JOBS } from '../../scripts/ci-gate-parser.mjs';

const RUN_ID = 32296513827;

const run = (status, conclusion = null) => ({
    id: RUN_ID,
    name: 'CI',
    status,
    conclusion,
    run_started_at: new Date(Date.now() - 90_000).toISOString(),
    html_url: `https://github.com/scirettaclienti-design/unnivai/actions/runs/${RUN_ID}`,
});

const job = (name, status, conclusion = null) => ({
    id: Math.abs(name.length * 1000 + status.length),
    run_id: RUN_ID,
    name,
    status,
    conclusion,
    started_at: new Date(Date.now() - 60_000).toISOString(),
    html_url: `https://github.com/scirettaclienti-design/unnivai/actions/runs/${RUN_ID}/job/1`,
});

describe('F43 — il parser guarda i job per nome, non il conteggio dei run', () => {
    it('EXPECTED_JOBS è definito in un solo posto e contiene i due job reali', () => {
        expect(EXPECTED_JOBS).toEqual(['Lint & Test', 'E2E Smoke']);
    });

    it('run non ancora registrato (total_count 0) → WAIT NOT_REGISTERED', () => {
        const r = decide({ runs: [], jobs: [] });
        expect(r.verdict).toBe('WAIT');
        expect(r.reason).toBe('NOT_REGISTERED');
    });

    it('run in corso, E2E Smoke ASSENTE dalla lista job → WAIT JOB_PENDING', () => {
        // È la finestra che il vecchio parser leggeva come "tutto verde":
        // un solo workflow_run, nessuno in_progress ancora registrato.
        const r = decide({
            runs: [run('in_progress')],
            jobs: [job('Lint & Test', 'completed', 'success')],
        });
        expect(r.verdict).toBe('WAIT');
        expect(r.reason).toBe('JOB_PENDING');
        expect(r.detail.join('\n')).toContain('E2E Smoke');
    });

    it('run in corso, E2E Smoke in_progress → WAIT JOB_PENDING con i secondi trascorsi', () => {
        const r = decide({
            runs: [run('in_progress')],
            jobs: [job('Lint & Test', 'completed', 'success'), job('E2E Smoke', 'in_progress')],
        });
        expect(r.verdict).toBe('WAIT');
        expect(r.reason).toBe('JOB_PENDING');
        expect(r.detail.join('\n')).toMatch(/E2E Smoke: in_progress da \d+s/);
    });

    it('Lint & Test failure → BLOCK CI_FAILED, con nome job e url', () => {
        const r = decide({
            runs: [run('completed', 'failure')],
            jobs: [job('Lint & Test', 'completed', 'failure'), job('E2E Smoke', 'completed', 'success')],
        });
        expect(r.verdict).toBe('BLOCK');
        expect(r.reason).toBe('CI_FAILED');
        expect(r.detail.join('\n')).toContain('Lint & Test: failure');
        expect(r.detail.join('\n')).toContain('https://github.com/');
    });

    it('entrambi success → PROCEED ALL_GREEN', () => {
        const r = decide({
            runs: [run('completed', 'success')],
            jobs: [job('Lint & Test', 'completed', 'success'), job('E2E Smoke', 'completed', 'success')],
        });
        expect(r.verdict).toBe('PROCEED');
        expect(r.reason).toBe('ALL_GREEN');
    });

    it('E2E Smoke skipped → PROCEED ALL_GREEN', () => {
        const r = decide({
            runs: [run('completed', 'success')],
            jobs: [job('Lint & Test', 'completed', 'success'), job('E2E Smoke', 'completed', 'skipped')],
        });
        expect(r.verdict).toBe('PROCEED');
        expect(r.reason).toBe('ALL_GREEN');
    });

    it('run completed ma E2E Smoke mai comparso → BLOCK MISSING_EXPECTED_JOB', () => {
        const r = decide({
            runs: [run('completed', 'success')],
            jobs: [job('Lint & Test', 'completed', 'success')],
        });
        expect(r.verdict).toBe('BLOCK');
        expect(r.reason).toBe('MISSING_EXPECTED_JOB');
        expect(r.detail.join('\n')).toContain('E2E Smoke');
    });

    it('un job EXTRA in failure non deve produrre BLOCK', () => {
        // Un job aggiunto domani al workflow non rompe il deploy in silenzio.
        const r = decide({
            runs: [run('completed', 'success')],
            jobs: [
                job('Lint & Test', 'completed', 'success'),
                job('E2E Smoke', 'completed', 'success'),
                job('Deploy Preview', 'completed', 'failure'),
            ],
        });
        expect(r.verdict).toBe('PROCEED');
        expect(r.reason).toBe('ALL_GREEN');
        expect(r.detail.join('\n')).toContain('[extra, ignorato] Deploy Preview');
    });
});

describe('F43 — fail-closed sui casi limite', () => {
    it('una conclusione inattesa su un job atteso blocca (non è in OK)', () => {
        // 'action_required' = la CI aspetta un'approvazione: non è verde.
        const r = decide({
            runs: [run('completed', 'action_required')],
            jobs: [job('Lint & Test', 'completed', 'success'), job('E2E Smoke', 'completed', 'action_required')],
        });
        expect(r.verdict).toBe('BLOCK');
        expect(r.reason).toBe('CI_FAILED');
        expect(r.detail.join('\n')).toContain('conclusione inattesa');
    });

    it('run presenti ma lista job vuota e run in corso → WAIT, mai PROCEED', () => {
        const r = decide({ runs: [run('in_progress')], jobs: [] });
        expect(r.verdict).toBe('WAIT');
        expect(r.reason).toBe('JOB_PENDING');
    });

    it('il fallimento di un job atteso vince sulla presenza di un altro pending', () => {
        const r = decide({
            runs: [run('in_progress')],
            jobs: [job('Lint & Test', 'completed', 'failure'), job('E2E Smoke', 'in_progress')],
        });
        expect(r.verdict).toBe('BLOCK');
        expect(r.reason).toBe('CI_FAILED');
    });

    it('decide() è puro: nessun input mutato', () => {
        const runs = [run('completed', 'success')];
        const jobs = [job('Lint & Test', 'completed', 'success'), job('E2E Smoke', 'completed', 'success')];
        const snapshot = JSON.stringify({ runs, jobs });
        decide({ runs, jobs });
        expect(JSON.stringify({ runs, jobs })).toBe(snapshot);
    });
});

describe('F43 Fase 2 — un 403 di GitHub non significa una cosa sola', () => {
    const RATE_BODY = '{"message":"API rate limit exceeded for 82.59.1.1. (But here\'s the good news: Authenticated requests get a higher rate limit.)","documentation_url":"https://docs.github.com/rest/overview/rate-limits-for-the-rest-api"}';
    const PERM_BODY = '{"message":"Resource not accessible by personal access token","documentation_url":"https://docs.github.com/rest"}';

    it('403 con body rate-limit → RATE_LIMITED, e dice di NON rigenerare il PAT', () => {
        const r = classifyForbidden({ status: 403, remaining: '0', reset: null, body: RATE_BODY });
        expect(r.reason).toBe('RATE_LIMITED');
        expect(r.detail.join('\n')).toContain('NON è il PAT');
    });

    it('403 con body permessi → AUTH_ERROR', () => {
        const r = classifyForbidden({ status: 403, remaining: '4998', reset: null, body: PERM_BODY });
        expect(r.reason).toBe('AUTH_ERROR');
        expect(r.detail.join('\n')).toContain("Actions: Read");
    });

    it('x-ratelimit-remaining a 0 basta, anche senza "rate limit" nel body', () => {
        expect(classifyForbidden({ status: 403, remaining: '0', body: '{}' }).reason).toBe('RATE_LIMITED');
    });

    it('il body che cita "rate limit" basta, anche senza header remaining', () => {
        expect(classifyForbidden({ status: 403, remaining: null, body: RATE_BODY }).reason).toBe('RATE_LIMITED');
    });

    it('401 è SEMPRE auth, anche con remaining a 0: il rate limit non produce 401', () => {
        const r = classifyForbidden({ status: 401, remaining: '0', body: RATE_BODY });
        expect(r.reason).toBe('AUTH_ERROR');
    });

    it('429 con rate limit → RATE_LIMITED', () => {
        expect(classifyForbidden({ status: 429, remaining: '0', body: RATE_BODY }).reason).toBe('RATE_LIMITED');
    });

    it("x-ratelimit-reset diventa un orario leggibile e un'attesa in secondi", () => {
        const reset = Math.floor(Date.now() / 1000) + 600;
        const r = classifyForbidden({ status: 403, remaining: '0', reset: String(reset), body: RATE_BODY });
        expect(r.detail.join('\n')).toMatch(/si azzera alle \d{2}:\d{2} UTC \(fra ~\d+s\)/);
    });

    it('senza x-ratelimit-reset lo dichiara invece di inventare un orario', () => {
        const r = classifyForbidden({ status: 403, remaining: '0', reset: null, body: RATE_BODY });
        expect(r.detail.join('\n')).toContain('x-ratelimit-reset non fornito');
    });

    it('403 senza indizi di rate limit resta AUTH_ERROR (fail-closed sul caso ignoto)', () => {
        const r = classifyForbidden({ status: 403, remaining: null, reset: null, body: '' });
        expect(r.reason).toBe('AUTH_ERROR');
    });
});
