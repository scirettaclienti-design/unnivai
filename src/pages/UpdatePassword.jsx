import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { NuovaPasswordSchema, validateForm } from '../lib/validationSchemas';
import { erroreAuthItaliano } from '../lib/erroriAuth';

export default function UpdatePassword() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isPasswordRecovery, fineRecupero } = useAuth();

    // ACCESSO-1: la pagina si apre solo con una sessione di recupero valida (il link
    // della mail). Senza, si torna a «password dimenticata» con un messaggio chiaro.
    if (!isPasswordRecovery) return <Navigate to="/login?recupero=1" replace />;

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError(null);

        // Stesse regole della registrazione (8 caratteri, maiuscola, numero).
        const validation = validateForm(NuovaPasswordSchema, { password });
        if (!validation.ok) {
            setError(validation.errors.password);
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast({ title: 'Password aggiornata.', type: 'success' });
            fineRecupero?.();
            navigate('/', { replace: true });
        } catch (err) {
            setError(erroreAuthItaliano(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100"
            >
                <div className="text-center mb-6">
                    <div className="mx-auto h-16 w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Nuova Password</h2>
                    <p className="text-gray-500">Almeno 8 caratteri, una maiuscola e un numero.</p>
                </div>

                <form onSubmit={handleUpdate} noValidate className="space-y-4">
                    <div className="relative group">
                        <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input
                            type="password"
                            placeholder="Nuova Password"
                            aria-label="Nuova password"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <p role="alert" className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Aggiornamento...' : 'Salva Password'}
                        <ArrowRight size={18} />
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
