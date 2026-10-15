// GUARDIA-PERTINENZA — i 5 controlli di pertinenza di BORGO-DIAGNOSI (sezione 5 del report del 21/10), decisi prima dei numeri
// e applicati alla lettera: NON si cambiano (regola del task BORGO-COMPLETO). Funzione pura sul grezzo del banco (giro vero o
// replay): la usano `npm run banco:guardia` e i test. Nessun import dal motore: i tipi e le espressioni qui sotto sono copie
// dichiarate di `src/lib/borgoConfini.js` e di `momentSelection.FAMILY_REQUEST_TEXT` (un test della suite le tiene uguali).
//
//   1 Natura        natura chiesta → almeno una tappa di natura o panorama; altrimenti ❌ se il riquadro del Quiz la mostra lo
//                   stesso o se nessuna nota a schermo la nomina. «Raggiungibile» = una natura nel pool di un momento o fra i
//                   candidati senza momento (rec.senzaMomento): solo informazione.
//   2 Due intenzioni ogni famiglia chiesta nel testo libero (dalle query del traduttore, rec.intento; senza, dal testo) ha
//                   almeno una tappa. Con meno di due famiglie: «—».
//   3 Giornata      «giornata» o «domani» nel testo → le sezioni a schermo hanno Mattina e Pomeriggio, oppure una nota spiega
//                   perche' meno.
//   4 Durata        i numeri che le schermate del flusso mostrano (schermo.durate, calcolati in giro-caso.js con le funzioni vere
//                   di tourTiming.js) sono uguali; con un numero solo: «—».
//   5 Colazione     il conto delle tappe da colazione (tema `colazione`, o un posto da colazione — caffe', forno, dolce, bar
//                   semplice — DI MATTINA: momento colazione/mattina o arrivo prima delle 11, ora di Roma; il bar del dopocena
//                   non e' una colazione): solo un numero, la regola la decide Ivano.
//
// Esito per controllo: '✅' | '❌' | '—', con una nota. `ok` = nessun ❌. Il «—» non conta.

/** Copia di TIPI_NATURA di src/lib/borgoConfini.js (un test della suite controlla che restino uguali). */
export const TIPI_NATURA = ['natural_feature', 'park', 'national_park', 'state_park', 'nature_preserve', 'hiking_area', 'scenic_spot',
    'botanical_garden', 'garden', 'campground', 'beach', 'lake', 'mountain_peak', 'observation_deck'];
/** Copia di NOME_NATURA di src/lib/borgoConfini.js. */
export const NOME_NATURA = /^(monte|lago|riserva|bosco|sentiero|cascat\w*|gol[ae]|valle|parco|giardin\w*|belvedere|pineta|oasi|spiaggia|cala|grotta)\b/i;
/** Copia di TIPI_STORICI di src/lib/borgoConfini.js. */
export const TIPI_STORICI = ['historical_landmark', 'historical_place', 'monument', 'castle', 'archaeological_site', 'fortress', 'palace',
    'museum', 'church', 'place_of_worship', 'cultural_landmark', 'ruins'];
/** Copia di FAMILY_REQUEST_TEXT.verde di momentSelection.js: la natura chiesta nel testo libero. */
export const TESTO_NATURA = /\b(parc[oh]\w*|giardin\w*|verde|natura)\b/i;

const TIPI_LOCALE = new Set(['restaurant', 'bar', 'cafe', 'food', 'store', 'lodging', 'meal_takeaway', 'bakery', 'night_club', 'pub']);
const tipiDi = (s) => [...(Array.isArray(s?.types) ? s.types : []), s?.primaryType].filter(Boolean);
const nomeDi = (s) => String(s?.title || s?.nome || s?.name || '');
const locale = (s) => !!s?.pasto || tipiDi(s).some(t => TIPI_LOCALE.has(t));

