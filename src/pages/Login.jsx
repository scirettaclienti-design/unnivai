
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Flag, Store, ArrowRight, User, Mail, Lock, Briefcase, CheckCircle, Compass, ChevronLeft, Sparkles, Eye, EyeOff } from 'lucide-react';
import { LoginSchema, SignupSchema, validateForm } from '../lib/validationSchemas';

// Gate K — In V1 il selettore ruolo mostra SOLO "Viaggiatore".
// Le opzioni "Sono una Guida" e "Ho un'Attività" sono commentate ma restano nel
// file (torneranno in V2/V3 togliendo un commento). Un signup che porta a
// dashboard bloccate è una trappola — meglio non offrire la scelta.
const ROLES = [
    {
        id: 'tourist',
        icon: MapPin,
        title: 'Voglio Esplorare',
        subtitle: 'Viaggiatore',
        // Gate EE: copy V1 onesto. "Scopri tour unici creati da locali" +
        // perks V2 ("Guide locali verificate", "Mappa live") erano promesse
        // di feature V2/V3. V1 fa: itinerario AI in qualunque citta' scegli,
        // con luoghi veri Google Places e mappa vera. Solo cio' che V1 mantiene.
        desc: 'Ogni giorno l\'AI ti costruisce un percorso su misura in qualunque città italiana, con luoghi veri e orari veri.',
        perks: ['Itinerari AI personalizzati', 'Luoghi veri da Google Places', 'Mappa con coordinate reali'],
    },
    // Gate K: guide e business RIMOSSE dal selettore. V2/V3.
    // { id: 'guide', ... }
    // { id: 'business', ... }
];

