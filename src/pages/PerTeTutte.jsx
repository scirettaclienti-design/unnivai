// PER-TE-TRE (T27) — «Vedi tutte»: l'elenco completo delle proposte di Per Te, con le schede della home. Non genera niente: mostra quello che la
// home ha gia' pronto per questa citta', questo giorno e questa fascia. Se non c'e' niente, lo dice.
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Compass } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/hooks/useUserContext';
import PerTeCard from '@/components/PerTeCard';
import BottomNavigation from '@/components/BottomNavigation';
import { giornoEFasciaPerTe, perTeDellaFascia } from '@/lib/perTeSalvato';
import { rigaPerDopo } from '@/lib/perTeProposte';
import { TESTI_PER_TE } from '@/lib/testiHome';

const PerTeTutte = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    // la stessa citta' della home: e' lei che scrive la chiave del Per Te salvato
    const { city, isLoading } = useUserContext();
    const { giorno, fascia } = giornoEFasciaPerTe(new Date());
    const dati = perTeDellaFascia(['home-experiences', city, giorno, fascia], user?.id ?? null);
    const proposte = dati?.tours || [];
    const nDopo = proposte.filter(e => e.perDopo).length;
    const riga = nDopo === 0 ? null : rigaPerDopo(proposte.find(e => e.perDopo).perDopo.quando, nDopo === proposte.length);
    const mancanti = TESTI_PER_TE.passioneMancante(dati?.passioniMancanti, city);

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-quicksand pb-32">
            <main className="max-w-md mx-auto px-6 pt-6 space-y-4">
                <button
                    type="button"
                    onClick={() => navigate('/dashboard-user')}
                    aria-label={TESTI_PER_TE.tornaAllaHome}
                    className="min-h-[44px] -ml-2 pr-3 flex items-center gap-1 text-obsidian-secondary text-sm font-semibold"
                >
                    <ChevronLeft className="w-5 h-5" /> {TESTI_PER_TE.tornaAllaHome}
                </button>
                <h1 className="text-2xl font-bold font-playfair">{TESTI_PER_TE.titolo}</h1>
                {riga && <p className="text-obsidian-secondary text-xs">{riga}</p>}
                {mancanti && <p className="text-obsidian-secondary text-xs">{mancanti}</p>}
                {isLoading ? null : proposte.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3" data-testid="per-te-elenco">
                        {proposte.map((exp, i) => <PerTeCard key={`${exp.themeType || 'tour'}-${i}`} exp={exp} city={city} className="block min-w-0" />)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="per-te-vuoto">
                        <div className="w-12 h-12 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center mb-3 text-obsidian-secondary">
                            <Compass className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <p className="text-obsidian-primary text-sm mb-1 font-semibold">{TESTI_PER_TE.vuoto.titolo}</p>
                        <p className="text-obsidian-secondary text-xs mb-4">{TESTI_PER_TE.vuoto.testo}</p>
                        <Link to="/dashboard-user" className="px-5 py-2.5 bg-brand-orange text-obsidian-bg rounded-2xl text-xs font-bold">{TESTI_PER_TE.tornaAllaHome}</Link>
                    </div>
                )}
            </main>
            <BottomNavigation />
        </div>
    );
};

export default PerTeTutte;
