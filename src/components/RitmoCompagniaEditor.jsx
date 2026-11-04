import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Footprints } from 'lucide-react';
import { RITMI_PROFILO, COMPAGNIE_PROFILO } from '@/lib/foodPrefs';
import { TESTI_RITMO_COMPAGNIA } from '@/lib/dnaDelGiro';

// DNA-5 — ritmo e compagnia, impostati dal Profilo. Sono la fonte principale: vincono su cio' che il DNA impara dai giri
// (ritmo) e dalle scelte passate (compagnia). «Lo impara Unnivai» = nessuna impostazione: decide il DNA. Salvataggio col
// percorso del primo accesso (useAILearning.saveFoodPrefs, stesso seme di dieta e stile): un errore si mostra.

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


export default function RitmoCompagniaEditor({ value, onSave, toast }) {
    const [ritmo, setRitmo] = useState(value?.ritmo || null);
    const [compagnia, setCompagnia] = useState(value?.compagnia || null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setRitmo(value?.ritmo || null);
        setCompagnia(value?.compagnia || null);
    }, [value]);

    const save = async () => {
        setSaving(true);
        const r = await onSave({ ritmo, compagnia });
        setSaving(false);
        if (r?.success) toast?.({ title: TESTI_RITMO_COMPAGNIA.salvato, type: 'success' });
        else toast?.({ title: TESTI_RITMO_COMPAGNIA.errore, description: r?.error || 'Riprova tra un momento.', type: 'error' });
    };

    return (
        <motion.div
            data-ritmo-compagnia
            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-sm space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
        >
            <h3 className="font-bold text-obsidian-primary text-sm flex items-center gap-2">
                <Footprints className="w-4 h-4 text-obsidian-secondary" /> {TESTI_RITMO_COMPAGNIA.titolo}
            </h3>

            <div>
                <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">{TESTI_RITMO_COMPAGNIA.ritmo}</p>
                <div className="flex flex-wrap gap-2">
                    <Pill selected={!ritmo} onClick={() => setRitmo(null)}>{TESTI_RITMO_COMPAGNIA.impara}</Pill>
                    {Object.entries(RITMI_PROFILO).map(([id, label]) => (
                        <Pill key={id} selected={ritmo === id} onClick={() => setRitmo(id)}>{label}</Pill>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-xs font-bold text-obsidian-secondary uppercase tracking-wider mb-2">{TESTI_RITMO_COMPAGNIA.compagnia}</p>
                <div className="flex flex-wrap gap-2">
                    <Pill selected={!compagnia} onClick={() => setCompagnia(null)}>{TESTI_RITMO_COMPAGNIA.impara}</Pill>
                    {Object.entries(COMPAGNIE_PROFILO).map(([id, label]) => (
                        <Pill key={id} selected={compagnia === id} onClick={() => setCompagnia(id)}>{label}</Pill>
                    ))}
                </div>
            </div>

            <p className="text-xs text-obsidian-secondary">{TESTI_RITMO_COMPAGNIA.nota}</p>

            <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-label={TESTI_RITMO_COMPAGNIA.salva}
                className="w-full bg-obsidian-raised hover:bg-obsidian-border border border-obsidian-border text-obsidian-primary py-3 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
            >
                {saving ? 'Salvataggio…' : 'Salva'}
            </button>
        </motion.div>
    );
}
