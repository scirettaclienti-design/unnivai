/**
 * TESTI-SCHEDE — la preposizione articolata giusta davanti al nome di un luogo: «al Parco del Gianicolo», «alla Galleria del
 * Cardinale Colonna», «dalla Passeggiata del Gianicolo», «davanti all'Anfiteatro Flavio», «nelle Terme di Caracalla».
 * Una sola per tutta l'app: la guida («Riparti · 2 min alla Trattoria Sorano», `alNome`) e le frasi delle schede (`stopPhrases`).
 * Puro: niente rete, niente orologio.
 */

// Il genere e il numero si leggono dalla prima parola del nome (il tipo di luogo). Elenchi chiusi: una parola che non c'è
// segue la regola del suono (vedi `articoloDi`).
const FEMMINILI = ['trattoria', 'osteria', 'pizzeria', 'basilica', 'cattedrale', 'chiesa', 'fontana', 'piazza', 'via', 'porta', 'villa', 'torre', 'pasticceria', 'gelateria', 'enoteca', 'birreria', 'rosticceria', 'taverna', 'cappella', 'galleria', 'abbazia', 'pescheria', 'panetteria', 'libreria', 'farmacia', 'cantina', 'terrazza', 'scalinata', 'strada', 'loggia', 'rocca', 'fortezza', 'badia', 'pieve', 'torrefazione', 'friggitoria', 'salumeria', 'macelleria', 'bottega', 'sinagoga', 'moschea', 'grotta', 'spiaggia', 'riviera', 'passeggiata', 'cittadella', 'biblioteca', 'pinacoteca', 'università', 'stazione', 'banchina', 'funicolare',
    'isola', 'colonna', 'statua', 'cripta', 'catacomba', 'rotonda', 'cupola', 'cinta', 'sala', 'rampa', 'salita', 'discesa', 'circonvallazione', 'tribuna', 'arena', 'necropoli', 'reggia', 'residenza', 'dimora', 'scuola', 'accademia', 'cavea', 'balconata', 'terrazzina', 'lungarno', 'lungotevere', 'lungomare'];
// «il Lungotevere», «il Lungomare»: maschili anche se finiscono in -e/-o; tolti dalle femminili sopra.
const MASCHILI_RARI = ['lungarno', 'lungotevere', 'lungomare'];
const FEMMINILI_SING = FEMMINILI.filter(f => !MASCHILI_RARI.includes(f));
const FEMMINILI_PLUR = ['terme', 'mura', 'catacombe', 'scalinate', 'ville', 'logge', 'grotte', 'rovine', 'scuderie', 'torri', 'chiese', 'fontane', 'piazze', 'basiliche', 'cappelle', 'gallerie', 'isole', 'colonne', 'statue', 'cantine', 'trattorie', 'osterie', 'pizzerie'];
const MASCHILI_PLUR = ['giardini', 'musei', 'fori', 'mercati', 'navigli', 'bastioni', 'colli', 'ponti', 'archi', 'palazzi', 'castelli', 'portici', 'uffizi', 'quattro', 'sassi', 'quartieri', 'orti', 'teatri', 'bagni', 'monti', 'laghi', 'templi', 'obelischi', 'chiostri'];
// Nomi di luogo che non vogliono l'articolo («a San Pietro», «a Trastevere»): santi e rioni.
const SENZA_ARTICOLO = /^(san|santa|sant|santo|santi|ss|trastevere|testaccio|monti|ostia|prati|ostiense|garbatella|ortigia)$/i;

// Piazze, vie, ville, porte: «Da Piazza Navona a Villa Borghese» (opzione `toponimi`, usata dai titoli). Decisione di Ivano (31/10):
// corsi, viali, lungomari, lungotevere, piazzali, ponti e salite vogliono l'articolo anche nei titoli: «Dal Lungomare», «Dal Corso», «Dal Viale».
const TOPONIMI = /^(piazza|piazzetta|largo|via|vicolo|villa|porta|campo|borgo|contrada)$/i;

const ARTICOLI = {
    il: { a: 'al', da: 'dal', di: 'del', in: 'nel', su: 'sul' },
    lo: { a: 'allo', da: 'dallo', di: 'dello', in: 'nello', su: 'sullo' },
    "l'": { a: "all'", da: "dall'", di: "dell'", in: "nell'", su: "sull'" },
    i: { a: 'ai', da: 'dai', di: 'dei', in: 'nei', su: 'sui' },
    gli: { a: 'agli', da: 'dagli', di: 'degli', in: 'negli', su: 'sugli' },
    la: { a: 'alla', da: 'dalla', di: 'della', in: 'nella', su: 'sulla' },
    le: { a: 'alle', da: 'dalle', di: 'delle', in: 'nelle', su: 'sulle' },
};
const SEMPLICI = new Set(['il', 'lo', "l'", 'i', 'gli', 'la', 'le']);
const CONTRATTE = new Set(['a', 'da', 'di', 'in', 'su']);

