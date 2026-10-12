// MIG-PLACES — il confronto fra il giro con la ricerca vecchia (grezzo "legacy") e
// quello con la nuova ("new"), sugli stessi 30 casi e la stessa ora simulata.
// Funzione pura: due grezzi in, markdown e numeri fuori.
import { misuraCaso, semafori, VOCI } from './misure.js';
import { eseguiControlli } from './controlli.js';
import { NOMI_MODO } from './casi-esteso.js';

const n1 = (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : String(Math.round(x * 10) / 10).replace('.', ','));
const usd = (x) => (x === null || x === undefined ? '—' : `$${x.toFixed(3).replace('.', ',')}`);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const NOMI_VOCE = { verita: 'Verità', voce: 'Voce', distanze: 'Distanze', ripetizioni: 'Ripetizioni', vincoli: 'Vincoli', inComune: 'In comune A/B',
    famosita: 'Famosità', giornata: 'Giornata', tempo: 'Tempo', costo: 'Costo', destinazione: 'Destinazione', percorso: 'Percorso (C5c)', catene: 'Catene' };

/** La varianza dichiarata: un campione per caso, il modello varia. Una voce peggiora "oltre la varianza" se ha PIU' di questi casi rossi in piu'. */
export const VARIANZA_CASI = 2;

/** I posti (place_id) del pool di un caso, con il momento: itinerari = candidati dei momenti, Per Te = pool dei temi. */
export function poolDi(c) {
    const out = [];
    if (!c.pool) return out;
    for (const [k, v] of Object.entries(c.pool)) {
        const lista = Array.isArray(v) ? v : (v?.candidati || []);
        for (const a of lista) if (a?.place_id) out.push({ id: a.place_id, momento: k, scelto: !!a.scelto, nelGiro: !!a.nelGiro });
    }
    return out;
}

/** Gli orari noti di un giro: place_id → true se i periodi sono noti. Legacy = quelli scaricati dopo (solo posti scelti); new = quelli arrivati con la ricerca. */
export function orariNoti(raw) {
    const noti = new Set();
    if (raw.luoghiOrari) for (const [id, o] of Object.entries(raw.luoghiOrari)) { if (o.periods) noti.add(id); }
    for (const c of raw.casi || []) for (const [id, o] of Object.entries(c.orari || {})) if (o.chiamato && o.periods) noti.add(id);
    return noti;
}

/** Copertura: dei posti del pool (distinti per caso e momento), quanti con orario noto. Le "alternative" sono quelli che non sono nel giro finale. */
export function copertura(raw) {
    const noti = orariNoti(raw);
    let pool = 0, poolNoti = 0, alt = 0, altNoti = 0;
    const perCaso = new Map();
    for (const c of raw.casi || []) {
        if (c.errore || c.saltato) continue;
        const nelGiro = new Set((c.tours || []).flatMap(t => (t.stops || []).map(s => s.place_id)));
        const visti = new Set();
        const r = { pool: 0, noti: 0, alt: 0, altNoti: 0, candidati: new Set() };
        for (const p of poolDi(c)) {
            const chiave = `${p.momento}|${p.id}`;
            if (visti.has(chiave)) continue;
            visti.add(chiave);
            r.pool++; r.candidati.add(p.id);
            const noto = noti.has(p.id);
            if (noto) r.noti++;
            if (!nelGiro.has(p.id)) { r.alt++; if (noto) r.altNoti++; }
        }
        pool += r.pool; poolNoti += r.noti; alt += r.alt; altNoti += r.altNoti;
        perCaso.set(c.id, { ...r, candidati: r.candidati.size });
    }
    return { pool, poolNoti, alt, altNoti, perCaso, postiNoti: noti.size };
}

const misure = (raw, config) => new Map((raw.casi || []).map(c => [c.id, { c, m: misuraCaso(c, config), ctrl: eseguiControlli({ ...c, orari: c.orari || {} }, config) }]));
const semaforiDi = (x, config) => (x.m ? semafori(x.m, x.c, config, null) : null);

