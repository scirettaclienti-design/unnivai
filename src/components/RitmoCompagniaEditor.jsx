import { useEffect, useState } from 'react';
import { RITMI_PROFILO, COMPAGNIE_PROFILO } from '@/lib/foodPrefs';
import { TESTI_RITMO_COMPAGNIA } from '@/lib/dnaDelGiro';
import { SchedaProfilo, DomandaProfilo, PillolaProfilo, TastoSalva } from '@/components/profilo/SchedaProfilo';

// DNA-5 — ritmo e compagnia, impostati dal Profilo. Sono la fonte principale: vincono su cio' che il DNA impara dai giri
// (ritmo) e dalle scelte passate (compagnia). «Lo impara Unnivai» = nessuna impostazione: decide il DNA. Salvataggio col
// percorso del primo accesso (useAILearning.saveFoodPrefs, stesso seme di dieta e stile): un errore si mostra.

export default function RitmoCompagniaEditor({ value, onSave, toast }) {
    const [ritmo, setRitmo] = useState(value?.ritmo || null);
    const [compagnia, setCompagnia] = useState(value?.compagnia || null);
    const [saving, setSaving] = useState(false);
    // ONBOARDING-ACCESSO: quello detto al primo ingresso (se il Profilo non ha una scelta sua)
    const inizio = [
        !value?.ritmo && RITMI_PROFILO[value?.ritmoIniziale],
        !value?.compagnia && COMPAGNIE_PROFILO[value?.compagniaIniziale],
    ].filter(Boolean);

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

    const modificato = ritmo !== (value?.ritmo || null) || compagnia !== (value?.compagnia || null);

    return (
        <SchedaProfilo data-ritmo-compagnia titolo={TESTI_RITMO_COMPAGNIA.titolo} sotto={TESTI_RITMO_COMPAGNIA.sotto}>
            <DomandaProfilo testo={TESTI_RITMO_COMPAGNIA.ritmo}>
                <PillolaProfilo selected={!ritmo} onClick={() => setRitmo(null)}>{TESTI_RITMO_COMPAGNIA.impara}</PillolaProfilo>
                {Object.entries(RITMI_PROFILO).map(([id, label]) => (
                    <PillolaProfilo key={id} selected={ritmo === id} onClick={() => setRitmo(id)}>{label}</PillolaProfilo>
                ))}
            </DomandaProfilo>

            <DomandaProfilo testo={TESTI_RITMO_COMPAGNIA.compagnia}>
                <PillolaProfilo selected={!compagnia} onClick={() => setCompagnia(null)}>{TESTI_RITMO_COMPAGNIA.impara}</PillolaProfilo>
                {Object.entries(COMPAGNIE_PROFILO).map(([id, label]) => (
                    <PillolaProfilo key={id} selected={compagnia === id} onClick={() => setCompagnia(id)}>{label}</PillolaProfilo>
                ))}
            </DomandaProfilo>

            {inizio.length > 0 && (
                <p className="text-xs text-obsidian-secondary" data-testid="come-giri-inizio">{TESTI_RITMO_COMPAGNIA.inizio(inizio)}</p>
            )}

            <TastoSalva modificato={modificato} salvando={saving} onClick={save} ariaLabel={TESTI_RITMO_COMPAGNIA.salva} />
        </SchedaProfilo>
    );
}
