import { useEffect, useState } from 'react';
import { DIETE, STILI } from '@/lib/foodPrefs';
import { TESTI_DNA_PROFILO as T } from '@/lib/dnaDelGiro';
import { SchedaProfilo, DomandaProfilo, PillolaProfilo, TastoSalva } from '@/components/profilo/SchedaProfilo';

// P7b — le stesse scelte del primo accesso, modificabili dal Profilo:
// dieta (scelta multipla), budget a pasto, stile a tavola. Dieta e budget sono
// vincoli (filtri di codice), lo stile e' un gusto (una spinta). Salvataggio
// col percorso del primo accesso (useAILearning.saveFoodPrefs): un errore si
// mostra, non si nasconde.
const BUDGETS = ['€', '€€', '€€€'];

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

    const dietaSalvata = value?.dieta || [];
    const modificato = dieta.length !== dietaSalvata.length || !dieta.every(d => dietaSalvata.includes(d))
        || budget !== (value?.budget || null) || stile !== (value?.stile || null);

    return (
        <SchedaProfilo data-food-prefs titolo={T.tavolaTitolo} sotto={T.tavolaSotto}>
            <DomandaProfilo testo="Cosa non mangi?">
                <PillolaProfilo selected={dieta.length === 0} onClick={() => setDieta([])}>Nessuna restrizione</PillolaProfilo>
                {Object.entries(DIETE).map(([id, d]) => (
                    <PillolaProfilo key={id} selected={dieta.includes(id)} onClick={() => toggleDieta(id)}>{d.label}</PillolaProfilo>
                ))}
            </DomandaProfilo>

            <DomandaProfilo testo="Quanto vuoi spendere a pasto?">
                {BUDGETS.map(b => (
                    <PillolaProfilo key={b} selected={budget === b} onClick={() => setBudget(budget === b ? null : b)}>{b}</PillolaProfilo>
                ))}
            </DomandaProfilo>

            <DomandaProfilo testo="Che stile a tavola?">
                {Object.entries(STILI).map(([id, st]) => (
                    <PillolaProfilo key={id} selected={stile === id} onClick={() => setStile(stile === id ? null : id)}>{st.label}</PillolaProfilo>
                ))}
            </DomandaProfilo>

            <TastoSalva modificato={modificato} salvando={saving} onClick={save} />
        </SchedaProfilo>
    );
}
