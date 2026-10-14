#!/usr/bin/env node
// C10c-replay — i tracciati di un giro registrato PRIMA del replay (che non li salvava), ricostruiti a 0 $ da quello che
// e' rimasto: il grezzo del giro, la cache del proxy dei posti (`places_cache`, letta e mai scritta) e le liste salvate
// (`city_knowledge`). Ogni pezzo ricostruito e' dichiarato in `ricostruito.assunzioni`; quello che non c'e' resta fuori
// (il replay lo segna come uscita in rete, o come racconto mancante).
//
//   node scripts/banco/replay/ricostruisci.mjs --grezzo <giro.json> --cache <places_cache.json> --liste <city_knowledge.json>
//        --out <tracciati.json.gz> [--categoria misto] [--ordine "trattoria tipica,piazza storica,belvedere panorama"]
//
// --cache: righe { k: cache_key, c: created_at, d: data } della finestra del giro (TTL 24 h: dal giro meno 24 h alla sua
// fine). Una riga scritta dopo il giro non vale (il dato servito quel giorno e' stato sovrascritto).
// --liste: righe { citta, versione, cityKnowledge } (la risposta del proxy, come la lista servita dal server).
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { CASI_ESTESI, istanteSimulato } from '../casi-esteso.js';
import { FORMATO, chiaveDaCache } from './rete.js';

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const grezzo = JSON.parse(readFileSync(opt('--grezzo'), 'utf8'));
const cache = JSON.parse(readFileSync(opt('--cache'), 'utf8'));
const liste = JSON.parse(readFileSync(opt('--liste'), 'utf8'));
const CATEGORIA = opt('--categoria', 'misto');
const ORDINE = opt('--ordine', 'trattoria tipica,piazza storica,belvedere panorama').split(',').map(s => s.trim());
const fine = new Date(grezzo.fine).getTime();
const inizio = new Date(grezzo.avvio).getTime() - 24 * 3600 * 1000;

// la cache servita nel giro: righe scritte nella finestra (le altre o erano scadute, o sono state riscritte dopo)
const places = {};
for (const r of cache) {
    const t = new Date(r.c).getTime();
    if (t < inizio || t > fine) continue;
    places[chiaveDaCache(r.k)] = { status: 200, corpo: r.d };
}

const listaDi = (citta, quartiere = null) => liste.find(l => l.citta === citta.toLowerCase() && l.versione === `c10b-7${quartiere ? `#q:${quartiere.toLowerCase()}` : ''}`)?.cityKnowledge ?? null;
const risposta = (content, modello) => ({ status: 200, corpo: { choices: [{ message: { role: 'assistant', content: JSON.stringify(content) } }], ...(modello ? { _modello: modello } : {}) } });

const casi = [];
for (const g of grezzo.casi || []) {
    if (g.errore || g.saltato) continue;
    const caso = CASI_ESTESI.find(c => c.id === g.id);
    if (!caso) continue;
    const E = { giornoSimulato: grezzo.giornoSimulato, fusoOffset: '+02:00' };
    const rete = { places: {}, ai: { lista: {}, quartiere: {}, traduttore: [], selettore: [], narratore: [], altro: [] } };
    // la lista della citta' e quella del quartiere: dal database, come le serve il proxy (cached: true)
    const giorno = g.tourDate;
    const ck = listaDi(caso.luogo);
    if (ck) rete.ai.lista[`${caso.luogo.toLowerCase()}|${giorno}|`] = { status: 200, corpo: { cityKnowledge: { ...ck, cached: true } } };
    const q = g.citta?.quartiereChiesto?.nome ?? g.citta?.listaQuartiere?.quartiere ?? null;
    const qk = q ? listaDi(caso.luogo, q) : null;
    if (qk) rete.ai.quartiere[`${caso.luogo.toLowerCase()}|${giorno}|${q.toLowerCase()}`] = { status: 200, corpo: { cityKnowledge: { ...qk, quartiere: q, cached: true } } };
    // il traduttore: non registrato. Le sue query si leggono dalle ricerche del giro (le stesse tre per ogni citta'), la
    // categoria e' un'assunzione dichiarata; la citta' e' quella del caso
    rete.ai.traduttore.push(risposta({ queries: ORDINE, categoria: CATEGORIA, oggetto_umano: caso.richiesta, citta: caso.luogo,
        vincoli: { tempo: null, escludi: [], note: null } }, g.modelli?.traduttore ?? null));
    // il selettore: le scelte registrate nel grezzo (place_id e momento, quello che il motore tiene della risposta)
    if (Array.isArray(g.sceltaModello) && g.sceltaModello.length) {
        rete.ai.selettore.push(risposta({ stops: g.sceltaModello.map(x => ({ place_id: x.place_id, ...(x.momento ? { moment: x.momento } : {}) })) }, g.modelli?.selettore ?? null));
    }
    casi.push({ id: g.id, caso, ora: istanteSimulato(caso, E), rete, fatti: {} });
}

const out = {
    formato: FORMATO, registrato: grezzo.avvio, commit: null, motore: grezzo.motore, giornoSimulato: grezzo.giornoSimulato,
    // le risposte di Google valgono per tutti i casi del giro (stessa finestra della cache)
    comune: { places },
    ricostruito: {
        da: { grezzo: opt('--grezzo').split('/').pop(), cache: `${Object.keys(places).length} risposte di places_cache scritte fra ${new Date(inizio).toISOString()} e ${grezzo.fine}`, liste: liste.map(l => l.versione + ' ' + l.citta) },
        assunzioni: [
            `traduttore non registrato: queries = ${ORDINE.join(' | ')} (lette dalla cache delle ricerche del giro, ordine assunto), categoria = ${CATEGORIA} (assunta), citta' = luogo del caso`,
            'selettore non registrato: la risposta e\' la scelta del modello salvata nel grezzo (place_id e momento, dopo la semina delle ancore)',
            'narratore e fatti aperti non registrati: il racconto non si rigioca (tappe e orari non dipendono da lui)',
            'risposte di Google: la cache del proxy nella finestra del giro (una ricerca ZERO_RESULTS non e\' in cache)',
        ],
    },
    casi,
};
writeFileSync(opt('--out'), gzipSync(JSON.stringify(out)));
console.log(`[ricostruisci] ${casi.length} casi | ${Object.keys(places).length} risposte di Google | ${opt('--out')}`);
