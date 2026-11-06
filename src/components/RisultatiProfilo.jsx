/**
 * PROFILO-SEZIONI — Profilo › Risultati: quanto hai girato davvero. Ogni numero viene dal registro (public.dna_events): giri finiti,
 * citta', tappe raggiunte, km fra le tappe. I traguardi sono soglie su quei numeri: niente punti, niente premi, niente valori di comodo.
 */
import { Check } from 'lucide-react';
import { ETICHETTE_CATEGORIA } from '../lib/dnaProfilo';
import { TESTI_PROFILO as T, traguardo } from '../lib/testiAccount';

const numero = (v) => String(v).replace('.', ',');

/** La barra fra l'ultimo traguardo preso e il prossimo. */
const quotaBarra = ({ valore, base, prossimo }) => (prossimo === null ? 100 : Math.max(0, Math.min(100, ((valore - base) / (prossimo - base)) * 100)));

function Voce({ voce }) {
    return (
        <div className="bg-obsidian-bg rounded-2xl border border-obsidian-border p-3.5" data-testid={`risultato-${voce.id}`}>
            <p className="font-marchio font-extrabold text-3xl leading-none text-obsidian-primary tabular-nums" data-testid={`risultato-${voce.id}-valore`}>{numero(voce.valore)}</p>
            <p className="font-etichetta text-[10px] tracking-[0.12em] uppercase text-obsidian-secondary mt-1.5">{T.VOCI[voce.id]}</p>
            <div className="h-1.5 mt-2.5 rounded-full bg-obsidian-raised overflow-hidden">
                <div className="h-full rounded-full bg-brand-orange" style={{ width: `${quotaBarra(voce)}%` }} />
            </div>
            <p className="text-[11px] leading-snug text-obsidian-secondary mt-1.5">{voce.prossimo === null ? T.FINITI : T.PROSSIMO(voce.id, voce.prossimo)}</p>
        </div>
    );
}

export default function RisultatiProfilo({ risultati }) {
    const { voci, citta, categoria, vuoto } = risultati;
    const presi = voci.flatMap(v => v.presi.map(n => ({ id: v.id, n })));
    const km = voci.find(v => v.id === 'km');
    return (
        <div className="font-corpo space-y-4" data-testid="risultati-profilo">
            {vuoto && <p className="text-sm text-obsidian-secondary" data-testid="risultati-vuoti">{T.RISULTATI_VUOTO}</p>}

            <div className="grid grid-cols-2 gap-2.5">
                {voci.map(v => <Voce key={v.id} voce={v} />)}
            </div>

            {presi.length > 0 && (
                <div data-testid="traguardi-presi">
                    <p className="font-etichetta text-[11px] tracking-[0.12em] uppercase text-obsidian-secondary mb-2">{T.PRESI}</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {presi.map(({ id, n }) => (
                            <li key={`${id}-${n}`} className="inline-flex items-center gap-1 text-xs font-semibold text-obsidian-primary bg-obsidian-raised border border-obsidian-border px-2.5 py-1 rounded-xl">
                                <Check className="w-3 h-3 text-brand-orange" aria-hidden="true" />{traguardo(id, n)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {citta.length > 0 && (
                <div data-testid="risultati-citta">
                    <p className="font-etichetta text-[11px] tracking-[0.12em] uppercase text-obsidian-secondary mb-2">{T.CITTA_TITOLO}</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {citta.map(c => (
                            <li key={c.nome} className="text-xs font-semibold text-obsidian-primary bg-obsidian-raised border border-obsidian-border px-2.5 py-1 rounded-xl">
                                {c.nome} <span className="font-etichetta text-obsidian-secondary">×{c.giri}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {categoria && <p className="text-sm text-obsidian-primary" data-testid="risultati-categoria">{T.TOP_CATEGORIA(ETICHETTE_CATEGORIA[categoria.categoria] || categoria.categoria, categoria.tappe)}</p>}
            {km?.valore > 0 && <p className="text-xs text-obsidian-secondary">{T.KM_NOTA}</p>}
        </div>
    );
}
