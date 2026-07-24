import { useState } from 'react';

// GATE DEBUG PANEL — strumento di calibrazione nav (NON feature di prodotto).
// Montato SOLO con ?debugnav=1 (guard in MapPage). Legge il ref bufferRef SOLO
// all'apertura (snapshot): niente re-render durante la nav, il buffer si accumula
// in un ref esterno. Estetica minima di proposito (sotto paletto P1).

// Serializza una riga in testo incollabile: campi separati da " | ".
function fmtRow(r) {
    if (r.unlock) {
        return `*** ${r.ts} SBLOCCO tappa="${r.tappa}" distReale=${r.distReale}m acc=${r.accuracy}m ***`;
    }
    const step = r.stepIdx == null ? 'null' : r.stepIdx;
    const snap = r.snapDistM == null ? 'null' : `${r.snapDistM}m`;
    const tappa = r.nextTappaDistM == null ? 'null' : `${r.nextTappaDistM}m`;
    const dt = r.dt == null ? '-' : `${r.dt}s`;
    return `${r.ts} | dt=${dt} | ${r.lat},${r.lng} | acc=${r.accuracy}m | step=${step} | snap=${snap} | tappa=${tappa} | "${r.instr || ''}"`;
}

export default function NavDebugPanel({ bufferRef }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);      // snapshot locale, letto solo all'apertura
    const [copied, setCopied] = useState(false);

    const snapshot = () => setRows([...(bufferRef.current || [])]);

    const openPanel = () => { snapshot(); setOpen(true); };

    const copyAll = async () => {
        const text = (bufferRef.current || []).map(fmtRow).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // fallback: se clipboard non disponibile, seleziona in un prompt
            window.prompt('Copia manualmente (Cmd+C):', text);
        }
    };

    const clearAll = () => { if (bufferRef.current) bufferRef.current.length = 0; setRows([]); };

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
            <div className="flex items-center gap-2 p-2 border-b border-white/20 text-[11px]">
                <span className="font-bold">DEBUG NAV — {rows.length} righe</span>
                <button onClick={snapshot} className="ml-auto bg-white/15 px-2 py-1 rounded">Aggiorna</button>
                <button onClick={copyAll} className="bg-blue-600 px-2 py-1 rounded">{copied ? 'Copiato ✓' : 'Copia tutto'}</button>
                <button onClick={clearAll} className="bg-red-700 px-2 py-1 rounded">Pulisci</button>
                <button onClick={() => setOpen(false)} className="bg-white/15 px-2 py-1 rounded">Chiudi</button>
            </div>
            <div className="flex-1 overflow-auto p-2 text-[9px] leading-tight whitespace-pre-wrap break-all">
                {rows.length === 0 ? (
                    <span className="text-white/50">Nessuna riga. Avvia la nav e cammina, poi "Aggiorna".</span>
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
