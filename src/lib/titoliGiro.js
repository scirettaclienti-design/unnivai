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
    + 'storia antico antica antichi antiche barocco barocca medievale rinascimento rinascimentale classico classica eterna autentico autentica '
    + 'nascosto nascosta nascosti nascoste insolito insolita romantico romantica romantici romantiche bello bella belli belle grande grandi '
    + 'piccolo piccola luce luci colori colore ritmo vita quartiere rione dentro fuori intorno attraverso verso cultura culturale '
    + 'romano romana romani romane catanese catanesi siciliano siciliana etneo etnea').split(' '));

// parole di categoria: valgono se almeno una tappa è di quel tipo (nome o tipi di Google)
const CATEGORIE = [
    { re: /^(panoram\w*|vista|viste|vedut\w*|belvedere|terrazz\w*|tramont\w*|alto|colle|colli)$/, nomi: /belvedere|terrazz|panoram|gianicolo|pincio|aventino|colle|monte|vista|giardino degli aranci|castello|lungomare|lungotevere/, tipi: ['observation_deck', 'natural_feature'] },
    { re: /^fontan\w*$/, nomi: /fontan/, tipi: ['fountain'] },
    { re: /^piazz\w*$/, nomi: /piazz|largo|campo/, tipi: ['plaza'] },
    { re: /^(vie|via|vicol\w*|strad\w*)$/, nomi: /^(via|vicolo|strada|corso)\b/, tipi: ['route'] },
    { re: /^(chies\w*|basilic\w*|duomo|cattedral\w*|sacr\w*|spiritual\w*)$/, nomi: /chiesa|basilica|duomo|cattedrale|santuario|abbazia|^san |^santa |^sant /, tipi: ['church', 'place_of_worship'] },
    { re: /^mercat\w*$/, nomi: /mercat|pescheria/, tipi: ['market'] },
    { re: /^(muse\w*|arte|arti|artistic\w*)$/, nomi: /muse|galleria|pinacoteca/, tipi: ['museum', 'art_gallery'] },
    { re: /^(parc\w*|giardin\w*|verde|natura|ville|orto|orti|outdoor|aperto|aperta)$/, nomi: /parco|giardin|villa|orto|bosco/, tipi: ['park', 'garden', 'natural_feature'] },
    { re: /^(mare|lungomare|porto|spiagg\w*|scogl\w*|costa)$/, nomi: /mare|porto|spiaggia|scogl|costa|lido/, tipi: ['natural_feature'] },
    { re: /^(sapor\w*|cucina|gust\w*|pranzo|cena|tavola|trattori\w*|osteri\w*|pizz\w*|mangia\w*|cibo|street|food)$/, nomi: /trattoria|osteria|pizzeria|ristorante|cucina|friggitoria|street/, tipi: ['restaurant', 'meal_takeaway'] }, // mai il tipo «food»: Google lo dà anche a una pasticceria
    { re: /^(caffe|colazion\w*|dolc\w*|gelat\w*|pasticc\w*|cornett\w*|granit\w*)$/, nomi: /caffe|bar |pasticceria|gelateria|forno|cornett/, tipi: ['cafe', 'bakery', 'ice_cream_shop'] },
    { re: /^(aperitiv\w*|drink|cocktail|vino|vini|enotec\w*|brindisi)$/, nomi: /enoteca|wine|cocktail|bar|pub/, tipi: ['bar', 'night_club'] },
    { re: /^(teatr\w*|anfiteatr\w*|rovin\w*|for[oi])$/, nomi: /teatro|anfiteatro|colosseo|rovine|foro|fori|terme/, tipi: ['tourist_attraction'] },
    { re: /^(palazz\w*)$/, nomi: /palazz/, tipi: [] },
    { re: /^(castell\w*|forte|fortezza)$/, nomi: /castell|forte|fortezza|rocca/, tipi: [] },
];

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
    const nomi = tappe.map(s => norm(`${s.title || s.name || ''} ${s.address || s.vicinity || s.formatted_address || ''}`));
    const parolePagliaio = new Set(nomi.flatMap(n => n.split(/[^a-z0-9]+/)));
    const cittaParole = new Set(PAROLE(citta));
    let elementi = 0;
    for (const w of PAROLE(t)) {
        if (w.length < 2 || VUOTE.has(w) || cittaParole.has(w) || /^\d+$/.test(w)) continue;
        const cat = CATEGORIE.find(c => c.re.test(w));
        if (cat) {
            elementi += 1;
            const ok = tappe.some((s, i) => cat.nomi.test(nomi[i].trim()) || (Array.isArray(s.types) && s.types.some(x => cat.tipi.includes(x))));
            if (!ok) return false;
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
 * Il titolo di un giro: quello del motore se è fondato sulle tappe, altrimenti «Da A a B» dalle tappe. `null` se non c'è nessuno dei
 * due (chi chiama tiene il suo ripiego).
 */
export function titoloGiro(titoloMotore, stops, citta = '') {
    const t = String(titoloMotore || '').trim();
    if (t && titoloFondato(t, stops, citta)) return t;
    return titoloDaTappe(stops, citta);
}