export function confrontoPlaces(legacy, nuovo, config, meta = {}) {
    const L = [];
    const ML = misure(legacy, config), MN = misure(nuovo, config);
    const CL = copertura(legacy), CN = copertura(nuovo);
    const ids = (legacy.casi || []).map(c => c.id);
    const tieni = ids.filter(id => ML.get(id)?.m && MN.get(id)?.m);
    const mediaCosto = (M) => {
        const v = tieni.map(id => (M.get(id).m.costo.token + M.get(id).m.costo.google));
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };

    L.push(`# MIG-PLACES — confronto: ricerca vecchia (legacy) contro nuova (Places API (New))`);
    L.push('');
    L.push(`Stessi ${ids.length} casi del banco esteso, stessa ora simulata (${config.esteso.giornoSimulato}), stessa chiamata di ogni pagina. `
        + `**Legacy** = grezzo del giro 1 (\`${meta.legacyNome || '?'}\`, motore \`${meta.legacyCommit || 'f9998d4'}\`); **new** = \`${meta.nuovoNome || '?'}\` con \`engine=new\` (solo l'account di prova), motore \`${meta.commit || '?'}\`. `
        + 'Il motore non usa ancora gli orari: le tappe possono cambiare solo perché il modello varia e perché i candidati cambiano (tipi e ordine dei risultati dell\'API nuova).');
    L.push('');

    // ── Candidati e copertura orari ──
    L.push('## Candidati e copertura degli orari');
    L.push('');
    L.push('"Pool" = candidati messi in classifica per i momenti (itinerari) o nei pool dei temi (Per Te), distinti per momento. '
        + '"Alternative" = pool meno le tappe del giro finale. "Orario noto" = Google ha dato i periodi settimanali (legacy: scaricati dopo, solo per i posti scelti; new: arrivati con la ricerca).');
    L.push('');
    L.push('| Caso | Pool legacy | Pool new | Orario noto legacy | Orario noto new | Alternative con orario noto legacy | Alternative con orario noto new | Candidati visti dalle ricerche (new) | di cui con orari |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const id of ids) {
        const a = CL.perCaso.get(id), b = CN.perCaso.get(id);
        const c = (nuovo.casi || []).find(x => x.id === id);
        if (!a || !b) { L.push(`| ${id} | non misurato | | | | | | | |`); continue; }
        L.push(`| ${id} | ${a.pool} | ${b.pool} | ${a.noti}/${a.pool} | ${b.noti}/${b.pool} | ${a.altNoti}/${a.alt} | ${b.altNoti}/${b.alt} | ${c?.candidatiVisti ?? '—'} | ${c?.candidatiConOrari ?? '—'} |`);
    }
    L.push(`| **Totale** | **${CL.pool}** | **${CN.pool}** | **${CL.poolNoti}/${CL.pool} (${n1(pct(CL.poolNoti, CL.pool))}%)** | **${CN.poolNoti}/${CN.pool} (${n1(pct(CN.poolNoti, CN.pool))}%)** | **${CL.altNoti}/${CL.alt} (${n1(pct(CL.altNoti, CL.alt))}%)** | **${CN.altNoti}/${CN.alt} (${n1(pct(CN.altNoti, CN.alt))}%)** | | |`);
    L.push('');
    const visti = (nuovo.casi || []).reduce((a, c) => a + (c.candidatiVisti || 0), 0);
    const vistiO = (nuovo.casi || []).reduce((a, c) => a + (c.candidatiConOrari || 0), 0);
    L.push(`Candidati restituiti dalle ricerche (new), tutti i casi: **${vistiO} su ${visti}** (${n1(pct(vistiO, visti))}%) con orari settimanali. Tipo principale: ${Object.values(nuovo.luoghiOrari || {}).filter(o => o.primaryType).length} su ${Object.keys(nuovo.luoghiOrari || {}).length} posti distinti.`);
    L.push('');

    // ── Le 12 voci ──
    L.push('## Le 12 voci dell\'asticella: casi rossi, legacy contro new');
    L.push('');
    L.push(`Un campione per caso: il modello non è deterministico. **Varianza dichiarata: ±${VARIANZA_CASI} casi rossi per voce** (scelta mia, non misurata: serviva un secondo giro legacy). Una voce "peggiora oltre la varianza" se ha più di ${VARIANZA_CASI} casi rossi in più.`);
    L.push('');
    L.push('| Voce | Rossi legacy | Rossi new | Δ | Esito |');
    L.push('|---|---|---|---|---|');
    const rossi = (M, v) => tieni.filter(id => semaforiDi(M.get(id), config)?.[v] === 'rosso').length;
    let peggiorate = 0;
    for (const v of VOCI) {
        const a = rossi(ML, v), b = rossi(MN, v), d = b - a;
        const esito = d > VARIANZA_CASI ? '🔴 PEGGIORATA' : d > 0 ? '🟡 entro la varianza' : '🟢 invariata o migliore';
        if (d > VARIANZA_CASI) peggiorate++;
        L.push(`| ${NOMI_VOCE[v]} | ${a} | ${b} | ${d > 0 ? '+' : ''}${d} | ${esito} |`);
    }
    L.push('');

    // ── Per caso: percorso, ripetizioni, verità, tempi, costo ──
    L.push('## Per caso: percorso (C5c), ripetizioni, verità, tempi, costo misurato');
    L.push('');
    L.push('Percorso = incroci / deviazioni oltre 5 min / deviazione massima (min) e verdetto; verità in % di tappe; tempo in secondi; costo = token + chiamate Google contate (senza foto).');
    L.push('');
    L.push('| Caso | Tappe L→N | Percorso legacy | Percorso new | Ripetizioni L→N | Verità L→N | Tempo L→N (s) | Costo L | Costo N | Ricerche L→N |');
    L.push('|---|---|---|---|---|---|---|---|---|---|');
    const perc = (m) => (m.percorso ? `${m.percorso.incroci}/${m.percorso.deviazioniOltre}/${n1(m.percorso.deviazioneMax)} ${m.percorso.ok ? '🟢' : '🔴'}` : '⚪');
    const ricerche = (c) => (c.google?.['place/textsearch'] || 0) + (c.google?.['place/textsearch#new'] || 0);
    for (const id of ids) {
        const a = ML.get(id), b = MN.get(id);
        if (!a?.m || !b?.m) { L.push(`| ${id} | ${!a?.m ? 'legacy non misurato' : ''} ${!b?.m ? `new non misurato (${b?.c?.errore || b?.c?.saltato || '?'})` : ''} | | | | | | | | |`); continue; }
        L.push(`| ${id} | ${a.m.tappe}→${b.m.tappe} | ${perc(a.m)} | ${perc(b.m)} | ${a.m.ripetizioni}→${b.m.ripetizioni} | ${n1(a.m.verita)}→${n1(b.m.verita)} | ${n1(a.m.secondi)}→${n1(b.m.secondi)} | ${usd(a.m.costo.token + a.m.costo.google)} | ${usd(b.m.costo.token + b.m.costo.google)} | ${ricerche(a.c)}→${ricerche(b.c)} |`);
    }
    L.push('');

    // ── Totali per modalità e costo ──
    L.push('## Costo per generazione misurato, e tempi');
    L.push('');
    L.push('| Modalità | Casi | Costo medio legacy | Costo medio new | Δ | Tempo medio legacy (s) | Tempo medio new (s) |');
    L.push('|---|---|---|---|---|---|---|');
    const modi = [...new Set(tieni.map(id => ML.get(id).c.modo))];
    const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    for (const modo of [...modi, null]) {
        const sel = tieni.filter(id => modo === null || ML.get(id).c.modo === modo);
        const cl = media(sel.map(id => ML.get(id).m.costo.token + ML.get(id).m.costo.google)), cn = media(sel.map(id => MN.get(id).m.costo.token + MN.get(id).m.costo.google));
        L.push(`| ${modo ? NOMI_MODO[modo] : '**Tutte**'} | ${sel.length} | ${usd(cl)} | ${usd(cn)} | ${cl && cn ? `${cn - cl >= 0 ? '+' : ''}${usd(cn - cl)} (${n1(((cn - cl) / cl) * 100)}%)` : '—'} | ${n1(media(sel.map(id => ML.get(id).m.secondi)))} | ${n1(media(sel.map(id => MN.get(id).m.secondi)))} |`);
    }
    L.push('');
    const totN = nuovo.costo?.totale, totL = legacy.costo?.totale;
    L.push(`Spesa del giro new: **${usd(totN)}** (tetto ${usd(config.esteso.tettoUsd)}; nessuna chiamata a place/details, gli orari arrivano con la ricerca). Giro legacy: ${usd(totL)} (comprende ${legacy.costo?.google?.['place/details'] || 0} place/details per gli orari dopo la generazione, ${usd((legacy.costo?.google?.['place/details'] || 0) * config.prezziUsd.google['place/details'])}).`);
    L.push('');
    return { markdown: L.join('\n'), peggiorate, copertura: { legacy: CL, nuovo: CN }, visti, vistiO, costoMedio: { legacy: mediaCosto(ML), nuovo: mediaCosto(MN) } };
}
