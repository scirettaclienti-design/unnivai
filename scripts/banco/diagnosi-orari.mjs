#!/usr/bin/env node
// ORARI — diagnosi a 0 $ sul grezzo del banco esteso: per ogni caso rosso in c5,
// quali tappe erano chiuse (all'arrivo o sforando la chiusura durante la sosta),
// in che momento, e se nel pool di quel momento c'erano alternative aperte.
// Usa solo gli orari gia' scaricati dal banco (nessuna chiamata).
//   node scripts/banco/diagnosi-orari.mjs docs/prove/dati/2026-10-13-banco-esteso.json
import { readFileSync } from 'node:fs';
import { giornoEMinuti, apertoAlle, orariDelGiorno } from './orari.js';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// Gli orari scaricati, per posto, da tutti i casi (stesso posto = stessi orari settimanali).
const ORARI = new Map();
for (const c of raw.casi) for (const [id, o] of Object.entries(c.orari || {})) if (o.chiamato) ORARI.set(id, o.periods);

const apertoTutta = (periods, at, stay) => {
    const q = giornoEMinuti(at);
    if (!q) return null;
    const fine = q.minuti + (stay || 0);
    // controllo a passi di 5 minuti: arrivo → arrivo + sosta
    let esito = true;
    for (let m = q.minuti; m <= fine; m += 5) {
        const g = (q.giorno + Math.floor(m / 1440)) % 7;
        const a = apertoAlle(periods, g, m % 1440);
        if (a === null) return null;
        if (a === false) { esito = false; break; }
    }
    return esito;
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

const righe = [];
const tot = { casi: 0, chiuseArrivo: 0, sforano: 0, conAlternativaAperta: 0, senzaAlternativa: 0, alternativeSconosciute: 0 };
for (const c of raw.casi) {
    if (!c.tours) continue;
    const chiuse = [];
    for (const t of c.tours) for (const s of t.stops) {
        if (s.tempoLibero || !s.at) continue;
        const o = ORARI.get(s.place_id);
        if (o === undefined || o === null) continue;
        const q = giornoEMinuti(s.at);
        const all = apertoAlle(o, q.giorno, q.minuti);
        const tutta = apertoTutta(o, s.at, s.stay);
        if (all === false) chiuse.push({ s, tipo: 'chiusa all\'arrivo', orari: orariDelGiorno(o, q.giorno) });
        else if (tutta === false) chiuse.push({ s, tipo: 'sfora la chiusura', orari: orariDelGiorno(o, q.giorno) });
    }
    const rossoArrivo = chiuse.some(x => x.tipo === 'chiusa all\'arrivo');
    if (!rossoArrivo && !chiuse.length) continue;
    tot.casi += rossoArrivo ? 1 : 0;
    for (const x of chiuse) {
        const { s } = x;
        // le alternative: il pool del momento della tappa (itinerari), tolte quelle gia' nel giro
        const nelGiro = new Set(c.tours.flatMap(t => t.stops.map(z => z.place_id)));
        const pool = Object.entries(c.pool || {}).find(([k, v]) => k.endsWith(`-${s.moment}`) && (v.candidati || []).some(z => z.place_id === s.place_id))?.[1]
            || Object.entries(c.pool || {}).find(([k]) => k.endsWith(`-${s.moment}`))?.[1];
        let aperte = 0, chiusePool = 0, ignote = 0, migliore = null;
        for (const a of (pool?.candidati || [])) {
            if (a.place_id === s.place_id || nelGiro.has(a.place_id)) continue;
            const po = ORARI.get(a.place_id);
            if (po === undefined) { ignote++; continue; }      // orari mai scaricati dal banco
            if (po === null) { ignote++; continue; }           // Google non ha orari
            const ok = apertoTutta(po, s.at, s.stay);
            if (ok) { aperte++; migliore = migliore || a.nome; } else chiusePool++;
        }
        const nAlt = (pool?.candidati || []).filter(a => a.place_id !== s.place_id && !nelGiro.has(a.place_id)).length;
        righe.push({ pasto: !!s.pasto, caso: c.id, tappa: s.title, momento: s.moment || '—', ora: hhmm(s.at), tipo: x.tipo, orari: x.orari, nAlt: pool ? nAlt : null, aperte, chiusePool, ignote, migliore, perte: c.modo === 'perte' });
        if (x.tipo === 'chiusa all\'arrivo') tot.chiuseArrivo++; else tot.sforano++;
        if (pool) { if (aperte > 0) tot.conAlternativaAperta++; else tot.senzaAlternativa++; tot.alternativeSconosciute += ignote; }
    }
}
const L = [];
L.push('| Caso | Tappa | Momento | Arrivo | Problema | Orari del giorno | Alternative nel pool (nel momento) | Aperte note | Chiuse | Orario ignoto | Migliore aperta |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of righe) L.push(`| ${r.caso} | ${r.tappa} | ${r.momento} | ${r.ora} | ${r.tipo} | ${r.orari} | ${r.nAlt ?? 'n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro)'} | ${r.nAlt == null ? '—' : r.aperte} | ${r.nAlt == null ? '—' : r.chiusePool} | ${r.nAlt == null ? '—' : r.ignote} | ${r.migliore || '—'} |`);
console.log(L.join('\n'));
const per = (f) => righe.reduce((a, r) => { const k = f(r); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('\n' + JSON.stringify(tot));
console.log('per momento: ' + JSON.stringify(per(r => r.momento)));
console.log('pasti / non pasti: ' + JSON.stringify(per(r => (r.pasto ? 'pasto' : 'non pasto'))));
console.log('con pool per momento: ' + righe.filter(r => r.nAlt != null).length + ' tappe; alternative con orario ignoto: ' + righe.reduce((a, r) => a + (r.nAlt != null ? r.ignote : 0), 0) + ' su ' + righe.reduce((a, r) => a + (r.nAlt || 0), 0));
