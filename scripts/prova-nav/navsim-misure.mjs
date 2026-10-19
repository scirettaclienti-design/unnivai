/**
 * NAV-SIM — le misure del report dagli esiti della camminata simulata (docs/prove/dati/2026-10-16-nav-sim-esiti.json).
 *   node scripts/prova-nav/navsim-misure.mjs [esiti.json]
 * Stampa per ogni giro: tappe riconosciute da sole, con la domanda «Sei passato da…?», col tasto; la distanza a cui scatta
 * l'arrivo (GPS e vera, senza rumore); i falsi arrivi (scatto con il camminatore a più di 40 m veri dalla tappa); i tempi di
 * riaggancio; la ripresa dopo la ricarica; rete, pagina nascosta, posizione negata; gli errori di Directions.
 */
import fs from 'node:fs';

const file = process.argv[2] || 'docs/prove/dati/2026-10-16-nav-sim-esiti.json';
const { esiti = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const out = [];
for (const e of esiti) {
    if (e.errore) { out.push({ giro: e.giro, errore: e.errore }); continue; }
    const m = e.misure;
    const daSole = [...new Set(m.scatti.map(s => s.tappa))];
    const domande = [...new Set(m.domande.map(d => d.tappa))].filter(t => !daSole.includes(t));
    const tasto = m.tasto.map(t => t.tappa).filter(t => !daSole.includes(t) && !domande.includes(t));
    const gps = m.scatti.map(s => s.distanzaM), veri = m.scatti.map(s => s.distanzaVeraM).filter(Number.isFinite);
    const direzioni = e.cronologia.filter(c => c.tipo === 'directions-errore');
    out.push({
        giro: e.giro, luogo: e.luogo, tappe: e.tappe, metriPercorso: e.metriPercorso, secondi: e.secondi, completato: e.completato, video: e.video,
        arrivi: { daSole: daSole.length, conDomanda: domande.length, colTasto: tasto.length, N: e.tappe, domande: m.domande, tasto },
        scatto: { gpsM: { min: Math.min(...gps), mediana: mediana(gps), max: Math.max(...gps) }, veroM: { min: Math.min(...veri), mediana: mediana(veri), max: Math.max(...veri) },
            perTappa: m.scatti.map(s => ({ tappa: s.tappa, gpsM: s.distanzaM, veroM: s.distanzaVeraM, soglia: s.soglia, t: s.t })) },
        falsiArrivi: m.falsiArrivi.map(s => ({ tappa: s.tappa, veroM: s.distanzaVeraM, gpsM: s.distanzaM, t: s.t })),
        segnalePerso: m.riaggancio, ripresa: m.ripresa, offline: m.offline, nascosta: m.nascosta, negata: m.negata,
        directions: direzioni.map(d => ({ t: d.t, stato: d.stato, versoTappa: d.verso })),
        erroriPagina: e.errori.length,
    });
}
console.log(JSON.stringify(out, null, 1));
