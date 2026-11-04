/**
 * La password nuova, dal link «Reimposta la password» (ACCESSO-1). ONBOARDING-ACCESSO: l'accesso ora è con email e
 * codice, quindi qui arriva solo chi apre un link per la password (vecchio o chiesto prima del cambio); la pagina ha la
 * grafica del marchio sul fondo scuro (prima: scheda bianca). Senza un link valido si torna all'accesso col codice.
 */
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { NuovaPasswordSchema, validateForm } from '../lib/validationSchemas';
import { erroreAuthItaliano } from '../lib/erroriAuth';
import { NUOVA_PASSWORD as T, ACCESSO } from '../lib/testiAccount';
import { LogoUnnivai, FondoMarchio, EtichettaPasso } from '../components/marchio/Marchio';

export default function UpdatePassword() {
    const [password, setPassword] = useState('');
    const [mostra, setMostra] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isPasswordRecovery, fineRecupero } = useAuth();

    // ACCESSO-1: solo con una sessione di recupero valida (il link della mail).
    if (!isPasswordRecovery) return <Navigate to="/login?recupero=1" replace />;

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError(null);
        const validation = validateForm(NuovaPasswordSchema, { password });
        if (!validation.ok) { setError(validation.errors.password); return; }
        setLoading(true);
        try {
            const { error: err } = await supabase.auth.updateUser({ password });
            if (err) throw err;
            toast({ title: T.SALVATA, type: 'success' });
            fineRecupero?.();
            navigate('/', { replace: true });
        } catch (err) {
            setError(erroreAuthItaliano(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-svh bg-obsidian-bg text-obsidian-primary font-corpo relative overflow-x-hidden flex flex-col">
            <FondoMarchio />
            <header className="relative z-10 w-full max-w-md mx-auto px-6 pt-6"><LogoUnnivai className="h-8 w-auto" /></header>
            <main className="relative z-10 w-full max-w-md mx-auto px-6 pt-6 pb-8 flex-1">
                <EtichettaPasso testo={T.ETICHETTA} />
                <h1 className="font-marchio font-extrabold text-[34px] leading-[1.02] tracking-tight mt-3">{T.TITOLO}</h1>
                <p className="mt-2 text-[15px] text-obsidian-secondary leading-relaxed">{T.TESTO}</p>
                <form onSubmit={handleUpdate} noValidate className="mt-6 space-y-4">
                    <div className="relative">
                        <input type={mostra ? 'text' : 'password'} placeholder={T.CAMPO} aria-label={T.CAMPO} autoComplete="new-password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full min-h-[52px] rounded-2xl bg-obsidian-card/90 border px-4 pr-12 text-[16px] text-obsidian-primary placeholder:text-obsidian-secondary/80 focus:outline-none focus:border-brand-orange ${error ? 'border-brand-orange/70' : 'border-obsidian-border'}`} />
                        <button type="button" onClick={() => setMostra((v) => !v)} aria-label={mostra ? ACCESSO.NASCONDI_PASSWORD : ACCESSO.MOSTRA_PASSWORD}
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-obsidian-secondary hover:text-obsidian-primary cursor-pointer">
                            {mostra ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                        </button>
                    </div>
                    {error && <p role="alert" className="text-[13px] leading-snug text-brand-orange pl-1">{error}</p>}
                    <button type="submit" disabled={loading} data-testid="accesso-invia"
                        className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-semibold text-[15px] shadow-lg shadow-brand-orange/20 disabled:opacity-60 cursor-pointer">
                        {loading ? <><Loader className="w-4 h-4 animate-spin" aria-hidden="true" /><span>{ACCESSO.OCCUPATO}</span></> : <><span>{T.SALVA}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                    </button>
                </form>
            </main>
        </div>
    );
}
