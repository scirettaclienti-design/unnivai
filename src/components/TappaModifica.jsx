import React, { useState } from 'react';

// GIRO-EDIT — i due tasti piccoli di ogni tappa: «Togli» e «Cambia». «Cambia» apre un campo («qualcosa di più tranquillo»,
// «un posto di street food») e sostituisce solo quella tappa. Discreti per non affollare la scheda: testo di 11px sul secondario,
// l'accento arancione solo sul tasto di conferma. Nessuna logica qui: chi usa il componente passa cosa fare.
export const SEGNAPOSTO_CAMBIA = 'es. qualcosa di più tranquillo';

export function TappaModifica({ nome, onTogli, onCambia, puoTogliere = true, className = '', etichettaCambia = 'Cambia' }) {
    const [aperto, setAperto] = useState(false);
    const [testo, setTesto] = useState('');
    const [lavora, setLavora] = useState(false);
    const [messaggio, setMessaggio] = useState(null);

    const cambia = async (e) => {
        e?.preventDefault?.();
        if (lavora) return;
        setLavora(true);
        setMessaggio(null);
        try {
            const esito = await onCambia(testo.trim());
            if (esito?.ok) { setAperto(false); setTesto(''); }
            else setMessaggio(esito?.messaggio || 'Non ho trovato niente di adatto qui vicino: la tappa resta.');
        } catch {
            setMessaggio('Non sono riuscito a cambiare la tappa: resta com\'è.');
        } finally {
            setLavora(false);
        }
    };

    const tasto = 'text-[11px] font-bold text-obsidian-secondary hover:text-obsidian-primary transition-colors cursor-pointer px-1.5 py-1 -my-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-60';

    return (
        <div data-tappa-modifica className={className}>
            <div className="flex items-center gap-1">
                {puoTogliere && (
                    <button type="button" data-tappa-togli aria-label={`Togli ${nome || 'la tappa'}`} onClick={onTogli} disabled={lavora} className={tasto}>
                        Togli
                    </button>
                )}
                <button type="button" data-tappa-cambia aria-expanded={aperto} aria-label={`Cambia ${nome || 'la tappa'}`} onClick={() => { setAperto(a => !a); setMessaggio(null); }} className={tasto}>
                    {etichettaCambia}
                </button>
            </div>
            {aperto && (
                <form data-cambia-form onSubmit={cambia} className="mt-2 flex items-center gap-2">
                    <input
                        data-cambia-input
                        type="text"
                        value={testo}
                        onChange={(e) => setTesto(e.target.value)}
                        placeholder={SEGNAPOSTO_CAMBIA}
                        maxLength={80}
                        aria-label="Cosa vuoi al posto di questa tappa"
                        disabled={lavora}
                        className="flex-1 min-w-0 bg-obsidian-raised border border-obsidian-border rounded-lg px-2.5 py-1.5 text-xs text-obsidian-primary placeholder:text-obsidian-secondary focus:outline-none focus:border-brand-orange"
                    />
                    <button type="submit" data-cambia-vai disabled={lavora} className="shrink-0 bg-brand-orange text-obsidian-bg text-[11px] font-bold rounded-lg px-3 py-1.5 disabled:opacity-60 cursor-pointer">
                        {lavora ? 'Cerco…' : 'Cerca'}
                    </button>
                </form>
            )}
            {messaggio && <p data-cambia-messaggio role="status" className="mt-1.5 text-[11px] text-obsidian-secondary leading-snug">{messaggio}</p>}
        </div>
    );
}
