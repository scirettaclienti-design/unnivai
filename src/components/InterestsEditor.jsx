import { useEffect, useState } from 'react';
import { INTERESTS } from '@/lib/interests';
import { TESTI_DNA_PROFILO as T } from '@/lib/dnaDelGiro';
import { SchedaProfilo, PillolaProfilo, TastoSalva } from '@/components/profilo/SchedaProfilo';

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
        <SchedaProfilo data-interests titolo={T.interessiTitolo} sotto={T.interessiSotto}>
            <div className="flex flex-wrap gap-2">
                {INTERESTS.map(i => (
                    <PillolaProfilo key={i.id} selected={selected.includes(i.id)} onClick={() => toggle(i.id)}>{i.label}</PillolaProfilo>
                ))}
            </div>
            <TastoSalva
                modificato={!unchanged}
                salvando={saving}
                disabled={selected.length === 0}
                nota={selected.length === 0 && !unchanged ? T.interessiNessuno : null}
                onClick={save}
            />
        </SchedaProfilo>
    );
}