/** Una tappa (o un candidato del pool) di natura o panorama: famiglia verde/panorama, un tipo di natura, o un nome da natura. Mai un locale. */
export const isNatura = (s) => !!s && !s.tempoLibero && !locale(s)
    && (s.famiglia === 'verde' || s.famiglia === 'panorama' || tipiDi(s).some(t => TIPI_NATURA.includes(t)) || NOME_NATURA.test(nomeDi(s).trim()));
/** Una tappa di storia: famiglia chiesa/museo o un tipo storico, che non sia natura. */
export const isStoria = (s) => !!s && !s.tempoLibero && !isNatura(s) && (s.famiglia === 'chiesa' || s.famiglia === 'museo' || tipiDi(s).some(t => TIPI_STORICI.includes(t)));

// Le famiglie dell'intento: dalle query del traduttore (una query → una famiglia) o dal testo.
const QUERY_FAMIGLIA = [
    ['natura', /natur|riserv|parc[oh]|giardin|verde|belveder|panoram|sentier|bosc|lag[oh]|mont[ei]|oasi|spiagg|cascat|grott|orto botanic|villa comunale/i],
    ['storia', /stori|castell|muse[oi]|chies|cattedral|duom|basilic|palazz|archeolog|monument|torre|rovin|ruder|sito|teatro antic|anfiteatr|fortezz|convent|abbazi/i],
];
export const famigliaDellaQuery = (q) => (QUERY_FAMIGLIA.find(([, re]) => re.test(String(q || ''))) || [null])[0];
const TESTO_STORIA = /\b(stori\w*|castell\w*|muse[oi]|chies[ae]|cattedral\w*|duom[oi]|basilic\w*|palazz\w*|archeolog\w*|monument\w*)\b/i;

/** Le famiglie chieste da un testo libero (Crea): dalle query del traduttore se registrate, altrimenti dal testo. */
export function famiglieChieste(caso) {
    const q = Array.isArray(caso?.intento?.queries) ? caso.intento.queries : null;
    if (q && q.length) return { famiglie: [...new Set(q.map(famigliaDellaQuery).filter(Boolean))], fonte: 'query del traduttore' };
    const testo = String(caso?.richiesta || caso?.chiamata?.testo || '');
    const out = [];
    if (TESTO_NATURA.test(testo)) out.push('natura');
    if (TESTO_STORIA.test(testo)) out.push('storia');
    return { famiglie: out, fonte: 'testo' };
}

const tappe = (caso) => (caso?.tours || []).flatMap(t => t.stops || []).filter(s => s && !s.tempoLibero);
const interessi = (caso) => (Array.isArray(caso?.chiamata?.prefs?.interests) ? caso.chiamata.prefs.interests : []).map(String);
const note = (caso) => (Array.isArray(caso?.schermo?.note) ? caso.schermo.note : []).map(String);
const etichette = (caso) => (Array.isArray(caso?.schermo?.sezioni) ? caso.schermo.sezioni : []).map(s => String(s?.etichetta || ''));

/**
 * La natura e' chiesta? Quiz e Sorprendimi dalla scelta; Crea dal TESTO (sezione 7: «se il testo passa requestedFamilies → verde»:
 * rec.intento.famiglie, calcolato in giro-caso.js con la funzione vera; senza, la stessa espressione sul testo); Per Te mai.
 * Le query che il traduttore sceglie da solo («Una giornata a Troina» → «parco») non sono una richiesta di natura.
 */
export function naturaChiesta(caso) {
    if (caso?.modo === 'veloce' || caso?.modo === 'sorprendimi') return interessi(caso).some(i => /^natura$/i.test(i));
    if (caso?.modo === 'crea') {
        if (Array.isArray(caso?.intento?.famiglie)) return caso.intento.famiglie.includes('verde');
        return TESTO_NATURA.test(String(caso?.richiesta || caso?.chiamata?.testo || ''));
    }
    return false;
}

