import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { INTERESTS } from '@/lib/interests';

// ONB-1 — gli interessi scelti nell'onboarding, modificabili SOLO da qui.
// Salvataggio con useAILearning.saveInterests: aggiorna il seme sul DB e i pesi
// del DNA, non azzera il DNA. Un errore si mostra, non si nasconde.
export default function InterestsEditor({ value, onSave, toast }) {
    const [selected, setSelected] = useState(value || []);
    const [saving, setSaving] = useState(false);

    // Il valore puo' arrivare dopo il mount (sync dal server): si riallinea.
    useEffect(() => { setSelected(value || []); }, [value]);

    const toggle = (id) => setSelected(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
    const unchanged = selected.length === (value || []).length && selected.every(id => (value || []).includes(id));

    const save = async () => {
        setSaving(true);
        const r = await onSave(selected);
        setSaving(false);
        if (r?.success) toast?.({ title: 'Interessi salvati', type: 'success' });
        else toast?.({ title: 'Non sono riuscito a salvarli', description: r?.error || 'Riprova tra un momento.', type: 'error' });
    };

    return (
        <motion.div
            data-interests
            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
        >
            <h3 className="font-bold text-obsidian-primary text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-obsidian-secondary" /> I tuoi interessi
            </h3>
            <div className="flex flex-wrap gap-2">
                {INTERESTS.map(i => {
                    const on = selected.includes(i.id);
                    return (
                        <button
                            key={i.id}
                            type="button"
                            onClick={() => toggle(i.id)}
                            aria-pressed={on}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                                on
                                    ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 text-obsidian-primary'
                                    : 'bg-obsidian-card border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary hover:bg-obsidian-raised'
                            }`}
                        >
                            {i.label}
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={save}
                disabled={saving || unchanged || selected.length === 0}
                className="w-full bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border text-obsidian-primary py-3 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
            >
                {saving ? 'Salvataggio…' : 'Salva'}
            </button>
        </motion.div>
    );
}
