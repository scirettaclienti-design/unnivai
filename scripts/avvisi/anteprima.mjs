// AVVISI — l'anteprima dell'email di riepilogo con numeri dati (JSON), senza rete e senza invii.
// Uso: node --experimental-strip-types scripts/avvisi/anteprima.mjs docs/prove/dati/2026-11-02-avvisi-dati.json [uscita.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { comporreRiepilogo, costiGiorno, tassoErrori, dollari } from '../../supabase/functions/_shared/avvisi.ts';

const [, , dati, uscita] = process.argv;
const { conteggi, traffico } = JSON.parse(readFileSync(dati, 'utf8'));
const m = comporreRiepilogo(conteggi, traffico);
const costi = costiGiorno(conteggi, traffico);
console.log(m.oggetto + '\n\n' + m.testo);
console.log(`\n[costi] AI ${dollari(costi.ai)} · Google ${dollari(costi.google)} · totale ${dollari(costi.totale)} · errori proxy ${(tassoErrori(traffico.proxyRichieste, traffico.proxyErrori) * 100).toFixed(2)}%`);
if (uscita) writeFileSync(uscita, m.html);
