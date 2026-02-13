
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Flag, Store, ArrowRight, User, Mail, Lock, Briefcase, CheckCircle } from 'lucide-react';

const Login = () => {
    const [selectedRole, setSelectedRole] = useState(null); // 'tourist', 'guide', 'business'
    const [authMode, setAuthMode] = useState('signup'); // 'login' or 'signup'

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [businessName, setBusinessName] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [emailSent, setEmailSent] = useState(false); // New state for email success

    const navigate = useNavigate();
    const { refreshRole, user, role } = useAuth();

    // ⚡️ Safety: Auto-Redirect if ALREADY logged in (or session restored)
    React.useEffect(() => {
        if (user && role && role !== 'guest') {
            const dest = role === 'guide' ? '/dashboard-guide' :
                role === 'business' ? '/dashboard-business' : '/dashboard-user';
            navigate(dest, { replace: true });
        }
    }, [user, role, navigate]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setEmailSent(false);

        try {
            if (authMode === 'login') {
                // LOGIN FLOW (Standard)
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                navigate('/dashboard-user'); // optimistic redirect to main dashboard
            } else {
                // SIGNUP FLOW (Email Verification)
                const { data: { user }, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/login`, // Redirect back to login after verify
                        data: {
                            full_name: fullName,
                            role: selectedRole === 'tourist' ? 'explorer' : selectedRole
                        }
                    }
                });

                if (signUpError) throw signUpError;

                // If signup successful but user is null or session is missing, it means email verify is on
                if (user && !user.identities?.length) {
                    throw new Error('Email già registrata. Prova ad accedere.');
                }

                // POST-REGISTER LOGIC (Pre-insert data if possible, though RLS might block unverified users depending on setup. 
                // Ideally, we trigger this AFTER verification, but for MVP we attempt insertion here or rely on triggers)

                // IMPORTANT: In a strict email-verify setup, these might fail if RLS requires active session.
                // We'll trust the trigger on 'auth.users' created in previous steps, 
                // OR we accept that the profile creation happens on first login via the AuthContext fallback.

                if (user) {
                    if (selectedRole === 'guide') {
                        // Attempt insert, might fail if RLS blocks unverified. 
                        // The 'profiles' trigger usually handles the basic entry.
                        // We will rely on the AuthContext fallback for robust profile creation on first login.
                        console.log('Guide registration initiated.');
                    } else if (selectedRole === 'business') {
                        // Business specific logic
                        await supabase.from('activities').insert({
                            owner_id: user.id,
                            name: businessName || `${fullName}'s Business`,
                            // Default location placeholder
                            location: 'POINT(12.4964 41.9028)'
                        }).catch(err => console.warn("Business profile creation pending verification", err));
                    }
                }

                // SHOW SUCCESS MESSAGE INSTEAD OF REDIRECT
                setEmailSent(true);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const GatewayCard = ({ role, icon: Icon, title, desc, color }) => (
        <motion.div
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSelectedRole(role); setError(null); setEmailSent(false); }}
            className={`cursor-pointer bg-white rounded-2xl shadow-lg border-2 p-8 flex flex-col items-center justify-center text-center transition-all h-72 w-full
                ${selectedRole === role ? `border-${color}-500 ring-4 ring-${color}-100 transform scale-105 shadow-2xl` : 'border-transparent hover:border-gray-200'}
                ${selectedRole && selectedRole !== role ? 'opacity-40 grayscale blur-[1px]' : 'opacity-100'}
            `}
        >
            <div className={`h-20 w-20 rounded-full bg-${color}-50 flex items-center justify-center text-${color}-600 mb-6 shadow-sm`}>
                <Icon size={40} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">{desc}</p>
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">

            {/* Header */}
            {!selectedRole && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12 max-w-2xl"
                >
                    <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm mb-6 border border-gray-100">
                        <span className="h-2 w-2 rounded-full bg-orange-600 animate-pulse"></span>
                        <span className="text-xs font-bold tracking-widest uppercase text-gray-500">Unnivai Network</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-6 leading-tight">
                        Scegli come vivere <br />l'esperienza.
                    </h1>
                    <p className="text-gray-500 text-lg">
                        Unisciti alla piattaforma che connette chi esplora con chi conosce davvero il territorio.
                        Seleziona il tuo ruolo per iniziare.
                    </p>
                </motion.div>
            )}

            {/* The 3 Gateways */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl transition-all duration-500 ${selectedRole ? 'mb-8 scale-90' : 'mb-12'}`}>
                <GatewayCard
                    role="tourist"
                    icon={MapPin}
                    title="Voglio Esplorare"
                    desc="Scopri tour unici creati da locali, vivi la città come mai prima d'ora e lasciati guidare dall'AI."
                    color="green"
                />
                <GatewayCard
                    role="guide"
                    icon={Flag}
                    title="Sono una Guida"
                    desc="Trasforma la tua conoscenza in guadagno. Crea itinerari, gestisci tour e fatti conoscere da migliaia di viaggiatori."
                    color="orange"
                />
                <GatewayCard
                    role="business"
                    icon={Store}
                    title="Ho un'Attività"
                    desc="Attira nuovi clienti diventando tappa ufficiale dei tour Unnivai. Aumenta la visibilità del tuo locale."
                    color="blue"
                />
            </div>

            {/* Auth Form (Appears below) */}
            <AnimatePresence mode="wait">
                {selectedRole && (
                    <motion.div
                        key="auth-form"
                        initial={{ opacity: 0, y: 20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 20, height: 0 }}
                        className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100 overflow-hidden"
                    >
                        {emailSent ? (
                            <div className="text-center py-8">
                                <div className="mx-auto h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                    <Mail size={40} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Controlla la tua Email!</h2>
                                <p className="text-gray-500 mb-6">
                                    Ti abbiamo inviato un link di conferma a <span className="font-bold text-gray-800">{email}</span>.
                                    Clicca sul link per attivare il tuo account e iniziare.
                                </p>
                                <button
                                    onClick={() => { setEmailSent(false); setAuthMode('login'); }}
                                    className="text-orange-600 font-bold hover:underline"
                                >
                                    Torna al Login
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        {authMode === 'login' ? 'Bentornato' : 'Crea il tuo Account'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Accesso come <span className="font-bold uppercase tracking-wider text-orange-600">{selectedRole === 'tourist' ? 'Esploratore' : selectedRole}</span>
                                    </p>
                                </div>

                                <form onSubmit={handleAuth} className="space-y-4">
                                    {authMode === 'signup' && (
                                        <div className="relative group">
                                            <User className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Nome Completo"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    {authMode === 'signup' && selectedRole === 'business' && (
                                        <div className="relative group">
                                            <Briefcase className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Nome della tua Attività"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                                value={businessName}
                                                onChange={(e) => setBusinessName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="text-red-500 text-sm bg-red-50 p-3 rounded-lg text-center flex items-center justify-center gap-2"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            {error}
                                        </motion.div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full py-4 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2
                                            ${selectedRole === 'guide' ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:to-amber-700' :
                                                selectedRole === 'business' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:to-indigo-700' :
                                                    'bg-gradient-to-r from-green-500 to-emerald-600 hover:to-emerald-700'}
                                        `}
                                    >
                                        {loading ? (
                                            <span className="animate-pulse">Elaborazione...</span>
                                        ) : (
                                            <>
                                                {authMode === 'login' ? 'Accedi Ora' : 'Registrati Gratuitamente'}
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-8 text-center pt-6 border-t border-gray-100">
                                    <button
                                        onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(null); }}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        {authMode === 'login' ? 'Non hai un account? ' : 'Hai già un account? '}
                                        <span className="font-bold underline Decoration-2 underline-offset-4 decoration-orange-200 hover:decoration-orange-500">
                                            {authMode === 'login' ? 'Registrati' : 'Accedi'}
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;
