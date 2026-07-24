import { useState } from 'react';

// GATE DEBUG PANEL — strumento di calibrazione nav (NON feature di prodotto).
// Montato SOLO con ?debugnav=1 (guard in MapPage). Il buffer si accumula in un
// ref esterno (navDebugRef) e viene persistito su localStorage da MapPage (flush
// throttled). Qui: vista live (snapshot all'apertura) + export dal LOG PERSISTITO
// (cross-sessione, TSV con header). Estetica minima di proposito (sotto paletto P1).

// Riga leggibile per la vista live (glance a schermo). L'export vero è il TSV
// dal localStorage (copyLog), non questa stringa.
function fmtRow(r) {
    if (r.unlock) {
        return `*** ${r.ts} SBLOCCO tappa="${r.tappa}" distReale=${r.distReale}m acc=${r.accuracy}m ***`;
    }
    const step = r.stepIdx == null ? 'null' : r.stepIdx;
    const snap = r.snapDistM == null ? 'null' : `${r.snapDistM}m`;
    const tappa = r.nextTappaDistM == null ? 'null' : `${r.nextTappaDistM}m`;
    const dt = r.dt == null ? '-' : `${r.dt}s`;
    const soglia = r.soglia == null ? '-' : `${r.soglia}m`;
    const fire = r.scattato ? ' SCATTA' : (r.armata ? ' armata' : '');
    return `${r.ts} | dt=${dt} | ${r.lat},${r.lng} | acc=${r.accuracy}m | step=${step} | snap=${snap} | tappa=${tappa} | soglia=${soglia}${fire} | "${r.instr || ''}"`;
}

// Statistiche dal log persistito (per il contatore "righe salvate" e il warning
// troncamento). Header e righe # non contano come dati.
function readStoreStats(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey) || '';
        if (!raw) return { rows: 0, kb: 0, truncated: false };
        const lines = raw.split('\n');
        const dataRows = lines.filter(l => l && !l.startsWith('#') && !l.startsWith('evento\t')).length;
        return { rows: dataRows, kb: Math.round(raw.length / 1024), truncated: raw.includes('# TRUNCATED') };
    } catch {
        return { rows: 0, kb: 0, truncated: false };
    }
}

export default function NavDebugPanel({ bufferRef, storageKey, onFlush }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);      // snapshot live, letto solo all'apertura/aggiorna
    const [copied, setCopied] = useState(false);
    const [store, setStore] = useState({ rows: 0, kb: 0, truncated: false });

    const snapshot = () => {
        setRows([...(bufferRef.current || [])]);
        setStore(readStoreStats(storageKey));
    };

    const openPanel = () => { snapshot(); setOpen(true); };

    // Export dal LOG PERSISTITO (cross-sessione). Prima forza il flush della coda
    // corrente così l'export include anche l'ultima finestra non ancora scritta.
    const copyLog = async () => {
        try { onFlush?.(); } catch { /* flush best-effort */ }
        let text = '';
        try { text = localStorage.getItem(storageKey) || ''; } catch { /* storage ko */ }
        setStore(readStoreStats(storageKey));
        if (!text) { window.prompt('Log vuoto (nessuna riga persistita).', ''); return; }
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            window.prompt('Copia manualmente (Cmd+C):', text);
        }
    };

    // Pulizia COMPLETA: buffer in memoria + log persistito. Con conferma: sul
    // campo un tap accidentale non deve cancellare un giro di dati.
    const clearAll = () => {
        if (!window.confirm('Svuotare TUTTO il log (memoria + salvato)? Non recuperabile.')) return;
        if (bufferRef.current) bufferRef.current.length = 0;
        try { localStorage.removeItem(storageKey); } catch { /* no-op */ }
        setRows([]);
        setStore(readStoreStats(storageKey));
    };

    if (!open) {
        return (
            <button
                onClick={openPanel}
                className="fixed bottom-2 left-2 z-[200] bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded"
                style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
            >
                DBG
            </button>
        );
    }

    return (
        <div className="fixed inset-2 z-[200] bg-black/90 text-white rounded-lg flex flex-col" style={{ fontFamily: 'monospace' }}>
            <div className="flex items-center gap-2 p-2 border-b border-white/20 text-[11px] flex-wrap">
                <span className="font-bold">
                    live {rows.length} · salvate {store.rows} ({store.kb}KB)
                    {store.truncated ? ' · ⚠ troncato' : ''}
                </span>
                <button onClick={snapshot} className="ml-auto bg-white/15 px-2 py-1 rounded">Aggiorna</button>
                <button onClick={copyLog} className="bg-blue-600 px-2 py-1 rounded">{copied ? 'Copiato ✓' : 'Copia log'}</button>
                <button onClick={clearAll} className="bg-red-700 px-2 py-1 rounded">Pulisci</button>
                <button onClick={() => setOpen(false)} className="bg-white/15 px-2 py-1 rounded">Chiudi</button>
            </div>
            <div className="flex-1 overflow-auto p-2 text-[9px] leading-tight whitespace-pre-wrap break-all">
                {rows.length === 0 ? (
                    <span className="text-white/50">Nessuna riga live. Avvia la nav e cammina, poi "Aggiorna". "Copia log" esporta il TSV persistito (anche di sessioni precedenti).</span>
                ) : (
                    rows.map((r, i) => (
                        <div key={i} className={r.unlock ? 'text-green-400' : (r.dt && parseFloat(r.dt) > 2 ? 'text-amber-400' : '')}>
                            {fmtRow(r)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
