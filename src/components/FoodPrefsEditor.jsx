import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';
import { DIETE, STILI } from '@/lib/foodPrefs';

// P7b — le stesse scelte del primo accesso, modificabili dal Profilo:
// dieta (scelta multipla), budget a pasto, stile a tavola. Dieta e budget sono
// vincoli (filtri di codice), lo stile e' un gusto (una spinta). Salvataggio
// col percorso del primo accesso (useAILearning.saveFoodPrefs): un errore si
// mostra, non si nasconde.
const BUDGETS = ['€', '€€', '€€€'];

const Pill = ({ selected, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            selected
                ? 'bg-obsidian-raised border-brand-orange ring-1 ring-brand-orange/40 text-obsidian-primary'
                : 'bg-obsidian-card border-obsidian-border text-obsidian-secondary hover:text-obsidian-primary hover:bg-obsidian-raised'
        }`}
    >
        {children}
    </button>
);

export default function FoodPrefsEditor({ value, onSave, toast }) {
    const [dieta, setDieta] = useState(value?.dieta || []);
    const [budget, setBudget] = useState(value?.budget || null);
    const [stile, setStile] = useState(value?.stile || null);
    const [saving, setSaving] = useState(false);

    // Il valore puo' arrivare dopo il mount (sync dal server): si riallinea.
    useEffect(() => {
        setDieta(value?.dieta || []);
        setBudget(value?.budget || null);
        setStile(value?.stile || null);
    }, [value]);

    const toggleDieta = (id) => setDieta(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));

    const save = async () => {
        setSaving(true);
        const r = await onSave({ dieta, budget, stile });
        setSaving(false);
        if (r?.success) toast?.({ title: 'Preferenze a tavola salvate', type: 'success' });
        else toast?.({ title: 'Non sono riuscito a salvarle', description: r?.error || 'Riprova tra un momento.', type: 'error' });
    };

    return (
        <motion.div
            data-food-prefs
            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
        >
            <h3 className="font-bold text-obsidian-primary text-sm flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-obsidian-secondary" /> A tavola
            </h3>

            <div>
                <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">Cosa non mangi?</p>
                <div className="flex flex-wrap gap-2">
                    <Pill selected={dieta.length === 0} onClick={() => setDieta([])}>Nessuna restrizione</Pill>
                    {Object.entries(DIETE).map(([id, d]) => (
                        <Pill key={id} selected={dieta.includes(id)} onClick={() => toggleDieta(id)}>{d.label}</Pill>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">Quanto vuoi spendere a pasto?</p>
                <div className="flex flex-wrap gap-2">
                    {BUDGETS.map(b => (
                        <Pill key={b} selected={budget === b} onClick={() => setBudget(budget === b ? null : b)}>{b}</Pill>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">Che stile a tavola?</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(STILI).map(([id, st]) => (
                        <Pill key={id} selected={stile === id} onClick={() => setStile(stile === id ? null : id)}>{st.label}</Pill>
                    ))}
                </div>
            </div>

            <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border text-obsidian-primary py-3 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
            >
                {saving ? 'Salvataggio…' : 'Salva'}
            </button>
        </motion.div>
    );
}
