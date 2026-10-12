// ONB-1 — prova reale: login, logout, login con l'account di prova, SENZA chiamate AI
// (costo 0). Usa il codice vero dell'app (AuthProvider.signOut, resolveOnboardingStatus,
// useAILearning.saveInterests) contro il DB vero. Le credenziali vengono solo da
// .env.local e non si stampano. Lo stato iniziale del seme dell'account di prova viene
// letto e RIPRISTINATO alla fine.
//   npx vitest run -c scripts/prova-reale/vitest.prova.config.js scripts/prova-reale/onb1.live.js
import { it, expect, beforeAll, afterAll } from 'vitest';
import { createElement } from 'react';
import { render, renderHook, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { dataService } from '@/services/dataService';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useAILearning } from '@/hooks/useAILearning';
import { resolveOnboardingStatus, localOnboardingDone, ONBOARDING_FLAG_KEY, ONBOARDING_SEED_KEY } from '@/lib/onboardingStatus';
import { buildSeed } from '@/lib/foodPrefs';

const OUT = process.env.PROVA_OUT || path.join(os.tmpdir(), 'onb1.json');
const out = { passi: [] };
const passo = (nome, ok, dettaglio) => { out.passi.push({ nome, ok, dettaglio }); console.log(`[onb1] ${ok ? 'OK ' : 'KO '} ${nome}${dettaglio ? ' — ' + dettaglio : ''}`); };
const wrapper = ({ children }) => createElement(QueryClientProvider, { client: new QueryClient() }, createElement(AuthProvider, null, children));
const svuotaBrowser = () => { for (const k of Object.keys(localStorage)) if (!k.startsWith('sb-')) localStorage.removeItem(k); };
const login = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: process.env.TEST_ACCOUNT_EMAIL, password: process.env.TEST_ACCOUNT_PASSWORD });
    if (error || !data?.session) throw new Error(`login fallito: ${error?.status || ''} ${error?.code || 'nessuna sessione'}`);
    return data.session.user.id;
};
const graph = async (uid) => {
    const { data } = await supabase.from('user_preferences').select('preference_data,interactions,total_interactions').eq('user_id', uid).maybeSingle();
    return JSON.stringify(data ?? null);
};

let uid; let originale;
beforeAll(async () => {
    if (!process.env.TEST_ACCOUNT_EMAIL || !process.env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali dell\'account di prova in .env.local');
    uid = await login();
    const s = await dataService.getOnboardingState(uid);
    if (!s.ok) throw new Error('impossibile leggere lo stato iniziale: ' + s.error);
    originale = s.seed;
    out.statoIniziale = originale === null ? 'seme NULL (mai fatto)' : 'seme presente';
});
afterAll(async () => {
    // Ripristino dello stato iniziale (NULL compreso), poi uscita.
    const r = await dataService.upsertOnboardingSeed(uid, originale);
    passo('ripristino dello stato iniziale del seme', !!r.success);
    out.dopoRipristino = JSON.stringify((await dataService.getOnboardingState(uid)).seed) === JSON.stringify(originale);
    writeFileSync(OUT, JSON.stringify(out, null, 1));
    await supabase.auth.signOut();
});

it('onboarding su account: login → logout → login, altro browser, modifica dal Profilo', async () => {
    // 1. L'utente fa l'onboarding (percorso vero: upsertOnboardingSeed), il browser ne tiene la copia.
    const seed = buildSeed({ interessi: ['food', 'natura'], dieta: [], budget: null, stile: null });
    expect((await dataService.upsertOnboardingSeed(uid, seed)).success).toBe(true);
    localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(seed));
    localStorage.setItem(ONBOARDING_FLAG_KEY, uid);
    passo('onboarding salvato sul DB (food, natura)', true);

    // 2. LOGOUT col codice vero di AuthProvider.
    const Out = () => { const { signOut } = useAuth(); return createElement('button', { onClick: signOut }, 'esci'); };
    render(createElement(wrapper, null, createElement(Out)));
    fireEvent.click(await screen.findByText('esci'));
    await waitFor(() => expect(localStorage.getItem(ONBOARDING_SEED_KEY)).toBeNull());
    const { data: { session } } = await supabase.auth.getSession();
    passo('logout: sessione chiusa', session === null);
    passo('logout: flag "onboarding fatto" NON cancellato', localStorage.getItem(ONBOARDING_FLAG_KEY) === uid);
    passo('logout: copia dei gusti nel browser svuotata', localStorage.getItem(ONBOARDING_SEED_KEY) === null);
    expect(session).toBeNull();

    // 3. LOGIN di nuovo, con il browser completamente svuotato (caso peggiore: altro browser/indirizzo).
    svuotaBrowser();
    uid = await login();
    const stato = await resolveOnboardingStatus(uid);
    passo('login su browser VUOTO: stato onboarding', stato === 'done', stato);
    expect(stato).toBe('done');
    passo('gli interessi sono tornati nel browser dal DB', JSON.parse(localStorage.getItem(ONBOARDING_SEED_KEY) || 'null')?.interessi?.join(',') === 'food,natura');
    passo('flag legato all\'utente ricostruito', localOnboardingDone(uid));

    // 4. Modifica dal Profilo (useAILearning.saveInterests): cambia il seme, il DNA resta.
    const prima = await graph(uid);
    const { result } = renderHook(() => useAILearning(), { wrapper });
    await waitFor(() => expect(result.current.interestIds).toEqual(['food', 'natura']));
    passo('il Profilo mostra gli interessi dell\'account', true, 'food, natura');
    let r;
    await act(async () => { r = await result.current.saveInterests(['relax', 'cultura']); });
    expect(r.success).toBe(true);
    const dopoSeed = (await dataService.getOnboardingState(uid)).seed;
    passo('modifica salvata nel DB', dopoSeed.interessi.join(',') === 'cultura,arte,relax' || dopoSeed.interessi.join(',') === 'relax,cultura,arte', dopoSeed.interessi.join(','));
    const dopo = await graph(uid);
    passo('DNA (preference_data, interactions, total) invariato', prima === dopo);
    expect(prima).toBe(dopo);

    // 5. Ultimo logout/login: la modifica c'e' ancora e non c'e' onboarding.
    await supabase.auth.signOut();
    svuotaBrowser();
    uid = await login();
    passo('dopo la modifica: stato onboarding', (await resolveOnboardingStatus(uid)) === 'done');
    passo('dopo la modifica: gli interessi nuovi sono nel browser', JSON.parse(localStorage.getItem(ONBOARDING_SEED_KEY)).interessi.includes('relax'));
    expect(out.passi.every(p => p.ok)).toBe(true);
}, 120000);