/** I posti di natura raggiungibili ma non scelti: nel pool di un momento o fra i candidati senza momento. */
export function naturaRaggiungibile(caso) {
    const nomi = new Set();
    for (const entry of Object.values(caso?.pool || {})) {
        const lista = Array.isArray(entry) ? entry : Array.isArray(entry?.candidati) ? entry.candidati : [];
        for (const c of lista) if (isNatura(c) && !c.nelGiro) nomi.add(`${nomeDi(c)}${c.motivo ? ` (${c.motivo})` : ''}`);
    }
    for (const c of Array.isArray(caso?.senzaMomento) ? caso.senzaMomento : []) if (isNatura(c)) nomi.add(`${nomeDi(c)} (senza momento)`);
    return [...nomi];
}

function controllo1(caso) {
    if (!naturaChiesta(caso)) return { esito: '—', nota: 'non chiesta' };
    const natura = tappe(caso).filter(isNatura);
    if (natura.length) return { esito: '✅', nota: natura.map(s => s.title).join(', ') };
    const riquadro = caso?.schermo?.riquadro;
    const nomina = note(caso).filter(n => /natur/i.test(n));
    const raggiungibili = naturaRaggiungibile(caso);
    const dettagli = [];
    if (riquadro?.mostrato) dettagli.push(`il riquadro dice «${riquadro.scelta}» senza una tappa di natura`);
    dettagli.push(raggiungibili.length ? `raggiungibile: ${raggiungibili.join('; ')}` : 'nessuna natura raggiungibile');
    if (nomina.length) dettagli.push(`nota: «${nomina[0]}»`); else dettagli.push('nessun messaggio sulla natura');
    const ok = nomina.length > 0 && !riquadro?.mostrato;
    return { esito: ok ? '✅' : '❌', nota: dettagli.join('; ') };
}

function controllo2(caso) {
    if (caso?.modo !== 'crea') return { esito: '—', nota: 'solo testo libero' };
    const { famiglie, fonte } = famiglieChieste(caso);
    if (famiglie.length < 2) return { esito: '—', nota: `${famiglie.length ? `una sola famiglia (${famiglie[0]})` : 'nessuna famiglia'} dal ${fonte}` };
    const t = tappe(caso);
    const presenti = { natura: t.filter(isNatura).map(s => s.title), storia: t.filter(isStoria).map(s => s.title) };
    const mancanti = famiglie.filter(f => !(presenti[f] || []).length);
    const nota = famiglie.map(f => `${f}: ${(presenti[f] || []).length ? presenti[f].join(', ') : 'nessuna tappa'}`).join(' | ') + ` (${fonte})`;
    return { esito: mancanti.length ? '❌' : '✅', nota };
}

export const chiedeGiornata = (caso) => /\b(giornata|domani)\b/i.test(String(caso?.richiesta || caso?.chiamata?.testo || ''));

function controllo3(caso) {
    if (caso?.modo !== 'crea' || !chiedeGiornata(caso)) return { esito: '—', nota: 'non chiesta' };
    const e = etichette(caso);
    if (e.includes('Mattina') && e.includes('Pomeriggio')) return { esito: '✅', nota: `sezioni: ${e.join(', ')}` };
    const spiega = note(caso).find(n => /mezza giornata|si gira in|non ho|non sono riuscito|non troviamo/i.test(n));
    if (spiega) return { esito: '✅', nota: `sezioni: ${e.join(', ') || 'nessuna'}; la nota spiega: «${spiega}»` };
    return { esito: '❌', nota: `sezioni: ${e.join(', ') || 'nessuna'}; nessuna nota spiega perche' meno` };
}

function controllo4(caso) {
    const d = caso?.schermo?.durate;
    if (!d || typeof d !== 'object') return { esito: '—', nota: 'durate non registrate' };
    const voci = Object.entries(d).filter(([, v]) => Number.isFinite(v));
    const testo = voci.map(([k, v]) => `${k} ${v}`).join(', ');
    if (voci.length < 2) return { esito: '—', nota: `un solo numero (${testo || 'nessuno'})` };
    const uguali = voci.every(([, v]) => v === voci[0][1]);
    return { esito: uguali ? '✅' : '❌', nota: testo };
}

