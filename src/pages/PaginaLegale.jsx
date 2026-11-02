/**
 * ACCOUNT-PRIVACY — pagine /privacy e /termini: pubbliche (senza login), stesso impianto.
 * In cima, sempre: «Bozza da far verificare a un legale». I segnaposto «[DA COMPILARE: …]» si vedono su giallo.
 */

import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BOZZA, COLLEGAMENTI, DATA_AGGIORNAMENTO, NOME_PRODOTTO } from '../lib/testiAccount';

const SEGNAPOSTO = /(\[DA COMPILARE:[^\]]*\])/g;

/** Il testo con i segnaposto evidenziati. */
function ConSegnaposto({ testo }) {
    return String(testo).split(SEGNAPOSTO).map((parte, i) => (
        SEGNAPOSTO.test(parte) || parte.startsWith('[DA COMPILARE:')
            ? <mark key={i} data-segnaposto className="rounded px-1 bg-yellow-300 text-black font-bold">{parte}</mark>
            : <span key={i}>{parte}</span>
    ));
}

const RIGHE_FLUSSO = [
    ['parte', 'Cosa parte'],
    ['verso', 'Verso chi'],
    ['perche', 'Perché'],
    ['resta', 'Per quanto resta'],
];

export default function PaginaLegale({ contenuto, altra }) {
    const navigate = useNavigate();
    const torna = () => { if (window.history.length > 1) navigate(-1); else navigate('/'); };

    return (
        <div className="min-h-screen bg-obsidian-bg text-obsidian-primary font-sans" data-testid={`pagina-${contenuto.titolo.toLowerCase()}`}>
            <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
                <button type="button" onClick={torna} className="min-h-[44px] inline-flex items-center gap-2 text-sm font-bold text-obsidian-secondary cursor-pointer">
                    <ArrowLeft size={16} aria-hidden="true" />{COLLEGAMENTI.TORNA}
                </button>

                <p role="note" data-bozza className="mt-2 rounded-xl border-2 border-yellow-300 bg-yellow-300/15 px-4 py-3 text-sm font-bold text-obsidian-primary">{BOZZA}</p>

                <h1 className="mt-5 text-3xl font-bold leading-tight">{contenuto.titolo} di {NOME_PRODOTTO}</h1>
                <p className="mt-1 text-obsidian-secondary">{contenuto.sottotitolo}</p>
                <p className="mt-1 text-xs text-obsidian-secondary">Aggiornato il {DATA_AGGIORNAMENTO}</p>

                {contenuto.sezioni.map((s) => (
                    <section key={s.id} id={s.id} className="mt-8">
                        <h2 className="text-xl font-bold">{s.titolo}</h2>
                        {(s.paragrafi || []).map((p, i) => (
                            <p key={i} className="mt-2 text-[15px] leading-relaxed text-obsidian-secondary"><ConSegnaposto testo={p} /></p>
                        ))}
                        {s.flussi && (
                            <ul className="mt-4 space-y-3" data-testid="flussi">
                                {s.flussi.map((f) => (
                                    <li key={f.nome} className="rounded-2xl border border-obsidian-border bg-obsidian-card px-4 py-3" data-flusso>
                                        <h3 className="text-[15px] font-bold">{f.nome}</h3>
                                        <dl className="mt-2 space-y-2 text-[14px] leading-relaxed">
                                            {RIGHE_FLUSSO.map(([k, etichetta]) => (
                                                <div key={k}>
                                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-obsidian-secondary">{etichetta}</dt>
                                                    <dd className="text-obsidian-primary"><ConSegnaposto testo={f[k]} /></dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}

                <nav className="mt-12 pt-6 border-t border-obsidian-border text-sm" aria-label="Altre pagine">
                    <Link to={altra.a} className="font-bold text-brand-orange underline underline-offset-4">{altra.testo}</Link>
                </nav>
            </main>
        </div>
    );
}