const primaParola = (n) => n.split(/\s+/)[0].replace(/[^\p{L}'’]/gu, '').toLowerCase().replace('’', "'");
const vocale = (p) => /^[aeiouàèéìòùh]/i.test(p) && !/^hotel$/.test(p);
const sPlusC = (p) => /^(s[^aeiou]|z|gn|ps|x|pn)/i.test(p);

/**
 * L'articolo determinativo del nome: quello scritto nel nome («Il Duomo», «L'Antica Pizzeria»), altrimenti quello del tipo di
 * luogo (prima parola) e, se il tipo non è in elenco, quello del suono. `senza`: il nome non vuole l'articolo.
 * @param {string} nome
 * @param {{ fallback?: 'suono'|'nessuno' }} [o] `nessuno`: un nome che non si riconosce (un locale: «Roscioli») resta senza articolo
 * @returns {{ art: string|null, resto: string }}
 */
export function articoloDi(nome, { fallback = 'suono', toponimi = false } = {}) {
    const n = String(nome || '').trim();
    // l'articolo scritto nel nome: «Il Duomo», «La Scogliera», «L'Antica Pizzeria» (mai «Isola»: servono lo spazio o l'apostrofo)
    const esplicito = n.match(/^(il|lo|la|i|gli|le)\s+(?=\S)/i) || n.match(/^(l)['’]\s*(?=\S)/i);
    if (esplicito) {
        const art = /^l$/i.test(esplicito[1]) ? "l'" : esplicito[1].toLowerCase();
        return { art, resto: n.slice(esplicito[0].length).trim() };
    }
    const p = primaParola(n);
    if (!p) return { art: null, resto: n };
    if (SENZA_ARTICOLO.test(p)) return { art: null, resto: n };
    // nei titoli («Da Piazza Navona a Villa Borghese») i toponimi si dicono come li dice chi abita lì: senza articolo
    if (toponimi && TOPONIMI.test(p)) return { art: null, resto: n };
    if (FEMMINILI_PLUR.includes(p)) return { art: 'le', resto: n };
    if (MASCHILI_PLUR.includes(p)) return { art: vocale(p) || sPlusC(p) ? 'gli' : 'i', resto: n };
    if (FEMMINILI_SING.includes(p)) return { art: vocale(p) ? "l'" : 'la', resto: n };
    if (fallback === 'nessuno') return { art: null, resto: n };
    if (vocale(p)) return { art: "l'", resto: n };
    if (sPlusC(p)) return { art: 'lo', resto: n };
    return { art: 'il', resto: n };
}

/**
 * La preposizione davanti al nome: conPrep('a', 'Parco del Gianicolo') → «al Parco del Gianicolo»;
 * conPrep('davanti a', 'Galleria del Cardinale Colonna') → «davanti alla Galleria del Cardinale Colonna»;
 * conPrep('sotto', 'Arco di Costantino') → «sotto l'Arco di Costantino»; conPrep('da', 'Santa Maria') → «da Santa Maria».
 * Le preposizioni a, da, di, in, su (anche in coda: «fino a», «davanti a») si articolano; le altre («sotto», «dentro», «verso»)
 * prendono l'articolo semplice.
 */
export function conPrep(prep, nome, opzioni = {}) {
    const n = String(nome || '').trim();
    if (!n) return '';
    const parole = String(prep || '').trim().split(/\s+/).filter(Boolean);
    const ultima = parole[parole.length - 1]?.toLowerCase() || '';
    const testa = parole.slice(0, -1).join(' ');
    // «Da Enzo al 29»: il nome porta già la preposizione
    if ((ultima === 'da') && /^da\s+\S/i.test(n) && opzioni.fallback === 'nessuno') return [testa, `da ${n.slice(3).trim()}`].filter(Boolean).join(' ');
    const { art, resto } = articoloDi(n, opzioni);
    const unisci = (...p) => p.filter(Boolean).join(' ');
    if (!art) return unisci(...parole, n);
    const pieno = art === "l'" ? `${resto}` : resto;
    if (CONTRATTE.has(ultima)) {
        const forma = ARTICOLI[art][ultima];
        return forma.endsWith("'") ? unisci(testa) + (testa ? ' ' : '') + forma + pieno : unisci(testa, forma, pieno);
    }
    if (!SEMPLICI.has(art)) return unisci(...parole, n);
    return art === "l'" ? unisci(...parole) + (parole.length ? ' ' : '') + "l'" + pieno : unisci(...parole, art, pieno);
}

/** «al Bar», «alla Trattoria», «all'Osteria», «allo Stadio», «ai Quattro Canti»: la preposizione «a» articolata davanti al nome. */
export const alNome = (nome) => conPrep('a', nome);
