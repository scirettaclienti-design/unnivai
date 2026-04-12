import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../hooks/use-toast';

export default function UpdatePassword() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast({ title: 'Password aggiornata con successo!', type: 'success' });
            navigate('/login');
        } catch (err) {
            setError(err.message);
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
                    <p className="text-gray-500">Inserisci la tua nuova password</p>
                </div>

                <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="relative group">
                        <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input
                            type="password"
                            placeholder="Nuova Password"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

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