const oraRoma = (iso) => { try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date(iso))); } catch { return NaN; } };
const diMattina = (s) => s.moment === 'colazione' || s.moment === 'mattina' || (s.at && oraRoma(s.at) < 11);
export const isColazione = (s) => !!s && !s.tempoLibero && (s.tema === 'colazione' || (s.colazione === true && diMattina(s)));

function controllo5(caso) {
    const n = tappe(caso).filter(isColazione).length;
    return { esito: '—', nota: n ? `${n} tappa${n > 1 ? 'e' : ''} da colazione` : 'non compare', conto: n };
}

export const CONTROLLI = ['1 Natura', '2 Due intenzioni', '3 Giornata', '4 Durata scheda = dettaglio', '5 Colazione'];

/**
 * I 5 controlli su un caso del grezzo.
 * @returns {{ id, luogo, modo, ok: boolean, controlli: Array<{ nome, esito, nota }> }}
 */
export function controllaPertinenza(caso) {
    const base = { id: caso?.id ?? null, luogo: caso?.luogo ?? null, modo: caso?.modo ?? null };
    if (!caso || caso.saltato || caso.errore || caso.replay?.uscite?.length) {
        const motivo = !caso ? 'caso assente' : caso.saltato ? `saltato: ${caso.saltato}` : caso.errore ? `errore: ${caso.errore}` : `replay: ${caso.replay.uscite.length} uscite in rete`;
        return { ...base, ok: false, controlli: CONTROLLI.map(nome => ({ nome, esito: '❌', nota: motivo })) };
    }
    const controlli = [controllo1, controllo2, controllo3, controllo4, controllo5].map((f, i) => ({ nome: CONTROLLI[i], ...f(caso) }));
    return { ...base, ok: controlli.every(c => c.esito !== '❌'), controlli };
}

/** Tutti i casi di un grezzo (o di piu' grezzi). */
export const controllaPertinenzaDi = (casi) => (Array.isArray(casi) ? casi : []).map(controllaPertinenza);

/** Le celle ❌ come `id:numero` (per il confronto con quelle gia' note). */
export const celleRosse = (righe) => righe.flatMap(r => r.controlli.map((c, i) => (c.esito === '❌' ? `${r.id}:${i + 1}` : null)).filter(Boolean));

/** I ❌ non ancora noti: la guardia fallisce solo su questi (CLAUDE.md: «pertinenza senza ❌ nuovi»). */
export const rosseNuove = (righe, noti = []) => { const n = new Set(noti); return celleRosse(righe).filter(c => !n.has(c)); };

/** La tabella di pertinenza, in testo (una riga per caso, i 5 esiti, le note sotto). */
export function tabellaPertinenza(righe, { noti = [] } = {}) {
    const nuove = new Set(rosseNuove(righe, noti));
    const out = [`PERTINENZA: ${nuove.size ? `${nuove.size} ❌ NUOVI` : 'nessun ❌ nuovo'} (${celleRosse(righe).length} ❌ in tutto, ${noti.length} gia' noti)`,
        `  ${'caso'.padEnd(30)} ${CONTROLLI.map(c => c.slice(0, 2).trim()).join('  ')}`];
    for (const r of righe) {
        out.push(`  ${r.id.padEnd(30)} ${r.controlli.map((c, i) => `${c.esito}${nuove.has(`${r.id}:${i + 1}`) ? '!' : ' '}`).join(' ')}`);
        for (const [i, c] of r.controlli.entries()) if (c.esito !== '—' || c.conto) out.push(`      ${i + 1}: ${c.nota}`);
    }
    return out.join('\n');
}
