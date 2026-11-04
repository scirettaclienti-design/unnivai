/**
 * ACCOUNT-PRIVACY — la schermata del consenso ai servizi AI di terzi. Una sola in App.
 * Si apre da sola alla prima apertura di chi è dentro (anche ospite) e senza consenso, e quando un servizio AI trova il consenso
 * mancante (evento `dvai:consenso-ai`). Non copre le pagine di privacy e termini, né il login. «Va bene» la chiude per sempre.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { haConsensoAi, daiConsensoAi, EVENTO_CONSENSO_AI, EVENTO_CONSENSO_RIMANDATO, consensoRimandato } from '../lib/consensoAi';
import { CONSENSO_AI } from '../lib/testiAccount';

// ONBOARDING-ACCESSO: nel primo ingresso (/onboarding) il consenso è il primo passo della pagina, non questa finestra sopra.
const SENZA_SCHERMATA = ['/privacy', '/termini', '/login', '/update-password', '/onboarding'];

export default function ConsensoAi() {
    const { user, loading } = useAuth();
    const { pathname } = useLocation();
    const [richiesto, setRichiesto] = useState(false);   // un servizio AI ha trovato il consenso mancante
    const [chiuso, setChiuso] = useState(consensoRimandato); // «Non adesso» per questa apertura (anche dal primo ingresso)
    const [occupato, setOccupato] = useState(false);
    const [dato, setDato] = useState(0);                  // si rilegge il consenso dopo il «Va bene»

    useEffect(() => {
        const apri = () => { setRichiesto(true); setChiuso(false); };
        const rimanda = () => setChiuso(true);
        window.addEventListener(EVENTO_CONSENSO_AI, apri);
        window.addEventListener(EVENTO_CONSENSO_RIMANDATO, rimanda);
        return () => {
            window.removeEventListener(EVENTO_CONSENSO_AI, apri);
            window.removeEventListener(EVENTO_CONSENSO_RIMANDATO, rimanda);
        };
    }, []);

    // dato: forza il ricalcolo dopo il «Va bene» (il consenso sta in localStorage, non in uno stato).
    const ha = dato >= 0 && haConsensoAi(user);
    const suPaginaLibera = SENZA_SCHERMATA.includes(pathname);
    // Su «/» decide RootDispatcher dove andare (home o primo ingresso): da sola la finestra non si apre lì, niente lampo.
    const daAprire = !loading && !ha && !suPaginaLibera && (richiesto || (!!user && !chiuso && pathname !== '/'));
    if (!daAprire) return null;

    const vabene = async () => {
        setOccupato(true);
        await daiConsensoAi(user);
        setOccupato(false);
        setRichiesto(false);
        setDato((n) => n + 1);
    };
    const nonAdesso = () => { setChiuso(true); setRichiesto(false); };

    return (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center font-sans" role="dialog" aria-modal="true" aria-labelledby="consenso-ai-titolo" data-testid="consenso-ai">
            <div className="absolute inset-0 bg-obsidian-bg/80" />
            <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-obsidian-card border border-obsidian-border px-5 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                <h2 id="consenso-ai-titolo" className="font-marchio text-[24px] leading-[1.1] font-extrabold tracking-tight text-obsidian-primary">{CONSENSO_AI.TITOLO}</h2>
                <p className="mt-2 text-sm text-obsidian-secondary leading-relaxed">{CONSENSO_AI.INTRO}</p>
                <ul className="mt-4 space-y-3">
                    {CONSENSO_AI.SERVIZI.map((s) => (
                        <li key={s.nome} className="rounded-2xl border border-obsidian-border bg-obsidian-raised px-4 py-3">
                            <p className="text-sm font-bold text-obsidian-primary">{s.nome}</p>
                            <p className="mt-1 text-[13px] text-obsidian-secondary leading-relaxed">{s.ricevono}</p>
                        </li>
                    ))}
                </ul>
                <p className="mt-3 text-[13px] text-obsidian-secondary leading-relaxed">{CONSENSO_AI.NON_RICEVONO}</p>
                <Link to="/privacy" className="mt-3 inline-block text-sm font-bold text-brand-orange underline underline-offset-4 min-h-[44px] leading-[44px]" data-testid="consenso-ai-privacy">{CONSENSO_AI.PRIVACY_LINK}</Link>
                <button type="button" onClick={vabene} disabled={occupato} className="mt-1 w-full min-h-[48px] rounded-xl bg-brand-orange text-obsidian-bg text-sm font-bold disabled:opacity-60 cursor-pointer" data-testid="consenso-ai-ok">{CONSENSO_AI.OK}</button>
                <button type="button" onClick={nonAdesso} className="mt-2 w-full min-h-[44px] rounded-xl text-sm font-bold text-obsidian-secondary cursor-pointer" data-testid="consenso-ai-no">{CONSENSO_AI.NON_ADESSO}</button>
            </div>
        </div>
    );
}
