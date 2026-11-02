/**
 * OSPITE-GIRO — «Prova un giro, senza account»: entra con un account anonimo e lascia decidere a RootDispatcher
 * (gusti la prima volta, poi la home). Se gli accessi anonimi sono spenti lo dice, e resta la registrazione.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, Loader } from 'lucide-react';
import { entraComeOspite, TESTI_OSPITE } from '../lib/ospite';

export default function ProvaSenzaAccount({ className = '', conSotto = true }) {
    const navigate = useNavigate();
    const [stato, setStato] = useState('pronto'); // pronto | entro
    const [errore, setErrore] = useState(null);

    const prova = async () => {
        if (stato !== 'pronto') return;
        setErrore(null);
        setStato('entro');
        const r = await entraComeOspite();
        if (!r.ok) {
            setErrore(r.motivo);
            setStato('pronto');
            return;
        }
        navigate('/', { replace: true });
    };

    return (
        <div className={`text-center ${className}`}>
            <button
                type="button"
                onClick={prova}
                disabled={stato === 'entro'}
                data-testid="prova-senza-account"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-obsidian-border bg-obsidian-card text-obsidian-primary text-sm font-bold hover:border-brand-orange transition-colors cursor-pointer disabled:opacity-60"
            >
                {stato === 'entro'
                    ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />
                    : <Footprints className="w-4 h-4 text-brand-orange" aria-hidden="true" />}
                <span>{TESTI_OSPITE.PROVA}</span>
            </button>
            {conSotto && !errore && <p className="text-xs text-obsidian-secondary mt-2">{TESTI_OSPITE.PROVA_SOTTO}</p>}
            {errore && <p role="alert" data-testid="prova-errore" className="text-xs text-brand-orange mt-2">{errore}</p>}
        </div>
    );
}