const Login = () => {
    const [selectedRole, setSelectedRole] = useState(null);
    const [authMode, setAuthMode] = useState('signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [emailSent, setEmailSent] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();
    const { refreshRole, user, role, resetPassword } = useAuth();

    React.useEffect(() => {
        if (user && role && role !== 'guest') {
            // Gate ROUTING: Login NON decide l'onboarding. Redirige a `/` e lascia
            // decidere RootDispatcher (autorita' unica del gate onboarding). Prima
            // andava dritto a /dashboard-user, saltando il gate: chi confermava
            // l'email atterrava qui e finiva in dashboard senza mai vedere
            // l'onboarding. Condizione invariata (user && role && role !== 'guest'):
            // un non-autenticato o un guest non scatta → nessun ping-pong / ↔ /login.
            navigate('/', { replace: true });
        }
    }, [user, role, navigate]);

    const currentRole = ROLES.find(r => r.id === selectedRole);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        setEmailSent(false);

        // DVAI-019: Validazione Zod prima di chiamare Supabase
        const schema = authMode === 'login' ? LoginSchema : SignupSchema;
        const formPayload = authMode === 'login'
            ? { email, password }
            : { email, password, fullName, role: selectedRole, businessName };

        const validation = validateForm(schema, formPayload);
        if (!validation.ok) {
            setFieldErrors(validation.errors);
            // Mostra il primo errore generale
            const firstError = Object.values(validation.errors)[0];
            setError(firstError);
            return;
        }

        setLoading(true);
        try {
            if (authMode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { data: { user }, error: signUpError } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/login`,
                        data: { full_name: fullName, role: selectedRole === 'tourist' ? 'explorer' : selectedRole }
                    }
                });
                if (signUpError) throw signUpError;
                if (user && (!user.identities || user.identities.length === 0)) throw new Error('Email già registrata. Prova ad accedere.');
                if (user && selectedRole === 'business') {
                    await supabase.from('activities').insert({
                        owner_id: user.id,
                        name: businessName || `${fullName}'s Business`,
                        location: 'POINT(12.4964 41.9028)'
                    }).catch(() => { });
                }
                setEmailSent(true);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await resetPassword(email);
            if (error) throw error;
            setEmailSent(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-quicksand overflow-x-hidden flex flex-col justify-start relative selection:bg-brand-orange selection:text-obsidian-bg">
            {/* Top Navigation */}
            <nav className="relative z-10 flex items-center justify-between px-6 pt-5 pb-2 md:px-10 max-w-5xl mx-auto w-full">
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="w-9 h-9 bg-obsidian-card border border-obsidian-border rounded-xl flex items-center justify-center text-brand-orange shadow-sm group-hover:scale-105 transition-transform">
                        <Compass className="w-5 h-5 stroke-[1.75]" />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-obsidian-primary">DOVEVAI</span>
                </Link>
                {selectedRole && (
                    <button
                        onClick={() => { setSelectedRole(null); setError(null); setEmailSent(false); setResetMode(false); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary transition-colors text-xs font-bold cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" /> <span>Cambia ruolo</span>
                    </button>
                )}
            </nav>

            {/* Main content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 pt-1 pb-8 max-w-5xl mx-auto w-full">
                <AnimatePresence>
                    {/* ===== ROLE SELECTION ===== */}
                    {!selectedRole ? (
                        <motion.div
                            key="role-select"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="w-full max-w-md"
                        >
                            {/* Header */}
                            <div className="text-center mb-8">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-obsidian-raised border border-obsidian-border text-[11px] font-bold tracking-widest uppercase text-obsidian-secondary mb-4"
                                >
                                    <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
                                    DoveVai Network
                                </motion.div>
                                <motion.h1
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="text-3xl md:text-4xl font-extrabold mb-3 leading-tight tracking-tight text-obsidian-primary"
                                >
                                    Scegli come vivere
                                    <br />
                                    <span className="text-brand-orange">
                                        l'esperienza.
                                    </span>
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.25 }}
                                    className="text-obsidian-secondary text-sm leading-relaxed"
                                >
                                    Unisciti alla piattaforma che ti connette con i luoghi più autentici del territorio.
                                </motion.p>
                            </div>

                            {/* Role card */}
                            <div className="flex flex-col gap-4">
                                {ROLES.map((r, i) => {
                                    const Icon = r.icon;
                                    return (
                                        <motion.div
                                            key={r.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + i * 0.1 }}
                                            whileHover={{ y: -3 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { setSelectedRole(r.id); setError(null); setEmailSent(false); }}
                                            className="cursor-pointer bg-obsidian-card border border-obsidian-border hover:border-brand-orange/60 rounded-3xl p-6 sm:p-7 flex flex-col group transition-all duration-200 shadow-xl"
                                        >
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="w-13 h-13 rounded-2xl bg-obsidian-raised border border-obsidian-border flex items-center justify-center text-brand-orange shadow-sm group-hover:scale-105 transition-transform p-3">
                                                    <Icon className="w-6 h-6 stroke-[1.75]" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-obsidian-secondary bg-obsidian-raised border border-obsidian-border px-2.5 py-1 rounded-lg">
                                                    {r.subtitle}
                                                </span>
                                            </div>

                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-obsidian-primary mb-1.5">{r.title}</h3>
                                                <p className="text-sm text-obsidian-secondary leading-relaxed">{r.desc}</p>
                                            </div>

                                            {/* Perks */}
                                            <div className="space-y-2 mt-auto mb-6">
                                                {r.perks.map((perk, j) => (
                                                    <div key={j} className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 flex-shrink-0 text-brand-orange stroke-[1.75]" />
                                                        <span className="text-xs text-obsidian-secondary font-medium">{perk}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* CTA */}
                                            <div className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover font-bold text-sm text-obsidian-bg shadow-md shadow-brand-orange/20 transition-colors">
                                                <span>Scegli questo ruolo</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Already have account */}
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-center text-obsidian-secondary text-sm mt-7"
                            >
                                Hai già un account?{' '}
                                <button
                                    onClick={() => { setSelectedRole('tourist'); setAuthMode('login'); }}
                                    className="text-brand-orange font-bold hover:underline transition-colors cursor-pointer ml-1"
                                >
                                    Accedi →
                                </button>
                            </motion.p>
                        </motion.div>
                    ) : (
                        /* ===== AUTH FORM ===== */
                        <motion.div
                            key="auth-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="w-full max-w-md"
                        >
                            {/* Role badge */}
                            {currentRole && (
                                <div className="flex justify-center mb-3">
                                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-obsidian-card border border-obsidian-border text-obsidian-secondary text-xs font-bold">
                                        <currentRole.icon className="w-4 h-4 text-brand-orange stroke-[1.75]" />
                                        <span className="text-obsidian-primary">{currentRole.title}</span>
                                    </div>
                                </div>
                            )}

                            {/* Card */}
                            <div className="bg-obsidian-card border border-obsidian-border rounded-[28px] p-6 sm:p-8 shadow-2xl">
                                {resetMode ? (
                                    <div>
                                        <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Recupera Password</h2>
                                        <p className="text-obsidian-secondary text-sm mb-6">Inserisci la tua email per ricevere il link di ripristino.</p>
                                        {emailSent ? (
                                            <div className="bg-obsidian-raised border border-obsidian-border p-5 rounded-2xl text-center">
                                                <div className="w-12 h-12 rounded-xl bg-obsidian-card border border-obsidian-border flex items-center justify-center text-brand-orange mx-auto mb-3">
                                                    <CheckCircle className="w-6 h-6 stroke-[1.75]" />
                                                </div>
                                                <h3 className="text-base font-bold text-obsidian-primary mb-1">Email inviata!</h3>
                                                <p className="text-xs text-obsidian-secondary mb-4">Controlla la tua casella per completare il reset.</p>
                                                <button
                                                    onClick={() => { setResetMode(false); setEmailSent(false); }}
                                                    className="w-full py-3 px-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold text-xs transition-colors cursor-pointer"
                                                >
                                                    Torna al Login
                                                </button>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleResetPassword} className="space-y-4">
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-obsidian-secondary w-4 h-4 stroke-[1.75]" />
                                                    <input
                                                        type="email"
                                                        placeholder="La tua email"
                                                        value={email}
                                                        onChange={e => setEmail(e.target.value)}
                                                        required
                                                        className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl pl-11 pr-4 py-3.5 text-obsidian-primary placeholder:text-obsidian-secondary/50 focus:outline-none focus:border-brand-orange transition-all text-sm font-medium"
                                                    />
                                                </div>
                                                {error && (
                                                    <p className="text-brand-orange text-xs bg-obsidian-raised border border-brand-orange/40 px-4 py-2.5 rounded-xl font-bold text-center">
                                                        {error}
                                                    </p>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="w-full py-3.5 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {loading ? 'Invio in corso...' : 'Invia Link di Reset'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setResetMode(false)}
                                                    className="w-full text-obsidian-secondary hover:text-obsidian-primary text-xs font-medium transition-colors pt-2 block text-center cursor-pointer"
                                                >
                                                    Annulla
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                ) : emailSent ? (
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 bg-obsidian-raised border border-obsidian-border rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-orange">
                                            <Mail className="w-8 h-8 stroke-[1.75]" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-obsidian-primary mb-2">Controlla la tua Email!</h2>
                                        <p className="text-obsidian-secondary text-sm mb-6 leading-relaxed">
                                            Ti abbiamo inviato un link di conferma a <span className="font-bold text-obsidian-primary">{email}</span>.
                                            Clicca sul link per attivare il tuo account.
                                        </p>
                                        <button
                                            onClick={() => { setEmailSent(false); setAuthMode('login'); }}
                                            className="text-brand-orange font-bold hover:underline transition-colors text-sm cursor-pointer"
                                        >
                                            Torna al Login →
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tab switcher */}
                                        <div className="flex bg-obsidian-raised border border-obsidian-border rounded-2xl p-1 mb-6">
                                            {['signup', 'login'].map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => { setAuthMode(mode); setError(null); }}
                                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                                                        authMode === mode
                                                            ? 'bg-obsidian-card border border-obsidian-border text-obsidian-primary shadow-sm'
                                                            : 'text-obsidian-secondary hover:text-obsidian-primary'
                                                    }`}
                                                >
                                                    {mode === 'signup' ? 'Registrati' : 'Accedi'}
                                                </button>
                                            ))}
                                        </div>

                                        <form onSubmit={handleAuth} className="space-y-3.5">
                                            {authMode === 'signup' && (
                                                <div className="relative">
                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-obsidian-secondary w-4 h-4 stroke-[1.75]" />
                                                    <input
                                                        type="text"
                                                        placeholder="Nome Completo"
                                                        value={fullName}
                                                        onChange={e => setFullName(e.target.value)}
                                                        required
                                                        className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl pl-11 pr-4 py-3.5 text-obsidian-primary placeholder:text-obsidian-secondary/50 focus:outline-none focus:border-brand-orange transition-all text-sm font-medium"
                                                    />
                                                </div>
                                            )}
                                            {authMode === 'signup' && selectedRole === 'business' && (
                                                <div className="relative">
                                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-obsidian-secondary w-4 h-4 stroke-[1.75]" />
                                                    <input
                                                        type="text"
                                                        placeholder="Nome Attività"
                                                        value={businessName}
                                                        onChange={e => setBusinessName(e.target.value)}
                                                        required
                                                        className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl pl-11 pr-4 py-3.5 text-obsidian-primary placeholder:text-obsidian-secondary/50 focus:outline-none focus:border-brand-orange transition-all text-sm font-medium"
                                                    />
                                                </div>
                                            )}
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-obsidian-secondary w-4 h-4 stroke-[1.75]" />
                                                <input
                                                    type="email"
                                                    placeholder="Email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    required
                                                    className="w-full bg-obsidian-raised border border-obsidian-border rounded-xl pl-11 pr-4 py-3.5 text-obsidian-primary placeholder:text-obsidian-secondary/50 focus:outline-none focus:border-brand-orange transition-all text-sm font-medium"
                                                />
                                            </div>
                                            {/* Password field con show/hide + Zod validation */}
                                            <div className="space-y-1">
                                                <div className="relative">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-obsidian-secondary w-4 h-4 stroke-[1.75]" />
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        placeholder="Password"
                                                        value={password}
                                                        onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })); }}
                                                        required
                                                        className={`w-full bg-obsidian-raised border rounded-xl pl-11 pr-11 py-3.5 text-obsidian-primary placeholder:text-obsidian-secondary/50 focus:outline-none transition-all text-sm font-medium ${
                                                            fieldErrors.password
                                                                ? 'border-brand-orange/60 focus:border-brand-orange'
                                                                : 'border-obsidian-border focus:border-brand-orange'
                                                        }`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(v => !v)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-obsidian-secondary hover:text-obsidian-primary transition-colors cursor-pointer"
                                                        tabIndex={-1}
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4 stroke-[1.75]" /> : <Eye className="w-4 h-4 stroke-[1.75]" />}
                                                    </button>
                                                </div>
                                                {fieldErrors.password && (
                                                    <p className="text-brand-orange text-xs pl-1 font-medium">{fieldErrors.password}</p>
                                                )}
                                                {/* Indicatore forza password in signup */}
                                                {authMode === 'signup' && password.length > 0 && (
                                                    <div className="flex gap-1 mt-1.5 px-0.5">
                                                        {[
                                                            password.length >= 8,
                                                            /[A-Z]/.test(password),
                                                            /[0-9]/.test(password),
                                                            /[^A-Za-z0-9]/.test(password),
                                                        ].map((met, i) => (
                                                            <div
                                                                key={i}
                                                                className={`h-1 flex-1 rounded-full transition-colors ${met ? 'bg-brand-orange' : 'bg-obsidian-border'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {authMode === 'login' && (
                                                <div className="text-right pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setResetMode(true)}
                                                        className="text-xs text-obsidian-secondary hover:text-obsidian-primary font-medium transition-colors cursor-pointer"
                                                    >
                                                        Password dimenticata?
                                                    </button>
                                                </div>
                                            )}

                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-brand-orange text-xs bg-obsidian-raised border border-brand-orange/40 px-4 py-2.5 rounded-xl text-center font-bold"
                                                >
                                                    {error}
                                                </motion.div>
                                            )}

                                            <motion.button
                                                type="submit"
                                                disabled={loading}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="w-full py-4 bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                {loading ? (
                                                    <span className="animate-pulse">Elaborazione...</span>
                                                ) : (
                                                    <>
                                                        {authMode === 'login' ? 'Accedi Ora' : 'Registrati Gratuitamente'}
                                                        <ArrowRight className="w-4 h-4" />
                                                    </>
                                                )}
                                            </motion.button>
                                        </form>
                                    </>
                                )}
                            </div>

                            {/* Gate EE — Rimosso blocco social proof fake */}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Login;
