// DIAGNOSI-NOTTE — la tabella flusso × ora (difetto 1), dalle funzioni vere. Scrive il risultato in docs/prove/dati/ se DIAGNOSI_SCRIVI=1.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { cella, ORE } from './flussi.js';

it('tabella flusso × ora', () => {
    const out = {};
    for (const f of ['perte', 'quiz', 'sorprendimi', 'rigenera', 'crea']) {
        out[f] = {};
        for (const o of ORE) out[f][o.etichetta] = cella(f, o.iso);
    }
    console.log(JSON.stringify(out, null, 1));
    if (process.env.DIAGNOSI_SCRIVI === '1') writeFileSync(process.env.DIAGNOSI_FILE || 'docs/prove/dati/2026-10-21-diagnosi-notte-tabella.json', JSON.stringify(out, null, 1));
});
