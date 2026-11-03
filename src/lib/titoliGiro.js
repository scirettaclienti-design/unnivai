/**
 * TESTI-SCHEDE — il titolo di un giro. Decisione di Ivano (31/10): il titolo evocativo scritto dal motore («Roma vista dal colle del
 * Gianicolo», «Fontane e piazze del centro») RESTA se ogni suo elemento trova riscontro nelle tappe del giro (`titoloFondato`). «Da A a B»
 * dalle tappe vere (`titoloDaTappe`) è solo la riserva, quando il titolo è generico («Tour di Roma», «Da insider a Catania») o falso (un
 * luogo nel titolo che fra le tappe non c'è: «Roma vista dal Gianicolo» senza il Gianicolo). Preposizioni: `preposizioni.js`.
 * Puro: niente rete, niente orologio.
 */
import { conPrep } from './preposizioni';

const TIPI_LOCALE = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'food', 'night_club', 'ice_cream_shop'];
const eLocale = (s) => (Array.isArray(s?.types) ? s.types : []).some(t => TIPI_LOCALE.includes(t));
const TITOLO_MAX = 90;
const NOME_MAX = 40;
const T = { toponimi: true };

/** Il nome senza le code commerciali: «Villa Bellini - Parco Maestranze» → «Villa Bellini», «Fontana (u Liotru)» → «Fontana». */
export function nomeBreve(titolo) {
    return String(titolo || '').replace(/\s+[-–—|]\s+.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}
const eTempoLibero = (s) => !!s?.tempoLibero || /^tempo libero$/i.test(String(s?.title || '').trim());

/**
 * I nomi delle tappe che reggono il titolo: le visite (non i locali) con un nome leggibile; se il giro ha solo locali, i locali.
 * @param {Array} stops
 * @returns {string[]} nomi brevi, nell'ordine del giro, senza doppioni
 */
export function nomiPerTitolo(stops) {
    const vere = (stops || []).filter(s => s && !eTempoLibero(s) && nomeBreve(s.title));
    const scelte = vere.some(s => !eLocale(s)) ? vere.filter(s => !eLocale(s)) : vere;
    const tutti = [];
    for (const s of scelte) {
        const n = nomeBreve(s.title);
        if (!tutti.some(x => x.toLowerCase() === n.toLowerCase())) tutti.push(n);
    }
    // i nomi corti reggono meglio un titolo; se non ce n'è nessuno si tengono quelli che ci sono
    const corti = tutti.filter(n => n.length <= NOME_MAX);
    return corti.length > 0 ? corti : tutti;
}

/**
 * Il titolo del giro dalle sue tappe. `null` se non ce n'è nessuna (chi chiama tiene il suo ripiego).
 * 2+ tappe: «Da A a B» (prima e ultima visita); 1: «Intorno a A»; se non entra in 90 caratteri: «N tappe, da A»; poi «N tappe a Città».
 */
export function titoloDaTappe(stops, citta = '') {
    const nomi = nomiPerTitolo(stops);
    const n = (stops || []).filter(s => s && !eTempoLibero(s)).length;
    if (nomi.length === 0) return n > 0 && citta ? `${n} tappe a ${citta}` : null;
    const maiuscola = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    if (nomi.length >= 2) {
        const a = nomi[0];
        const b = nomi[nomi.length - 1];
        const pieno = maiuscola(`${conPrep('da', a, T)} ${conPrep('a', b, T)}`);
        if (pieno.length <= TITOLO_MAX) return pieno;
        const corto = `${n} tappe, ${conPrep('da', a, T)}`;
        return corto.length <= TITOLO_MAX ? maiuscola(corto) : (citta ? `${n} tappe a ${citta}` : `${n} tappe`);
    }
    const unico = maiuscola(conPrep('intorno a', nomi[0], T));
    return unico.length <= TITOLO_MAX ? unico : (citta ? `${n} tappe a ${citta}` : `${n} tappe`);
}

/** Un titolo che vale per qualunque giro della città: «Tour di Roma», «Tesori di Catania», «Da insider a Roma», «Un giro a X». */
export const TITOLO_GENERICO = /^(il tuo |un |il |la )?(tour|giro|percorso|itinerario|passeggiata|viaggio|tesori|sapori|gioielli|perle|segreti|meraviglie|storia|cultura|verde|panorami|vista|luce|a tavola|dove si mangia|da insider)\b.*\b(di|a|per|in|su|dei|delle)\b/i;

// ─── Il titolo del motore: fondato sulle tappe o no ─────────────────────────────────────────────────────────────────────────────────

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
const PAROLE = (t) => norm(t).split(/[^a-z0-9]+/).filter(Boolean);

// parole che non dicono niente da verificare: articoli e preposizioni, i nomi del giro, aggettivi di atmosfera e di epoca
const VUOTE = new Set(('di a da in con su per tra fra e ed o il lo la i gli le l d un uno una del dello della dei degli delle dal dallo dalla dai '
    + 'dall all nell dell sull '
    + 'dagli dalle al allo alla ai agli alle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col coi come che dove si se piu '
    + 'tour giro giri percorso percorsi itinerario viaggio passeggiata passeggiate scoperta scoperte tesori tesoro gioielli perle segreti segreto meraviglie '
    + 'storie racconti relax colorato colorata colorati colorate '
    + 'cuore anima magia incanto angoli angolo insider esperienza esperienze locale locali tuo tua mattina mattinata pomeriggio sera serata '
    + 'notte giornata alba lento piedi cammino camminata passo passi oltre sotto sopra lungo centro citta storico storica storici storiche '
    + 'storia antico antica antichi antiche classico classica eterna autentico autentica amore '
    + 'nascosto nascosta nascosti nascoste insolito insolita romantico romantica romantici romantiche bello bella belli belle grande grandi '
    + 'piccolo piccola luce luci colori colore ritmo vita quartiere rione dentro fuori intorno attraverso verso cultura culturale '
    + 'romano romana romani romane catanese catanesi siciliano siciliana etneo etnea').split(' '));

// ─── Parole di genere ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Una parola di genere dice che COSA sono le tappe («forni», «musei», «barocco», «dall'alto»), non dove stanno. Vale se una quota delle
// tappe del giro la giustifica: dal nome, dai tipi di Google o, per le epoche e gli stili, da ciò che dicono le fonti (la descrizione).
//   MAGGIORANZA (metà delle tappe): il genere SONO le tappe. «Quattro forni a Roma» con un forno solo e tre musei è falso; stessa regola
//     per gli stili e le epoche («barocco», «medievale»), che le fonti dicono di un luogo ma non del giro intero.
//   TERZO (più di un terzo): una faccia del giro. Un giro di giornata ha un panorama, una chiesa, una fontana, un pasto: il titolo «Roma
//     dall'alto» o «Sapori di Roma» regge con più di un terzo delle tappe, non con una sola su tredici né con una su tre.
const MAGGIORANZA = 0.5;
const TERZO = 0.34; // più di un terzo: con tre tappe ne servono due
//   QUINTO (un quinto): pasti, dolci, aperitivo. Un giro di giornata ha due o tre soste a tavola su tredici tappe: «Sapori di Roma»
//     regge con loro, non servirebbero cinque ristoranti.
const QUINTO = 0.2;
const quotaMin = (tot, q) => Math.max(1, Math.ceil(tot * q - 1e-9));

// parole di categoria: valgono se abbastanza tappe sono di quel tipo (nome, tipi di Google, fonti)
const CATEGORIE = [
    { quota: TERZO, re: /^(panoram\w*|vista|viste|vedut\w*|belvedere|terrazz\w*|tramont\w*|alto|colle|colli)$/, nomi: /belvedere|terrazz|panoram|gianicolo|pincio|aventino|colle|monte|vista|giardino degli aranci|castello|lungomare|lungotevere/, tipi: ['observation_deck', 'natural_feature'] },
    { quota: TERZO, re: /^fontan\w*$/, nomi: /fontan/, tipi: ['fountain'] },
    { quota: TERZO, re: /^piazz\w*$/, nomi: /piazz|largo|campo/, tipi: ['plaza'] },
    { quota: TERZO, re: /^(vie|via|vicol\w*|strad\w*)$/, nomi: /^(via|vicolo|strada|corso)\b/, tipi: ['route'] },
    { quota: TERZO, re: /^(chies\w*|basilic\w*|duomo|cattedral\w*|sacr\w*|spiritual\w*)$/, nomi: /chiesa|basilica|duomo|cattedrale|santuario|abbazia|^san |^santa |^sant /, tipi: ['church', 'place_of_worship'] },
    { quota: TERZO, re: /^mercat\w*$/, nomi: /mercat|pescheria/, tipi: ['market'] },
    { quota: TERZO, re: /^(muse\w*|arte|arti|artistic\w*)$/, nomi: /muse|galleria|pinacoteca/, tipi: ['museum', 'art_gallery'] },
    { quota: TERZO, re: /^(parc\w*|giardin\w*|verde|natura|ville|orto|orti|outdoor|aperto|aperta)$/, nomi: /parco|giardin|villa|orto|bosco/, tipi: ['park', 'garden', 'natural_feature'] },
    { quota: TERZO, re: /^(mare|lungomare|porto|spiagg\w*|scogl\w*|costa)$/, nomi: /mare|porto|spiaggia|scogl|costa|lido/, tipi: ['natural_feature'] },
    { quota: QUINTO, re: /^(sapor\w*|cucina|gust\w*|pranzo|cena|tavola|trattori\w*|osteri\w*|pizz\w*|mangia\w*|cibo|food)$/, nomi: /trattoria|osteria|pizzeria|ristorante|cucina|friggitoria|street/, tipi: ['restaurant', 'meal_takeaway'] }, // mai il tipo «food»: Google lo dà anche a una pasticceria
    { quota: QUINTO, re: /^(caffe|colazion\w*|dolc\w*|gelat\w*|pasticc\w*|cornett\w*|granit\w*)$/, nomi: /caffe|bar |pasticceria|gelateria|forno|cornett/, tipi: ['cafe', 'bakery', 'ice_cream_shop'] },
    { quota: QUINTO, re: /^(aperitiv\w*|drink|cocktail|vino|vini|enotec\w*|brindisi)$/, nomi: /enoteca|wine|cocktail|bar|pub/, tipi: ['bar', 'night_club'] },
    { quota: TERZO, re: /^(teatr\w*|anfiteatr\w*|rovin\w*|for[oi])$/, nomi: /teatro|anfiteatro|colosseo|rovine|foro|fori|terme/, tipi: ['tourist_attraction'] },
    { quota: TERZO, re: /^(palazz\w*)$/, nomi: /palazz/, tipi: [] },
    { quota: TERZO, re: /^(castell\w*|forte|fortezza)$/, nomi: /castell|forte|fortezza|rocca/, tipi: [] },
    { quota: QUINTO, re: /^street$/, nomi: /street|friggitor|rosticcer|arancin|panin|kebab|tavola calda/, tipi: ['meal_takeaway'] },
    // Parole di genere nuove (TITOLI-RIFINITURA): metà delle tappe.
    { quota: MAGGIORANZA, re: /^(forn\w*|panific\w*|panetter\w*|fornai\w*)$/, nomi: /\bforn[oi]\b|fornai|panific|panetter/, tipi: ['bakery'], senzaNome: /pasticcer|dolcer/ },
    { quota: MAGGIORANZA, re: /^baroc\w*$/, nomi: /baroc/, tipi: [], fonti: /baroc/ },
    { quota: MAGGIORANZA, re: /^(medieval\w*|medioev\w*)$/, nomi: /medieval/, tipi: [], fonti: /medieval|medioev/ },
    { quota: MAGGIORANZA, re: /^(rinascimento|rinascimental\w*)$/, nomi: /rinascimental/, tipi: [], fonti: /rinascimento|rinascimental/ },
    { quota: MAGGIORANZA, re: /^liberty$/, nomi: /liberty/, tipi: [], fonti: /liberty|art nouveau|floreale/ },
];

const testoFonti = (s) => norm([s?.description, s?.etichetta, s?.famiglia].filter(x => typeof x === 'string').join(' '));
const tipiDi = (s) => [...(Array.isArray(s?.types) ? s.types : []), s?.primaryType].filter(Boolean);
/** La tappa è del genere della categoria? Nome (e indirizzo), tipi di Google, e per gli stili le fonti. */
const eDelGenere = (cat, s, nome) => {
    const n = nome.trim();
    if (cat.nomi.test(n)) return true;
    if (cat.senzaNome && cat.senzaNome.test(n)) return false;
    if (tipiDi(s).some(x => cat.tipi.includes(x))) return true;
    return !!(cat.fonti && cat.fonti.test(testoFonti(s)));
};

// I generi di UNA tappa, per intitolare un giro dai suoi luoghi («Quattro forni a Roma»). Una tappa può averne più d'uno (un palazzo che è
// un museo): per nome, e per tipo di Google se il tipo è «forte» (museo, chiesa, giardino…) o se il nome non ne dà nessuno. I tipi da
// locale (ristorante, bar, bakery) non si sommano al nome: un forno che Google chiama anche ristorante resta un forno.
const GENERI_TAPPA = [
    { sing: 'forno', plur: 'forni', nome: /\bforn[oi]\b|fornai|panific|panetter/, tipi: ['bakery'] },
    { sing: 'pasticceria', plur: 'pasticcerie', nome: /pasticcer|dolcer|cornetter/, tipi: ['cake_shop'] },
    { sing: 'gelateria', plur: 'gelaterie', nome: /gelater/, tipi: ['ice_cream_shop'] },
    { sing: 'caffè', plur: 'caffè', nome: /\bcaff[eè]\b|caffetteria|\bbar\b/, tipi: ['cafe', 'coffee_shop'] },
    { sing: 'pizzeria', plur: 'pizzerie', nome: /pizzeri/, tipi: [] },
    { sing: 'trattoria', plur: 'trattorie', nome: /trattori|osteri|ostari/, tipi: [] },
    { sing: 'ristorante', plur: 'ristoranti', nome: /ristorant/, tipi: ['restaurant'] },
    { sing: 'museo', plur: 'musei', forte: true, nome: /\bmuse[oi]\b|pinacoteca|\bgalleri[ae]\b/, tipi: ['museum', 'art_museum', 'history_museum', 'art_gallery'] },
    { sing: 'chiesa', plur: 'chiese', forte: true, nome: /\bchies[ae]\b|basilica|duomo|cattedrale|santuario|abbazia/, tipi: ['church'] }, // non «place_of_worship»: Google lo dà anche a un monastero che è un'università
    { sing: 'giardino', plur: 'giardini', forte: true, nome: /\bparc[ho]|giardin|\bvill[ae]\b|\borti?\b/, tipi: ['park', 'garden', 'city_park'] },
    { sing: 'fontana', plur: 'fontane', forte: true, nome: /fontan/, tipi: ['fountain'] },
    { sing: 'piazza', plur: 'piazze', forte: true, nome: /^piazz[ae]|^largo\b/, tipi: ['plaza'] },
    { sing: 'belvedere', plur: 'belvedere', forte: true, nome: /belvedere|terrazz|panoram/, tipi: ['observation_deck'] },
    { sing: 'lungomare', plur: 'lungomare', nome: /\blungomare\b|\blungotevere\b|\blungarno\b/, tipi: [] },
    { sing: 'palazzo', plur: 'palazzi', nome: /palazz/, tipi: [] },
    { sing: 'castello', plur: 'castelli', nome: /\bcastell[oi]\b|fortezza|\brocca\b/, tipi: [] },
    { sing: 'teatro', plur: 'teatri', forte: true, nome: /teatro|anfiteatro/, tipi: ['performing_arts_theater'] },
    { sing: 'mercato', plur: 'mercati', forte: true, nome: /mercat|pescheria/, tipi: ['market'] },
];
const generiTappa = (s) => {
    const nome = norm(nomeBreve(s?.title || s?.name || '')).trim();
    const tipi = tipiDi(s);
    const perNome = GENERI_TAPPA.filter(g => g.nome.test(nome));
    const perTipo = GENERI_TAPPA.filter(g => !perNome.includes(g) && tipi.some(x => g.tipi.includes(x)) && (g.forte || perNome.length === 0));
    return [...perNome, ...perTipo];
};
const NUMERI = ['', '', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci'];
const GENERE_PREVALENTE = 0.6; // quota delle visite che deve essere dello stesso genere perché il titolo lo nomini da solo
const COPERTURA = 0.8;         // con 2-3 generi insieme: quota delle visite che devono rientrare in almeno uno dei nominati
const maiuscola = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Il titolo dal GENERE delle tappe: «Quattro forni a Roma», «Musei di Firenze», «Chiese e musei di Napoli». Si usa quando il titolo del
 * motore è generico o falso e le tappe hanno un genere chiaro. Nomina solo ciò che c'è:
 *   - un genere da solo se almeno il 60% delle visite (almeno due) lo è; il numero in lettere (da 2 a 10) solo se TUTTE le visite lo
 *     sono, altrimenti il plurale: «Forni di Roma»;
 *   - altrimenti 2 o 3 generi, i più frequenti, se insieme coprono almeno l'80% delle visite: «Chiese, musei e palazzi di Catania».
 * Meno di tre visite non fanno un genere. `null` se il giro non ne ha uno chiaro: chi chiama ripiega su «Da A a B».
 */
export function titoloDiGenere(stops, citta = '') {
    const visite = (stops || []).filter(s => s && !eTempoLibero(s) && nomeBreve(s.title || s.name));
    if (visite.length < 3) return null;
    const per = visite.map(generiTappa);
    const conta = new Map();
    per.forEach(gs => gs.forEach(g => conta.set(g, (conta.get(g) || 0) + 1)));
    const ord = [...conta.entries()].sort((a, b) => b[1] - a[1] || GENERI_TAPPA.indexOf(a[0]) - GENERI_TAPPA.indexOf(b[0]));
    if (ord.length === 0) return null;
    const dove = (plur) => (citta ? `${plur} di ${citta}` : plur);
    const [g1, n1] = ord[0];
    if (n1 >= 2 && n1 / visite.length >= GENERE_PREVALENTE) {
        if (n1 === visite.length && n1 <= 10) return citta ? `${NUMERI[n1]} ${g1.plur} a ${citta}` : `${NUMERI[n1]} ${g1.plur}`;
        return maiuscola(dove(g1.plur));
    }
    for (const k of [2, 3]) {
        const scelti = ord.slice(0, k).map(e => e[0]);
        if (scelti.length < k) break;
        const coperte = per.filter(gs => gs.some(g => scelti.includes(g))).length;
        if (coperte / visite.length >= COPERTURA) {
            // nell'ordine in cui compaiono nel giro, non per frequenza: si legge come il giro va
            const nelGiro = scelti.slice().sort((a, b) => per.findIndex(gs => gs.includes(a)) - per.findIndex(gs => gs.includes(b)));
            const plur = nelGiro.map(g => g.plur);
            return maiuscola(dove(`${plur.slice(0, -1).join(', ')} e ${plur[plur.length - 1]}`));
        }
    }
    return null;
}

/** I titoli che non dicono niente anche se le parole sono vere: «Dove si mangia a Roma» (il titolo del tema di Per Te). */
const TITOLO_VAGO = /^dove si mangia\b/i;

/**
 * Il titolo del motore ha riscontro nelle tappe? Ogni parola che dice qualcosa (un luogo, un tipo di posto) deve trovarsi nelle tappe:
 * un nome nelle loro denominazioni o indirizzi, una categoria in almeno una tappa di quel tipo. Senza nessuna parola così il titolo è
 * generico (non fondato). Una parola che non si sa verificare rende il titolo non fondato: si preferisce la riserva a un titolo falso.
 * @returns {boolean}
 */
export function titoloFondato(titolo, stops, citta = '') {
    const t = String(titolo || '').trim();
    // generico = nessuna parola da verificare («Tour di Roma», «Tesori di Catania», «Il tuo giro a Roma»); non la vecchia regex
    // TITOLO_GENERICO, che scartava anche titoli evocativi veri («Panorami romantici di Roma» con il Belvedere del Gianicolo)
    if (!t || t.length > TITOLO_MAX) return false;
    const tappe = (stops || []).filter(s => s && !eTempoLibero(s));
    if (tappe.length === 0) return false;
    if (TITOLO_VAGO.test(t)) return false;
    const nomi = tappe.map(s => norm(`${s.title || s.name || ''} ${s.address || s.vicinity || s.formatted_address || ''}`));
    const parolePagliaio = new Set(nomi.flatMap(n => n.split(/[^a-z0-9]+/)));
    const cittaParole = new Set(PAROLE(citta));
    let elementi = 0;
    const parole = PAROLE(t);
    for (const w of parole) {
        if (w.length < 2 || VUOTE.has(w) || cittaParole.has(w) || /^\d+$/.test(w)) continue;
        if (w === 'food' && parole.includes('street')) continue; // «street food»: la verifica la fa «street»
        // «vista mare», «vista giardino»: la verifica la fa il luogo che si vede, non la vista in sé
        if (/^vist[ae]$/.test(w) && parole.some(x => x !== w && CATEGORIE.some(c => c.re.test(x) && !c.re.test('vista')))) continue;
        const cat = CATEGORIE.find(c => c.re.test(w));
        if (cat) {
            elementi += 1;
            // la quota: abbastanza tappe del giro devono essere di quel genere (MAGGIORANZA o TERZO, vedi sopra)
            const dentro = tappe.filter((s, i) => eDelGenere(cat, s, nomi[i])).length;
            if (dentro < quotaMin(tappe.length, cat.quota)) return false;
            continue;
        }
        // un nome: deve stare fra le parole delle tappe (anche con un'altra desinenza: «Borghese», «borghesiana» no; prefisso di 5 lettere)
        elementi += 1;
        const radice = w.length > 5 ? w.slice(0, Math.max(5, w.length - 2)) : w;
        const ok = parolePagliaio.has(w) || [...parolePagliaio].some(p => p.length >= 5 && radice.length >= 5 && p.startsWith(radice));
        if (!ok) return false;
    }
    return elementi > 0;
}

/**
 * Il titolo di un giro: quello del motore se è fondato sulle tappe; se è generico o falso, il genere delle tappe quando è chiaro
 * («Quattro forni a Roma»), altrimenti «Da A a B» dalle tappe. `null` se non c'è nessuno dei
 * due (chi chiama tiene il suo ripiego).
 */
export function titoloGiro(titoloMotore, stops, citta = '') {
    const t = String(titoloMotore || '').trim();
    if (t && titoloFondato(t, stops, citta)) return t;
    return titoloDiGenere(stops, citta) || titoloDaTappe(stops, citta);
}
