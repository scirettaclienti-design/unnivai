
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Flag, Store, ArrowRight, User, Mail, Lock, Briefcase, CheckCircle, Compass, ChevronLeft, Sparkles, Star } from 'lucide-react';

const ROLES = [
    {
        id: 'tourist',
        icon: MapPin,
        emoji: '🧭',
        title: 'Voglio Esplorare',
        subtitle: 'Viaggiatore',
        desc: 'Scopri tour unici creati da locali, vivi la città come mai prima d\'ora e lasciati guidare dall\'AI.',
        gradient: 'from-emerald-500 to-teal-600',
        glow: 'shadow-emerald-500/25',
        border: 'border-emerald-500/40',
        bg: 'from-emerald-500/10 to-teal-600/5',
        ring: 'ring-emerald-500/30',
        accent: '#10b981',
        perks: ['Itinerari AI personalizzati', 'Guide locali verificate', 'Mappa interattiva live'],
    },
    {
        id: 'guide',
        icon: Flag,
        emoji: '🏛️',
        title: 'Sono una Guida',
        subtitle: 'Local Expert',
        desc: 'Trasforma la tua conoscenza in guadagno. Crea itinerari, gestisci tour e fatti conoscere da migliaia di viaggiatori.',
        gradient: 'from-orange-500 to-amber-600',
        glow: 'shadow-orange-500/25',
        border: 'border-orange-500/40',
        bg: 'from-orange-500/10 to-amber-600/5',
        ring: 'ring-orange-500/30',
        accent: '#f97316',
        perks: ['Dashboard guida completa', 'Richieste live in tempo reale', 'Pagamenti integrati'],
    },
    {
        id: 'business',
        icon: Store,
        emoji: '🏪',
        title: 'Ho un\'Attività',
        subtitle: 'Business Partner',
        desc: 'Attira nuovi clienti diventando tappa ufficiale dei tour DoveVai. Aumenta la visibilità del tuo locale.',
        gradient: 'from-blue-500 to-indigo-600',
        glow: 'shadow-blue-500/25',
        border: 'border-blue-500/40',
        bg: 'from-blue-500/10 to-indigo-600/5',
        ring: 'ring-blue-500/30',
        accent: '#3b82f6',
        perks: ['Profilo business premium', 'Visibilità su tutti i tour', 'Statistiche e analytics'],
    },
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
    const [emailSent, setEmailSent] = useState(false);
    const [resetMode, setResetMode] = useState(false);

    const navigate = useNavigate();
    const { refreshRole, user, role, resetPassword } = useAuth();

    React.useEffect(() => {
        if (user && role && role !== 'guest') {
            const dest = role === 'guide' ? '/dashboard-guide' :
                role === 'business' ? '/dashboard-business' : '/dashboard-user';
            navigate(dest, { replace: true });
        }
    }, [user, role, navigate]);

    const currentRole = ROLES.find(r => r.id === selectedRole);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setEmailSent(false);
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
                if (user && !user.identities?.length) throw new Error('Email già registrata. Prova ad accedere.');
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
        <div className="min-h-screen bg-gray-950 text-white overflow-hidden font-sans relative flex flex-col">

            {/* Background gradient blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30 group-hover:scale-105 transition-transform">
                        <Compass className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">DOVEVAI</span>
                </Link>
                {selectedRole && (
                    <button
                        onClick={() => { setSelectedRole(null); setError(null); setEmailSent(false); setResetMode(false); }}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" /> Cambia ruolo
                    </button>
                )}
            </nav>

            {/* Main content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">

                <AnimatePresence mode="wait">
                    {/* ===== ROLE SELECTION ===== */}
                    {!selectedRole ? (
                        <motion.div
                            key="role-select"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="w-full max-w-5xl"
                        >
                            {/* Header */}
                            <div className="text-center mb-12">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-widest uppercase text-orange-400 mb-6"
                                >
                                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                                    DoveVai Network
                                </motion.div>
                                <motion.h1
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="text-4xl md:text-6xl font-bold mb-4 leading-tight tracking-tight"
                                >
                                    Scegli come vivere
                                    <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500">
                                        l'esperienza.
                                    </span>
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.25 }}
                                    className="text-white/50 text-base max-w-xl mx-auto"
                                >
                                    Unisciti alla piattaforma che connette chi esplora con chi conosce davvero il territorio.
                                </motion.p>
                            </div>

                            {/* Role cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {ROLES.map((r, i) => {
                                    const Icon = r.icon;
                                    return (
                                        <motion.div
                                            key={r.id}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + i * 0.1 }}
                                            whileHover={{ y: -6, scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { setSelectedRole(r.id); setError(null); setEmailSent(false); }}
                                            className={`cursor-pointer relative bg-gradient-to-b ${r.bg} border ${r.border} rounded-3xl p-7 flex flex-col group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:${r.glow}`}
                                        >
                                            {/* Subtle top glare */}
                                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                            {/* Emoji + Icon */}
                                            <div className="flex items-start justify-between mb-6">
                                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${r.gradient} flex items-center justify-center shadow-lg`}>
                                                    <Icon className="w-7 h-7 text-white" />
                                                </div>
                                                <span className="text-3xl">{r.emoji}</span>
                                            </div>

                                            {/* Text */}
                                            <div className="mb-5">
                                                <span className={`text-xs font-bold uppercase tracking-widest bg-gradient-to-r ${r.gradient} bg-clip-text text-transparent`}>
                                                    {r.subtitle}
                                                </span>
                                                <h3 className="text-xl font-bold text-white mt-1 mb-2">{r.title}</h3>
                                                <p className="text-sm text-white/50 leading-relaxed">{r.desc}</p>
                                            </div>

                                            {/* Perks */}
                                            <div className="space-y-1.5 mt-auto mb-6">
                                                {r.perks.map((perk, j) => (
                                                    <div key={j} className="flex items-center gap-2">
                                                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: r.accent }} />
                                                        <span className="text-xs text-white/60">{perk}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* CTA */}
                                            <div className={`flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r ${r.gradient} font-bold text-sm text-white shadow-lg group-hover:shadow-xl transition-all`}>
                                                Scegli questo ruolo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Already have account */}
                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                                className="text-center text-white/40 text-sm mt-8"
                            >
                                Hai già un account?{' '}
                                <button
                                    onClick={() => { setSelectedRole('tourist'); setAuthMode('login'); }}
                                    className="text-orange-400 font-bold hover:text-orange-300 transition-colors"
                                >
                                    Accedi →
                                </button>
                            </motion.p>
                        </motion.div>
                    ) : (
                        /* ===== AUTH FORM ===== */
                        <motion.div
                            key="auth-form"
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -24 }}
                            transition={{ duration: 0.4 }}
                            className="w-full max-w-md"
                        >
                            {/* Role badge */}
                            {currentRole && (
                                <div className="flex justify-center mb-6">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${currentRole.gradient} shadow-lg`}>
                                        <currentRole.icon className="w-4 h-4 text-white" />
                                        <span className="text-white font-bold text-sm">{currentRole.title}</span>
                                    </div>
                                </div>
                            )}

                            {/* Card */}
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

                                {resetMode ? (
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Recupera Password</h2>
                                        <p className="text-white/50 text-sm mb-6">Inserisci la tua email per ricevere il link di ripristino.</p>
                                        {emailSent ? (
                                            <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl text-green-400 text-sm text-center">
                                                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                                                Email inviata! Controlla la tua casella.
                                                <button onClick={() => { setResetMode(false); setEmailSent(false); }} className="block mt-3 font-bold underline text-white/70 hover:text-white mx-auto">
                                                    Torna al Login
                                                </button>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleResetPassword} className="space-y-4">
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                                    <input type="email" placeholder="La tua email" value={email}
                                                        onChange={e => setEmail(e.target.value)} required
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" />
                                                </div>
                                                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">{error}</p>}
                                                <button type="submit" disabled={loading}
                                                    className="w-full py-3.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white font-bold transition-all">
                                                    {loading ? 'Invio...' : 'Invia Link di Reset'}
                                                </button>
                                                <button type="button" onClick={() => setResetMode(false)} className="w-full text-white/40 text-sm hover:text-white/70 transition-colors">
                                                    Annulla
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                ) : emailSent ? (
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Mail className="w-8 h-8 text-green-400" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Controlla la tua Email!</h2>
                                        <p className="text-white/50 text-sm mb-6 leading-relaxed">
                                            Ti abbiamo inviato un link di conferma a <span className="font-bold text-white">{email}</span>.
                                            Clicca sul link per attivare il tuo account.
                                        </p>
                                        <button onClick={() => { setEmailSent(false); setAuthMode('login'); }}
                                            className="text-orange-400 font-bold hover:text-orange-300 transition-colors text-sm">
                                            Torna al Login →
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tab switcher */}
                                        <div className="flex bg-white/5 rounded-2xl p-1 mb-7">
                                            {['signup', 'login'].map(mode => (
                                                <button key={mode} onClick={() => { setAuthMode(mode); setError(null); }}
                                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMode === mode
                                                        ? 'bg-white/10 text-white shadow'
                                                        : 'text-white/40 hover:text-white/70'}`}>
                                                    {mode === 'signup' ? 'Registrati' : 'Accedi'}
                                                </button>
                                            ))}
                                        </div>

                                        <form onSubmit={handleAuth} className="space-y-3.5">
                                            {authMode === 'signup' && (
                                                <div className="relative">
                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                                    <input type="text" placeholder="Nome Completo" value={fullName}
                                                        onChange={e => setFullName(e.target.value)} required
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" />
                                                </div>
                                            )}
                                            {authMode === 'signup' && selectedRole === 'business' && (
                                                <div className="relative">
                                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                                    <input type="text" placeholder="Nome Attività" value={businessName}
                                                        onChange={e => setBusinessName(e.target.value)} required
                                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm" />
                                                </div>
                                            )}
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                                <input type="email" placeholder="Email" value={email}
                                                    onChange={e => setEmail(e.target.value)} required
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" />
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                                <input type="password" placeholder="Password" value={password}
                                                    onChange={e => setPassword(e.target.value)} required
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" />
                                            </div>

                                            {authMode === 'login' && (
                                                <div className="text-right">
                                                    <button type="button" onClick={() => setResetMode(true)}
                                                        className="text-xs text-orange-400 font-semibold hover:text-orange-300 transition-colors">
                                                        Password dimenticata?
                                                    </button>
                                                </div>
                                            )}

                                            {error && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                    className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-center">
                                                    {error}
                                                </motion.div>
                                            )}

                                            <motion.button
                                                type="submit"
                                                disabled={loading}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className={`w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2 text-sm bg-gradient-to-r ${currentRole?.gradient || 'from-orange-500 to-amber-600'} disabled:opacity-60`}
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

                            {/* Social proof */}
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                                className="flex items-center justify-center gap-3 mt-5">
                                <div className="flex -space-x-1.5">
                                    {['https://randomuser.me/api/portraits/women/44.jpg', 'https://randomuser.me/api/portraits/men/32.jpg',
                                        'https://randomuser.me/api/portraits/women/68.jpg'].map((src, i) => (
                                            <img key={i} src={src} alt="" className="w-6 h-6 rounded-full border border-gray-950 object-cover" />
                                        ))}
                                </div>
                                <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => <Star key={i} className="w-2.5 h-2.5 text-amber-400 fill-current" />)}
                                </div>
                                <span className="text-white/30 text-xs">+2.800 utenti attivi</span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Login;
