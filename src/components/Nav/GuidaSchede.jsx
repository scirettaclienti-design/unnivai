/**
 * NAV-3 — le schede della guida: ARRIVO (3), SCHEDA TAPPA (4), FINE GIRO (5) e il lettore del racconto.
 * Palette Ossidiana, un solo accento arancione, angoli 14–28 px, tasti da almeno 44 px, nessun «Apri in Mappe».
 * Il lettore è pronto a ricevere un file audio (`src`, VOCE-1): finché non c'è, legge il testo con la voce di oggi (Web Speech).
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
const M = motion; // (eslint non vede `<M.x>` come uso: lo stesso difetto del resto dell'app)
import { Check, Play, Pause, X, Share2, Clock, MapPin, ArrowRight, Repeat } from 'lucide-react';
import { minSec, secondiDiLettura, tracciatoSvg, alNome } from '../../lib/navGuida';
import { NAV_TESTI } from '../../lib/navMessaggi';
import { parla, fermaVoce } from '../../lib/voce';
import { TappaModifica } from '../TappaModifica';

const TASTO = 'min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 rounded-full text-sm font-semibold border transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-orange';
const PRIMARIO = `${TASTO} bg-brand-orange text-obsidian-bg border-transparent px-5`;
const SECONDARIO = `${TASTO} bg-obsidian-raised text-obsidian-primary border-obsidian-border px-5`;
const ETICHETTA = 'text-[11px] font-bold tracking-widest uppercase';

/** «Il racconto · 0:12 / 0:40» con la barra: legge `testo` con la voce attuale o riproduce `src` quando c'è. */
export function LettoreRacconto({ testo, src = null, sec = null }) {
    const totale = sec || secondiDiLettura(testo);
    const [stato, setStato] = useState('fermo'); // fermo | in-lettura
    const [t, setT] = useState(0);
    const audio = useRef(null);
    const timer = useRef(null);
    const ferma = () => {
        clearInterval(timer.current);
        fermaVoce();
        audio.current?.pause?.();
        setStato('fermo');
    };
    useEffect(() => () => { clearInterval(timer.current); fermaVoce(); }, []);
    const avvia = () => {
        if (stato === 'in-lettura') { ferma(); return; }
        setStato('in-lettura');
        const da = Date.now() - t * 1000;
        timer.current = setInterval(() => {
            const s = (Date.now() - da) / 1000;
            if (s >= totale) { clearInterval(timer.current); setT(totale); setStato('fermo'); return; }
            setT(s);
        }, 250);
        if (src && typeof Audio !== 'undefined') { audio.current = new Audio(src); audio.current.play?.().catch(() => {}); return; }
        // VOCE-1: la voce umana (o, se non c'è, quella del browser); a fine frase il lettore si ferma da solo
        if (testo) parla(testo, { titolo: 'Il racconto' }).then((da) => { if (da !== 'muto') { clearInterval(timer.current); setStato('fermo'); setT(totale); } });
    };
    return (
        <div data-testid="lettore" className="rounded-2xl bg-obsidian-raised border border-obsidian-border p-3 flex items-center gap-3">
            <button onClick={avvia} aria-label={stato === 'in-lettura' ? 'Metti in pausa il racconto' : 'Ascolta il racconto'} className={`${TASTO} w-11 h-11 bg-brand-orange text-obsidian-bg border-transparent`}>
                {stato === 'in-lettura' ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-obsidian-primary">Il racconto</span>
                    <span data-testid="lettore-tempo" className="text-xs text-obsidian-secondary tabular-nums">{minSec(t)} / {minSec(totale)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-obsidian-card overflow-hidden border border-obsidian-border" role="progressbar" aria-valuemin={0} aria-valuemax={totale} aria-valuenow={Math.round(t)}>
                    <div className="h-full rounded-full bg-brand-orange" style={{ width: `${Math.min(100, (t / totale) * 100)}%` }} />
                </div>
            </div>
        </div>
    );
}

/** La foto della tappa: vera o niente. Senza URL, o se non si carica, l'area non c'è (mai un segnaposto grigio). */
function FotoTappa({ src, className, children }) {
    const [rotta, setRotta] = useState(false);
    if (!src || rotta) return null;
    return <div className={className}><img src={src} alt="" className="w-full h-full object-cover" onError={() => setRotta(true)} />{children}</div>;
}

/** SCHERMATA 3 — l'arrivo: la mappa resta in alto (cerchi concentrici e spunta), la scheda sale al 68%. */
export function ArrivoTappa({ numero, totale, nome, foto, riga, chicca, racconto, onApri, onRiparti, minutiAllaProssima, nomeProssima }) {
    return (
        <div className="fixed inset-0 z-[75] pointer-events-none font-sans" data-testid="arrivo">
            <div className="absolute left-0 right-0 flex flex-col items-center" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
                <div className="relative w-28 h-28 flex items-center justify-center mt-2" aria-hidden="true">
                    {[0, 1, 2].map(i => <M.span key={i} className="absolute rounded-full border-2 border-brand-orange" initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 1 + i * 0.35, opacity: 0.55 - i * 0.15 }} transition={{ duration: 0.8, delay: i * 0.12 }} style={{ width: 56, height: 56 }} />)}
                    <span className="relative w-14 h-14 rounded-full bg-brand-orange text-obsidian-bg flex items-center justify-center shadow-xl"><Check size={30} strokeWidth={3} /></span>
                </div>
                <div className="pointer-events-auto mt-2 px-4 py-2.5 rounded-full bg-obsidian-card border border-obsidian-border shadow-xl text-sm font-bold text-obsidian-primary" data-testid="arrivo-pillola">
                    Sei arrivato · tappa {numero} di {totale}
                </div>
            </div>
            <M.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                className="pointer-events-auto absolute left-0 right-0 bottom-0 bg-obsidian-card border-t border-obsidian-border rounded-t-[28px] shadow-[0_-18px_40px_rgb(0_0_0/0.5)] flex flex-col overflow-hidden"
                style={{ height: '68dvh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
                <div className="overflow-y-auto px-4 pt-4 flex-1">
                    <div className="flex items-center gap-3">
                        <FotoTappa src={foto} className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-obsidian-raised border border-obsidian-border" />
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-obsidian-primary leading-tight">{nome}</h2>
                            {riga && <p data-testid="arrivo-riga" className="text-[13px] text-obsidian-secondary mt-1 leading-snug">{riga}</p>}
                        </div>
                    </div>
                    {chicca && chicca !== racconto && (
                        <div data-testid="chicca" className="mt-4 rounded-2xl bg-obsidian-raised border border-brand-orange/40 p-3.5">
                            <p className={`${ETICHETTA} text-brand-orange`}>La chicca</p>
                            <p className="text-sm text-obsidian-primary leading-relaxed mt-1.5">{chicca}</p>
                        </div>
                    )}
                    {racconto && (
                        <div className="mt-3" data-testid="racconto-arrivo">
                            {(!chicca || chicca === racconto) && <p className="text-sm text-obsidian-primary leading-relaxed mb-3">{racconto}</p>}
                            <LettoreRacconto testo={racconto} />
                        </div>
                    )}
                </div>
                <div className="px-4 pt-3 flex gap-2">
                    <button onClick={onApri} className={`${SECONDARIO} flex-1`}>La scheda</button>
                    <button onClick={onRiparti} className={`${PRIMARIO} flex-[1.4]`}>
                        <span>{nomeProssima ? `${NAV_TESTI.RIPARTI}${minutiAllaProssima ? ` · ${minutiAllaProssima} min` : ''}` : NAV_TESTI.AVANTI}</span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                </div>
            </M.div>
        </div>
    );
}

/** SCHERMATA 4 — la scheda della tappa, a tutto schermo. */
export function SchedaTappa({ numero, categoria, nome, foto, foti = [], pillole = [], perche, racconto, onChiudi, onRiparti, minutiAllaProssima, nomeProssima, onCambia, puoCambiare = false }) {
    const gal = (foti.length ? foti : (foto ? [foto] : [])).slice(0, 6);
    const [i, setI] = useState(0);
    const testoRiparti = nomeProssima ? NAV_TESTI.RIPARTI_VERSO(minutiAllaProssima, alNome(nomeProssima)) : NAV_TESTI.AVANTI;
    const [fotoRotta, setFotoRotta] = useState(false);
    const conFoto = !!gal[i] && !fotoRotta;
    return (
        <div className="fixed inset-0 z-[90] bg-obsidian-bg flex flex-col font-sans" data-testid="scheda-tappa" role="dialog" aria-label={nome}>
            <div className="overflow-y-auto flex-1">
                {conFoto ? (
                    <div className="relative h-64 bg-obsidian-raised">
                        <img src={gal[i]} alt="" className="w-full h-full object-cover" onError={() => setFotoRotta(true)} />
                        <button onClick={onChiudi} aria-label="Chiudi la scheda" className={`${TASTO} absolute right-3 w-11 h-11 bg-obsidian-card text-obsidian-primary border-obsidian-border`} style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}><X size={20} aria-hidden="true" /></button>
                        {gal.length > 1 && (
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1" data-testid="galleria-puntini">
                                {gal.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} className="w-6 h-6 flex items-center justify-center"><span className={`block rounded-full ${k === i ? 'w-2.5 h-2.5 bg-brand-orange' : 'w-2 h-2 bg-obsidian-primary'}`} /></button>)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-end px-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
                        <button onClick={onChiudi} aria-label="Chiudi la scheda" className={`${TASTO} w-11 h-11 bg-obsidian-card text-obsidian-primary border-obsidian-border`}><X size={20} aria-hidden="true" /></button>
                    </div>
                )}
                <div className="px-4 pt-4 pb-6">
                    <p data-testid="scheda-etichetta" className={`${ETICHETTA} text-brand-orange`}>Tappa {numero}{categoria ? ` · ${categoria}` : ''}</p>
                    <h1 className="text-2xl font-bold text-obsidian-primary leading-tight mt-1">{nome}</h1>
                    {pillole.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3" data-testid="scheda-pillole">
                            {pillole.map((p, k) => <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-obsidian-card border border-obsidian-border text-xs text-obsidian-primary"><Clock size={12} aria-hidden="true" />{p}</span>)}
                        </div>
                    )}
                    {perche && (
                        <div data-testid="perche" className="mt-5 rounded-2xl bg-obsidian-card border border-brand-orange/40 p-3.5">
                            <p className={`${ETICHETTA} text-brand-orange`}>Perché sei qui adesso</p>
                            <p className="text-sm text-obsidian-primary leading-relaxed mt-1.5">{perche}</p>
                        </div>
                    )}
                    {racconto && (
                        <div className="mt-5" data-testid="racconto">
                            <p className={`${ETICHETTA} text-obsidian-secondary`}>Il racconto</p>
                            <p className="text-[15px] text-obsidian-primary leading-relaxed mt-2">{racconto}</p>
                            <div className="mt-3"><LettoreRacconto testo={racconto} /></div>
                        </div>
                    )}
                </div>
            </div>
            <div className="px-4 pt-3 border-t border-obsidian-border bg-obsidian-bg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
                {puoCambiare && onCambia && <div className="mb-2"><TappaModifica puoTogliere={false} nome={nome} onTogli={() => {}} onCambia={onCambia} etichettaCambia="Cambia tappa" /></div>}
                <button onClick={onRiparti} className={`${PRIMARIO} w-full`}>
                    <span>{testoRiparti}</span><ArrowRight size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

/** SCHERMATA 5 — il giro è finito: «<Città>, a modo tuo.», il tracciato, tre numeri, cosa ho imparato di te. */
export function FineGiro({ data, citta, tappe = [], numeri, imparato, onMete, onCondividi, onChiudi }) {
    const punti = tracciatoSvg(tappe, 320, 190, 24);
    const linea = punti.map(p => `${p.x},${p.y}`).join(' ');
    return (
        <div className="fixed inset-0 z-[95] bg-obsidian-bg flex flex-col font-sans" data-testid="fine-giro" role="dialog" aria-label="Giro completato">
            <div className="overflow-y-auto flex-1 px-4" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
                <div className="flex items-center justify-between">
                    <p data-testid="fine-etichetta" className={`${ETICHETTA} text-brand-orange`}>Giro completato · {data}</p>
                    <button onClick={onChiudi} aria-label="Chiudi" className={`${TASTO} w-11 h-11 bg-obsidian-card text-obsidian-primary border-obsidian-border`}><X size={18} aria-hidden="true" /></button>
                </div>
                <h1 data-testid="fine-titolo" className="text-[34px] leading-[1.05] font-bold text-obsidian-primary mt-2">{citta ? `${citta}, a modo tuo.` : 'A modo tuo.'}</h1>
                <div className="mt-5 rounded-[24px] bg-obsidian-card border border-obsidian-border p-2" data-testid="fine-tracciato">
                    <svg viewBox="0 0 320 190" className="w-full h-auto" role="img" aria-label="Il tracciato del giro">
                        {punti.length > 1 && <polyline points={linea} fill="none" stroke="var(--brand-orange)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />}
                        {punti.map((p, i) => (
                            <g key={i}><circle cx={p.x} cy={p.y} r="9" fill="var(--obsidian-card)" stroke="var(--brand-orange)" strokeWidth="2" /><text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-primary)">{i + 1}</text></g>
                        ))}
                    </svg>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4" data-testid="fine-numeri">
                    {[[numeri?.km, 'km'], [numeri?.tappe, 'tappe'], [numeri?.ore, String(numeri?.ore || '').endsWith('min') ? 'durata' : 'ore']].map(([v, l]) => (
                        <div key={l} className="rounded-2xl bg-obsidian-card border border-obsidian-border py-3 text-center">
                            <p className="text-2xl font-bold text-obsidian-primary tabular-nums">{v ?? '—'}</p>
                            <p className={`${ETICHETTA} text-obsidian-secondary mt-0.5`}>{l}</p>
                        </div>
                    ))}
                </div>
                {imparato && (
                    <div data-testid="fine-imparato" className="mt-4 rounded-2xl bg-obsidian-card border border-brand-orange/40 p-3.5">
                        <p className={`${ETICHETTA} text-brand-orange`}>Cosa ho imparato di te</p>
                        <p className="text-sm text-obsidian-primary leading-relaxed mt-1.5">{imparato}</p>
                    </div>
                )}
            </div>
            <div className="px-4 pt-3 flex gap-2 border-t border-obsidian-border" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
                <button onClick={onMete} className={`${PRIMARIO} flex-1`}><Repeat size={16} aria-hidden="true" /><span>Nelle tue Mete</span></button>
                <button onClick={onCondividi} className={`${SECONDARIO} flex-1`}><Share2 size={16} aria-hidden="true" /><span>Condividi</span></button>
            </div>
        </div>
    );
}

/** SCHERMATA 8 — il rito d'arrivo: 2 secondi sempre uguali. Vibrazione, la mappa si apre in un cerchio sulla foto con anelli arancioni, «Sei arrivato», il nome, la prima frase in corsivo. */
export const DURATA_RITO_MS = 2000;
export function RitoArrivo({ nome, foto, frase, onFine, parla: voceAccesa = false, voce }) {
    useEffect(() => {
        try { navigator.vibrate?.([30, 40, 60]); } catch { /* niente vibrazione su questo telefono */ }
        // la prima frase in voce, se la voce e' accesa
        if (voceAccesa && frase) parla(frase, { voce });
        const id = setTimeout(() => onFine?.(), DURATA_RITO_MS);
        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center font-sans" data-testid="rito-arrivo" aria-live="polite">
            <div className="absolute inset-0 bg-obsidian-bg/40" />
            <div className="relative flex flex-col items-center mx-6 px-5 py-4 rounded-3xl bg-obsidian-bg/70 text-center">
                <div className="relative w-40 h-40 flex items-center justify-center">
                    {[0, 1].map(i => <M.span key={i} className="absolute rounded-full border-[3px] border-brand-orange" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.15 + i * 0.18, opacity: 0.5 - i * 0.2 }} transition={{ duration: 1.2, delay: i * 0.15 }} style={{ width: 144, height: 144 }} aria-hidden="true" />)}
                    <M.div className="relative w-36 h-36 rounded-full overflow-hidden bg-obsidian-raised border-[3px] border-brand-orange" initial={{ clipPath: 'circle(0% at 50% 50%)' }} animate={{ clipPath: 'circle(72% at 50% 50%)' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
                        {foto ? <img src={foto} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center bg-brand-orange text-obsidian-bg"><Check size={56} strokeWidth={3} aria-hidden="true" /></div>}
                    </M.div>
                </div>
                <p className="mt-4 px-4 py-2 rounded-full bg-obsidian-card border border-obsidian-border text-sm font-bold text-obsidian-primary">Sei arrivato</p>
                <h2 data-testid="rito-nome" className="mt-3 text-2xl font-bold text-obsidian-primary leading-tight">{nome}</h2>
                {frase && <p data-testid="rito-frase" className="mt-2 text-[15px] italic text-obsidian-primary leading-snug max-w-xs">{frase}</p>}
            </div>
        </div>
    );
}

/** SCHERMATA 9 — il filo del giorno: nella fascia in alto è UNA riga sottile (un puntino per tappa, quella attuale evidenziata);
 *  con un tocco sulla fascia (`aperto`) compaiono i momenti e la frase. Senza riquadro: sta dentro la fascia della pillola. */
export function FiloDelGiorno({ gruppi, frase, aperto = false }) {
    if (!gruppi?.length) return null;
    return (
        <div data-testid="filo" className="pointer-events-none pt-1 pb-0.5 border-t border-obsidian-border">
            <div className="flex items-end gap-3 overflow-x-auto no-scrollbar">
                {gruppi.map((g, gi) => (
                    <div key={`${g.key}-${gi}`} className="flex flex-col items-start shrink-0">
                        {aperto && <span className="text-[10px] font-bold tracking-wider uppercase text-obsidian-secondary">{g.label}</span>}
                        <div className="flex items-center gap-1.5 h-3 mt-0.5">
                            {g.punti.map(p => (
                                <span key={p.indice} data-attuale={p.attuale ? 'si' : undefined} data-fatta={p.fatta ? 'si' : undefined}
                                    className={`block rounded-full ${p.attuale ? 'w-3 h-3 bg-brand-orange ring-2 ring-brand-orange/40' : p.fatta ? 'w-2 h-2 bg-obsidian-secondary' : 'w-2 h-2 border border-obsidian-secondary'}`} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {aperto && frase && <p data-testid="filo-frase" className="mt-1.5 text-xs text-obsidian-primary leading-snug">{frase}</p>}
        </div>
    );
}
