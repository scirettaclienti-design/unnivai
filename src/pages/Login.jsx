/**
 * ONBOARDING-ACCESSO — l'accesso: email → codice di 6 cifre → dentro. Niente password: se l'account non c'è lo crea
 * Supabase (lib/accessoCodice.js), e il primo ingresso lo decide RootDispatcher (Login va sempre a '/').
 * Chi ha già una password la può ancora usare («Hai una password? Accedi →»): nessun account bloccato.
 * `?recupero=1` (link per la password scaduto, ACCESSO-1) e `?link=scaduto` (link di conferma o accesso, LINK-DOMINIO): si entra col codice.
 *
 * Grafica del marchio (logo, curve di livello, etichette in mono, Bricolage nei titoli) sul fondo scuro dell'app.
 * Prima: «Scegli come vivere l'esperienza» con un solo ruolo, poi registrazione con password e link di conferma.
 * Testi in lib/testiAccount.js (ACCESSO), errori di Supabase in lib/erroriAuth.js.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LoginSchema, EmailSchema, validateForm } from '../lib/validationSchemas';
import { erroreAuthItaliano } from '../lib/erroriAuth';
import { mandaCodiceAccesso, entraConCodice, erroreCodice, codiceValido, pulisciCodice, ATTESA_RIMANDO_S } from '../lib/accessoCodice';
import { ACCESSO as T } from '../lib/testiAccount';
import ProvaSenzaAccount from '../components/ProvaSenzaAccount';
import LinkLegali from '../components/LinkLegali';
import { LogoUnnivai, FondoMarchio, EtichettaPasso } from '../components/marchio/Marchio';

const CAMPO = 'w-full min-h-[52px] rounded-2xl bg-obsidian-card/90 border px-4 text-[16px] text-obsidian-primary placeholder:text-obsidian-secondary/80 focus:outline-none focus:border-brand-orange transition-colors';
const PRIMARIO = 'w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-semibold text-[15px] shadow-lg shadow-brand-orange/20 disabled:opacity-60 cursor-pointer transition-colors';
const SECONDARIO = 'min-h-[44px] text-[13px] font-semibold text-obsidian-secondary hover:text-obsidian-primary cursor-pointer disabled:opacity-50';

const Errore = ({ children }) => (
    <div className="rounded-2xl border border-brand-orange/40 bg-obsidian-card/90 px-4 py-3" data-testid="accesso-errore">
        <p role="alert" className="text-[13px] font-semibold text-obsidian-primary">{children}</p>
    </div>
);
const ErroreCampo = ({ children }) => <p role="alert" className="text-[13px] leading-snug text-brand-orange pl-1">{children}</p>;
const Titolo = ({ etichetta, titolo, sotto }) => (
    <>
        <EtichettaPasso testo={etichetta} />
        <h1 className="font-marchio font-extrabold text-[34px] leading-[1.02] tracking-tight mt-3">{titolo}</h1>
        {sotto && <p className="mt-2 text-[15px] text-obsidian-secondary leading-relaxed">{sotto}</p>}
    </>
);
const Occupato = () => <><Loader className="w-4 h-4 animate-spin" aria-hidden="true" /><span>{T.OCCUPATO}</span></>;

export default function Login() {
    const [searchParams] = useSearchParams();
    const daRecupero = searchParams.get('recupero') === '1';
    // LINK-DOMINIO: link di conferma o di accesso non valido (linkEmail.js manda qui con ?link=scaduto): si entra col codice.
    const daLinkScaduto = searchParams.get('link') === 'scaduto';
    const [passo, setPasso] = useState('email'); // email | codice | password
    const [email, setEmail] = useState('');
    const [codice, setCodice] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(daRecupero || daLinkScaduto ? T.LINK_SCADUTO : null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [attesa, setAttesa] = useState(0); // secondi prima di poter chiedere un altro codice
    const [rimandato, setRimandato] = useState(false);
    const timer = useRef(null);

    const navigate = useNavigate();
    const { user, role } = useAuth();

    useEffect(() => {
        // Gate ROUTING: Login NON decide il primo ingresso. Va a `/` e decide RootDispatcher.
        if (user && role && role !== 'guest') navigate('/', { replace: true });
    }, [user, role, navigate]);

    useEffect(() => () => clearInterval(timer.current), []);
    const partiAttesa = () => {
        clearInterval(timer.current);
        setAttesa(ATTESA_RIMANDO_S);
        timer.current = setInterval(() => setAttesa((s) => { if (s <= 1) { clearInterval(timer.current); return 0; } return s - 1; }), 1000);
    };

    const pulisci = () => { setError(null); setFieldErrors({}); setRimandato(false); };
    const vaiA = (p) => { pulisci(); setPasso(p); };

    const chiediCodice = async (e) => {
        e?.preventDefault();
        pulisci();
        const v = validateForm(EmailSchema, { email });
        if (!v.ok) { setFieldErrors(v.errors); return; }
        setLoading(true);
        const { error: err } = await mandaCodiceAccesso(email);
        setLoading(false);
        if (err) { setError(erroreAuthItaliano(err)); return; }
        setCodice('');
        setPasso('codice');
        partiAttesa();
    };

    const rimanda = async () => {
        if (attesa > 0) return;
        pulisci();
        const { error: err } = await mandaCodiceAccesso(email);
        if (err) { setError(erroreAuthItaliano(err)); return; }
        setRimandato(true);
        partiAttesa();
    };

    const entra = async (e) => {
        e.preventDefault();
        pulisci();
        if (!codiceValido(codice)) { setFieldErrors({ codice: T.CODICE_CORTO }); return; }
        setLoading(true);
        const { error: err } = await entraConCodice(email, codice);
        setLoading(false);
        if (err) setError(erroreCodice(err));
        // con la sessione aperta, l'effetto qui sopra porta a '/'
    };

    const entraConPassword = async (e) => {
        e.preventDefault();
        pulisci();
        const v = validateForm(LoginSchema, { email, password });
        if (!v.ok) { setFieldErrors(v.errors); return; }
        setLoading(true);
        try {
            const { error: err } = await supabase.auth.signInWithPassword({ email, password });
            if (err) throw err;
        } catch (err) {
            setError(erroreAuthItaliano(err));
        } finally {
            setLoading(false);
        }
    };

    const campoEmail = (
        <>
            <input type="email" inputMode="email" autoComplete="email" placeholder={T.EMAIL} aria-label={T.EMAIL} value={email} onChange={(e) => setEmail(e.target.value)}
                className={`${CAMPO} ${fieldErrors.email ? 'border-brand-orange/70' : 'border-obsidian-border'}`} />
            {fieldErrors.email && <ErroreCampo>{fieldErrors.email}</ErroreCampo>}
        </>
    );

    let corpo;
    if (passo === 'codice') {
        corpo = (
            <form onSubmit={entra} noValidate className="space-y-4" data-testid="accesso-codice">
                <div>
                    <Titolo etichetta={T.CODICE_ETICHETTA} titolo={T.CODICE_TITOLO} sotto={T.CODICE_TESTO(email.trim())} />
                    <p className="mt-2 text-[13px] text-obsidian-secondary leading-relaxed">{T.CODICE_NOTA}</p>
                </div>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={12} placeholder={T.CODICE} aria-label={T.CODICE} value={codice}
                    onChange={(e) => setCodice(pulisciCodice(e.target.value))} data-testid="accesso-codice-campo"
                    className={`${CAMPO} font-etichetta text-[22px] tracking-[0.35em] placeholder:text-[15px] placeholder:tracking-normal placeholder:font-corpo ${fieldErrors.codice ? 'border-brand-orange/70' : 'border-obsidian-border'}`} />
                {fieldErrors.codice && <ErroreCampo>{fieldErrors.codice}</ErroreCampo>}
                {error && <Errore>{error}</Errore>}
                {rimandato && !error && <p role="status" className="text-[13px] text-obsidian-secondary pl-1">{T.RIMANDATO}</p>}
                <button type="submit" disabled={loading} className={PRIMARIO} data-testid="accesso-invia">
                    {loading ? <Occupato /> : <><span>{T.ENTRA}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                </button>
                <div className="flex items-center justify-between">
                    <button type="button" onClick={rimanda} disabled={attesa > 0} className={SECONDARIO} data-testid="accesso-rimanda">{attesa > 0 ? T.RIMANDA_TRA(attesa) : T.RIMANDA}</button>
                    <button type="button" onClick={() => vaiA('email')} className={SECONDARIO}>{T.CAMBIA_EMAIL}</button>
                </div>
            </form>
        );
    } else if (passo === 'password') {
        corpo = (
            <form onSubmit={entraConPassword} noValidate className="space-y-3">
                <div className="mb-2"><Titolo etichetta={T.PASSWORD_ETICHETTA} titolo={T.PASSWORD_TITOLO} sotto={T.PASSWORD_SOTTO} /></div>
                {campoEmail}
                <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder={T.PASSWORD} aria-label={T.PASSWORD} autoComplete="current-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} className={`${CAMPO} pr-12 ${fieldErrors.password ? 'border-brand-orange/70' : 'border-obsidian-border'}`} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? T.NASCONDI_PASSWORD : T.MOSTRA_PASSWORD}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-obsidian-secondary hover:text-obsidian-primary cursor-pointer">
                        {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>
                {fieldErrors.password && <ErroreCampo>{fieldErrors.password}</ErroreCampo>}
                {error && <Errore>{error}</Errore>}
                <button type="submit" disabled={loading} className={`${PRIMARIO} !mt-5`} data-testid="accesso-invia">
                    {loading ? <Occupato /> : <><span>{T.INVIA_PASSWORD}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                </button>
                <div className="flex flex-col items-center">
                    <button type="button" onClick={() => vaiA('email')} className={SECONDARIO} data-testid="accesso-dimenticata">{T.DIMENTICATA}</button>
                </div>
            </form>
        );
    } else {
        corpo = (
            <>
                <Titolo etichetta={T.ETICHETTA} titolo={T.TITOLO} sotto={T.SOTTO} />
                <form onSubmit={chiediCodice} noValidate className="mt-6 space-y-3">
                    {campoEmail}
                    {error && <Errore>{error}</Errore>}
                    <button type="submit" disabled={loading} className={`${PRIMARIO} !mt-4`} data-testid="accesso-invia">
                        {loading ? <Occupato /> : <><span>{T.INVIA}</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
                    </button>
                </form>
                <div className="mt-2 text-center">
                    <button type="button" onClick={() => vaiA('password')} className={SECONDARIO} data-testid="accesso-con-password">{T.HAI_PASSWORD}</button>
                </div>
                {/* OSPITE-GIRO: un giro completo senza account; l'account si propone dopo */}
                <div className="mt-3 flex items-center gap-3 text-[11px] font-etichetta uppercase tracking-[0.2em] text-obsidian-secondary" aria-hidden="true">
                    <span className="h-px flex-1 bg-obsidian-border" />{T.OPPURE}<span className="h-px flex-1 bg-obsidian-border" />
                </div>
                <ProvaSenzaAccount className="mt-4" />
            </>
        );
    }

    return (
        <div className="min-h-svh bg-obsidian-bg text-obsidian-primary font-corpo relative overflow-x-hidden flex flex-col">
            <FondoMarchio vivo />
            <header className="relative z-10 w-full max-w-md mx-auto px-6 pt-6">
                <a href="/" aria-label={T.MARCHIO} className="inline-flex min-h-[44px] items-center"><LogoUnnivai className="h-8 w-auto" animato /></a>
            </header>
            <main className="relative z-10 w-full max-w-md mx-auto px-6 pt-6 pb-6 flex-1">{corpo}</main>
            {/* ACCOUNT-PRIVACY — privacy e termini: pubbliche, visibili in ogni vista del login */}
            <LinkLegali className="relative z-10 pb-6" />
        </div>
    );
}
