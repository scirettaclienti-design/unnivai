/**
 * DNA-6 — il tasto «Salva» dei giri generati (Per Te, Quiz, Crea, Sorprendimi).
 * Salva il giro per l'utente (public.saved_tours) e registra `tour_saved`. Si mostra «Salvato»
 * solo se il server ha risposto bene. Gli ospiti non hanno un posto dove salvare: il tasto lo dice.
 */

import { useState } from 'react';
import { Bookmark, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { salvaGiro, giroDaSalvare } from '../lib/giriSalvati';

export default function SalvaGiro({ tour, sorgente = 'altro', className = '' }) {
    const user = useAuth()?.user ?? null;
    const { toast } = useToast();
    const [stato, setStato] = useState('pronto'); // pronto | salvo | salvato

    // Un giro senza titolo o senza tappe non si salva: il tasto non compare.
    if (!giroDaSalvare(tour, sorgente)) return null;

    const salva = async () => {
        if (stato !== 'pronto') return;
        if (!user?.id) {
            toast({ title: 'Accedi per salvare i giri nel tuo Profilo.', type: 'info' });
            return;
        }
        setStato('salvo');
        const r = await salvaGiro(user.id, tour, sorgente);
        if (!r.ok) {
            setStato('pronto');
            toast({ title: 'Non sono riuscito a salvare il giro. Riprova tra poco.', type: 'warning' });
            return;
        }
        setStato('salvato');
        toast({ title: r.giaSalvato ? 'Questo giro era già nel tuo Profilo.' : 'Giro salvato nel tuo Profilo.', type: 'success' });
    };

    const salvato = stato === 'salvato';
    return (
        <button
            type="button"
            onClick={salva}
            disabled={stato === 'salvo'}
            aria-pressed={salvato}
            data-testid="salva-giro"
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                salvato
                    ? 'bg-obsidian-raised text-obsidian-primary border-brand-orange'
                    : 'bg-obsidian-raised text-obsidian-primary border-obsidian-border hover:border-brand-orange'
            } ${className}`}
        >
            {stato === 'salvo'
                ? <Loader className="w-4 h-4 animate-spin" />
                : <Bookmark className={`w-4 h-4 ${salvato ? 'text-brand-orange fill-current' : 'text-obsidian-secondary'}`} />}
            <span>{salvato ? 'Salvato' : stato === 'salvo' ? 'Salvo…' : 'Salva il giro'}</span>
        </button>
    );
}
