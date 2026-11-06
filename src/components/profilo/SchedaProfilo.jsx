/**
 * PROFILO-SEZIONI — i pezzi comuni delle schede del Profilo, col marchio: etichetta in mono, titolo in Bricolage, corpo in Instrument
 * Sans, Ossidiana e un solo arancione. Il tasto di salvataggio dice sempre a che punto sei: da salvare, in corso, salvato.
 */
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { TESTI_DNA_PROFILO as T } from '@/lib/dnaDelGiro';

/** La scheda: etichetta, titolo, una riga su cosa fa. `...resto` porta i `data-*` della scheda. */
export function SchedaProfilo({ etichetta, titolo, sotto, children, ...resto }) {
    return (
        <motion.section
            className="mb-6 bg-obsidian-card border border-obsidian-border rounded-3xl p-5 shadow-sm space-y-4 font-corpo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            {...resto}
        >
            <header>
                {etichetta && <p className="font-etichetta text-[11px] tracking-[0.18em] uppercase text-brand-orange mb-1">{etichetta}</p>}
                <h3 className="font-marchio font-extrabold text-xl leading-tight text-obsidian-primary">{titolo}</h3>
                {sotto && <p className="text-[13px] leading-snug text-obsidian-secondary mt-1.5">{sotto}</p>}
            </header>
            {children}
        </motion.section>
    );
}

/** Una domanda della scheda: la sua etichetta e le scelte. */
export function DomandaProfilo({ testo, children }) {
    return (
        <div>
            <p className="font-etichetta text-[11px] tracking-[0.12em] uppercase text-obsidian-secondary mb-2">{testo}</p>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

/** Una scelta: accesa e' arancione piena, si vede da lontano. */
export function PillolaProfilo({ selected, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`min-h-[44px] px-4 py-2 rounded-2xl text-[13px] font-semibold transition-colors border cursor-pointer ${
                selected
                    ? 'bg-brand-orange border-brand-orange text-obsidian-bg'
                    : 'bg-obsidian-raised border-obsidian-border text-obsidian-primary hover:border-brand-orange'
            }`}
        >
            {children}
        </button>
    );
}

/**
 * Il salvataggio di una scheda. `modificato`: c'e' qualcosa da salvare (tasto arancione, con la riga che lo dice). Senza modifiche il
 * tasto e' spento e dice «Salvato»: quello che vedi sopra e' quello che vale. `nota` sostituisce la riga (es. «Scegline almeno uno.»).
 */
export function TastoSalva({ modificato, salvando, disabled = false, onClick, ariaLabel, nota = null }) {
    const attivo = modificato && !salvando && !disabled;
    const testoNota = nota || (modificato ? T.daSalvare : null);
    return (
        <div>
            {testoNota && <p className="text-xs font-medium text-brand-orange mb-2" data-testid="profilo-da-salvare">{testoNota}</p>}
            <button
                type="button"
                onClick={onClick}
                disabled={!attivo}
                aria-label={ariaLabel}
                data-testid="profilo-salva"
                data-stato={salvando ? 'salvo' : modificato ? 'modificato' : 'salvato'}
                className={`w-full min-h-[48px] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                    attivo
                        ? 'bg-brand-orange hover:bg-brand-orange-hover text-obsidian-bg cursor-pointer'
                        : 'bg-obsidian-raised border border-obsidian-border text-obsidian-secondary'
                }`}
            >
                {salvando ? T.salvo : modificato ? T.salvaModifiche : <><Check className="w-4 h-4" aria-hidden="true" />{T.salvato}</>}
            </button>
        </div>
    );
}
