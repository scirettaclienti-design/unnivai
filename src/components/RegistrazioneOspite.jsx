/**
 * OSPITE-GIRO — l'invito a creare l'account, uno solo in App. Si apre con `chiediRegistrazione(momento)` (evento
 * `dvai:registrati`) e solo per un ospite (account anonimo). Tre passi sullo STESSO account: email → codice di 6 cifre
 * (l'email della conferma) → password. Giro e DNA restano dove sono; alla fine il Profilo.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmailSchema, NuovaPasswordSchema, validateForm } from '../lib/validationSchemas';
import { erroreAuthItaliano } from '../lib/erroriAuth';
import {
    EVENTO_REGISTRATI, INVITO, TESTI_OSPITE, isOspite, mandaCodice, confermaEPassword, erroreRegistrazione, scegliPassword,
} from '../lib/ospite';

const CAMPO = 'w-full min-h-[48px] px-4 rounded-xl bg-obsidian-raised border border-obsidian-border text-obsidian-primary text-[15px] placeholder:text-obsidian-secondary focus:outline-none focus:border-brand-orange';
const PRIMARIO = 'w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange text-obsidian-bg text-sm font-bold disabled:opacity-60 cursor-pointer';

export default function RegistrazioneOspite() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [aperto, setAperto] = useState(null); // { momento, testo } | null
    const [passo, setPasso] = useState('email'); // email | codice | password | fatto
    const [email, setEmail] = useState('');
    const [codice, setCodice] = useState('');
    const [password, setPassword] = useState('');
    const [errore, setErrore] = useState(null);
    const [occupato, setOccupato] = useState(false);
    const ospite = isOspite(user);

    useEffect(() => {
        const apri = (e) => {
            setAperto({ momento: e.detail?.momento || 'secondo', testo: e.detail?.testo || null });
            setErrore(null);
        };
        window.addEventListener(EVENTO_REGISTRATI, apri);
        return () => window.removeEventListener(EVENTO_REGISTRATI, apri);
    }, []);

    // L'invito si apre solo per un ospite. Dopo il codice l'account non è più anonimo: i passi dopo (password, «Fatto») restano.
    if (!aperto || (!ospite && passo === 'email')) return null;

    const invito = INVITO[aperto.momento] || INVITO.secondo;
    const testo = aperto.momento === 'limite' && aperto.testo ? aperto.testo : invito.testo;
    const chiudi = () => { setAperto(null); if (passo === 'fatto') setPasso('email'); };

    const inviaEmail = async (e) => {
        e.preventDefault();
        setErrore(null);
        const v = validateForm(EmailSchema, { email });
        if (!v.ok) { setErrore(v.errors.email); return; }
        setOccupato(true);
        const { error } = await mandaCodice(email);
        setOccupato(false);
        if (error) { setErrore(erroreRegistrazione(error, erroreAuthItaliano)); return; }
        setPasso('codice');
    };

    const conferma = async (e) => {
        e.preventDefault();
        setErrore(null);
        if (!/^\d{6}$/.test(codice.trim())) { setErrore('Il codice ha 6 cifre.'); return; }
        const v = validateForm(NuovaPasswordSchema, { password });
        if (!v.ok) { setErrore(v.errors.password); return; }
        setOccupato(true);
        const r = await confermaEPassword(email, codice, password);
        setOccupato(false);
        if (r.error && r.passo === 'codice') { setErrore(erroreRegistrazione(r.error, erroreAuthItaliano)); return; }
        // L'email è confermata ma la password no: si rifà solo la password.
        if (r.error) { setErrore(erroreAuthItaliano(r.error)); setPasso('password'); return; }
        setPasso('fatto');
    };

    const soloPassword = async (e) => {
        e.preventDefault();
        setErrore(null);
        const v = validateForm(NuovaPasswordSchema, { password });
        if (!v.ok) { setErrore(v.errors.password); return; }
        setOccupato(true);
        const { error } = await scegliPassword(password);
        setOccupato(false);
        if (error) { setErrore(erroreAuthItaliano(error)); return; }
        setPasso('fatto');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center font-sans" role="dialog" aria-modal="true" aria-labelledby="registrazione-titolo" data-testid="registrazione-ospite" data-momento={aperto.momento}>
            <div className="absolute inset-0 bg-obsidian-bg/70" onClick={chiudi} />
            <div className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] bg-obsidian-card border border-obsidian-border px-5 pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                <div className="flex items-start justify-between gap-3">
                    <h2 id="registrazione-titolo" className="text-[22px] leading-tight font-bold text-obsidian-primary">
                        {passo === 'fatto' ? TESTI_OSPITE.FATTO : invito.titolo}
                    </h2>
                    <button type="button" onClick={chiudi} aria-label="Chiudi" className="w-11 h-11 shrink-0 rounded-full border border-obsidian-border bg-obsidian-raised text-obsidian-primary inline-flex items-center justify-center cursor-pointer">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {passo === 'email' && (
                    <form onSubmit={inviaEmail} noValidate className="mt-2 space-y-3">
                        {testo && <p className="text-sm text-obsidian-secondary leading-relaxed">{testo}</p>}
                        <input type="email" inputMode="email" autoComplete="email" placeholder="La tua email" aria-label="Email"
                            value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} data-testid="registrazione-email" />
                        {errore && <p role="alert" className="text-xs text-brand-orange">{errore}</p>}
                        <button type="submit" disabled={occupato} className={PRIMARIO} data-testid="registrazione-invia">
                            {occupato ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <><span>Mandami il codice</span><ArrowRight size={16} aria-hidden="true" /></>}
                        </button>
                    </form>
                )}

                {passo === 'codice' && (
                    <form onSubmit={conferma} noValidate className="mt-2 space-y-3">
                        <p className="text-sm text-obsidian-secondary leading-relaxed" data-testid="registrazione-inviata">{TESTI_OSPITE.EMAIL_INVIATA(email.trim())}</p>
                        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Codice di 6 cifre" aria-label="Codice"
                            value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))} className={`${CAMPO} tracking-[0.4em] font-mono`} data-testid="registrazione-codice" />
                        <input type="password" autoComplete="new-password" placeholder="Scegli una password" aria-label="Password"
                            value={password} onChange={(e) => setPassword(e.target.value)} className={CAMPO} data-testid="registrazione-password" />
                        <p className="text-xs text-obsidian-secondary">Almeno 8 caratteri, una maiuscola e un numero.</p>
                        {errore && <p role="alert" className="text-xs text-brand-orange">{errore}</p>}
                        <button type="submit" disabled={occupato} className={PRIMARIO} data-testid="registrazione-conferma">
                            {occupato ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <><span>Crea l'account</span><ArrowRight size={16} aria-hidden="true" /></>}
                        </button>
                        <button type="button" onClick={() => { setPasso('email'); setCodice(''); setErrore(null); }} className="w-full min-h-[44px] text-sm text-obsidian-secondary underline cursor-pointer">
                            Cambia email o fatti mandare un codice nuovo
                        </button>
                    </form>
                )}

                {passo === 'password' && (
                    <form onSubmit={soloPassword} noValidate className="mt-2 space-y-3">
                        <p className="text-sm text-obsidian-secondary leading-relaxed">L'email è confermata. Manca la password.</p>
                        <input type="password" autoComplete="new-password" placeholder="Scegli una password" aria-label="Password"
                            value={password} onChange={(e) => setPassword(e.target.value)} className={CAMPO} data-testid="registrazione-password" />
                        {errore && <p role="alert" className="text-xs text-brand-orange">{errore}</p>}
                        <button type="submit" disabled={occupato} className={PRIMARIO}>
                            {occupato ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <span>Salva la password</span>}
                        </button>
                    </form>
                )}

                {passo === 'fatto' && (
                    <div className="mt-2 space-y-3" data-testid="registrazione-fatta">
                        <p className="text-sm text-obsidian-secondary leading-relaxed">Giro e gusti sono sul tuo account. Entri con {email.trim()} e la tua password.</p>
                        <button type="button" onClick={() => { chiudi(); navigate('/profile'); }} className={PRIMARIO} data-testid="registrazione-profilo">
                            <span>Vai al Profilo</span><ArrowRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
