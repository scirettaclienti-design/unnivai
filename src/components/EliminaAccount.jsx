/**
 * ACCOUNT-PRIVACY — «Elimina account» nel Profilo: una voce discreta che apre una conferma chiara
 * (cosa si cancella, che non si torna indietro, la parola «elimina» da scrivere). Poi funzione, esci, home con un messaggio.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { eliminaAccount, confermaValida, pulisciTelefono } from '../lib/eliminaAccount';
import { isOspite } from '../lib/ospite';
import { ELIMINA, PAROLA_ELIMINA } from '../lib/testiAccount';

export default function EliminaAccount() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [aperto, setAperto] = useState(false);
    const [scritto, setScritto] = useState('');
    const [occupato, setOccupato] = useState(false);
    const [errore, setErrore] = useState(null);

    if (!user) return null;

    const chiudi = () => { if (occupato) return; setAperto(false); setScritto(''); setErrore(null); };

    const conferma = async (e) => {
        e.preventDefault();
        if (!confermaValida(scritto) || occupato) return;
        setOccupato(true);
        setErrore(null);
        const r = await eliminaAccount();
        if (!r.ok) { setOccupato(false); setErrore(r.messaggio); return; }
        // Fatto davvero: esco, pulisco il telefono, torno alla home col messaggio.
        try { await signOut(); } catch { /* la sessione è già morta con l'utente */ }
        pulisciTelefono();
        // Persistente: signOut smonta l'albero (schermata di caricamento) e ToastProvider con lui; il messaggio arriva quando torna.
        toast({ title: ELIMINA.FATTO, type: 'success', duration: 7000, persistente: true });
        navigate('/', { replace: true });
    };

    return (
        <section className="mt-8" data-testid="elimina-account">
            <button type="button" onClick={() => setAperto(true)} className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-obsidian-border bg-obsidian-card text-sm font-bold text-obsidian-secondary cursor-pointer" data-testid="elimina-account-apri">
                <Trash2 size={16} aria-hidden="true" />{ELIMINA.VOCE_PROFILO}
            </button>
            <p className="mt-2 text-center text-[12px] text-obsidian-secondary">{ELIMINA.VOCE_SOTTO}</p>

            {aperto && (
                <div className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center font-sans" role="dialog" aria-modal="true" aria-labelledby="elimina-titolo" data-testid="elimina-account-dialogo">
                    <div className="absolute inset-0 bg-obsidian-bg/80" onClick={chiudi} />
                    <form onSubmit={conferma} noValidate className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-obsidian-card border border-obsidian-border px-5 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                        <h2 id="elimina-titolo" className="text-[22px] leading-tight font-bold text-obsidian-primary">{ELIMINA.TITOLO}</h2>
                        <ul className="mt-3 space-y-1.5 text-sm text-obsidian-secondary leading-relaxed list-disc pl-5">
                            {ELIMINA.COSA_SI_CANCELLA.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                        {isOspite(user) && <p className="mt-3 text-sm text-obsidian-secondary">{ELIMINA.OSPITE_NOTA}</p>}
                        <p className="mt-3 text-sm font-bold text-obsidian-primary">{ELIMINA.NON_SI_TORNA}</p>
                        <label htmlFor="elimina-parola" className="mt-4 block text-sm text-obsidian-secondary">{ELIMINA.ISTRUZIONE(PAROLA_ELIMINA)}</label>
                        <input id="elimina-parola" type="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={ELIMINA.CAMPO}
                            value={scritto} onChange={(e) => setScritto(e.target.value)} disabled={occupato}
                            className="mt-2 w-full min-h-[48px] px-4 rounded-xl bg-obsidian-raised border border-obsidian-border text-obsidian-primary text-[15px] placeholder:text-obsidian-secondary focus:outline-none" data-testid="elimina-account-parola" />
                        {errore && <p role="alert" className="mt-3 text-sm text-brand-orange" data-testid="elimina-account-errore">{errore}</p>}
                        <button type="submit" disabled={!confermaValida(scritto) || occupato} className="mt-4 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange text-obsidian-bg text-sm font-bold disabled:opacity-40 cursor-pointer" data-testid="elimina-account-conferma">
                            {occupato ? <><Loader className="w-4 h-4 animate-spin" aria-hidden="true" /><span>{ELIMINA.IN_CORSO}</span></> : ELIMINA.CONFERMA}
                        </button>
                        <button type="button" onClick={chiudi} disabled={occupato} className="mt-2 w-full min-h-[44px] rounded-xl text-sm font-bold text-obsidian-secondary cursor-pointer" data-testid="elimina-account-annulla">{ELIMINA.ANNULLA}</button>
                    </form>
                </div>
            )}
        </section>
    );
}
