// REVISORE-FORTE — il corpus congelato: i testi che il revisore ha davvero letto nella misura di RACCONTO-RIFINITURE
// (docs/prove/dati/2026-10-31-racconti-r5.json, 3 lanci x 23 tappe, r4 «prima» e r5 «dopo»), con le fonti identiche.
// Un testo entra se il revisore l'ha letto: o ha una verifica (testo finale), o è una prima stesura che il revisore ha scartato.
// Più i casi noti dei report precedenti che nella misura r5 non compaiono (testi e fonti copiati dai report).
// Uso: node scripts/prova-reale/revisore-forte-corpus.mjs  → docs/prove/dati/2026-11-02-revisore-forte-corpus.json
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-31-racconti-r5.json', 'utf8'));
const visti = new Map();
for (const lancio of d.lanci) for (const e of lancio) {
    for (const k of ['prima', 'dopo']) {
        const p = e[k];
        if (!p || p.esito === 'senza-fonti') continue;
        const cand = [];
        if (p.verifica) cand.push({ testo: p.testo, origine: `${k} L${e.lancio}`, giudizioProd: p.ok ? 'passato' : 'scartato' });
        if (p.riscritto && p.prima && (p.prima.motivi || []).some((m) => /^verifica:/.test(m))) cand.push({ testo: p.prima.testo, origine: `${k}-prima-stesura L${e.lancio}`, giudizioProd: 'scartato' });
        for (const c of cand) {
            const chiave = `${e.nome}||${c.testo}`;
            if (!visti.has(chiave)) visti.set(chiave, { citta: e.citta, nome: e.nome, fonti: e.fonti, testo: c.testo, origini: [c.origine], giudizioProd: [c.giudizioProd] });
            else { const v = visti.get(chiave); v.origini.push(c.origine); v.giudizioProd.push(c.giudizioProd); }
        }
    }
}
// Caso noto di produzione (r5, riscritto), non presente nella misura r5: stesse fonti dell'Elefante già nel corpus.
const elefante = [...visti.values()].find((v) => /Elefante/.test(v.nome));
const nota = `${elefante.nome}||NOTO`;
visti.set(nota, { citta: elefante.citta, nome: elefante.nome, fonti: elefante.fonti, origini: ['caso noto produzione (collaudo-sito-p5-r5)'], giudizioProd: ['passato'],
    testo: "Guarda l'elefante di basalto nero: i catanesi lo chiamano U Liotru. Sopra la fontana l'ha messa Giovanni Battista Vaccarini, tra il 1735 e il 1737. Oggi quell'elefante è l'emblema di Catania." });
const corpus = [...visti.values()].map((v, i) => ({ id: i + 1, ...v }));
// Le iniezioni: testi fedeli del corpus con UN solo dettaglio inventato (vero o falso nella realtà, ma NON nelle fonti). Servono a dare
// abbastanza invenzioni alla misura dei falsi «sì»: sono sintetiche e nel report stanno in una tabella a parte.
const INIEZIONI = [
    [2, "Sta al centro di piazza del Duomo", "Sta al centro di piazza del Duomo, davanti al municipio"],
    [13, "ognuno con 8 colonne in marmo bianco", "ognuno con 8 colonne in marmo bianco, prese dal teatro romano"],
    [6, "Cerca anche i carri dipinti.", "Cerca anche i carri dipinti. Dalle mura si vede il mare."],
    [14, "In mezzo ai due palazzi c'è la Fontana dell'Elefante.", "In mezzo ai due palazzi c'è la Fontana dell'Elefante, e sul portone c'è uno stemma di marmo."],
    [22, "Un tempo era la residenza di Cristina di Svezia.", "Un tempo era la residenza di Cristina di Svezia, che qui teneva la sua biblioteca."],
    [23, "e dentro trovi statue, opere d'arte e affreschi.", "e dentro trovi statue, opere d'arte, affreschi e la Lupa capitolina."],
    [94, "poi ai Colli Albani e fino a Terminillo, Velino e Monti Simbruini.", "poi ai Colli Albani e fino a Terminillo, Velino e Monti Simbruini. A mezzogiorno qui spara il cannone."],
    [9, "Questa fontana è del 1867.", "Questa fontana è del 1867, rifatta dopo il terremoto."],
    [4, "a partire dalla fine dell'Ottocento.", "a partire dalla fine dell'Ottocento, dopo secoli sotto le case."],
    [34, "La facciata ha le colonne,", "La facciata ha le colonne bianche,"],
    [31, "la statua di Marco Aurelio", "la statua equestre di Marco Aurelio"],
    [19, "l'ultimo proprietario,", "l'ultimo proprietario, un americano,"],
    [54, "per circa 3 chilometri", "per circa 5 chilometri"],
    [77, "L'ha fatta Tito Angelini,", "L'ha fatta Tito Angelini, scultore catanese,"],
];
for (const [base, da, a] of INIEZIONI) {
    const b = corpus.find((c) => c.id === base);
    if (!b || !b.testo.includes(da)) throw new Error(`iniezione su ${base}: testo non trovato`);
    corpus.push({ id: 100 + corpus.filter((c) => c.sintetico).length, citta: b.citta, nome: b.nome, fonti: b.fonti, testo: b.testo.replace(da, a), origini: [`iniezione su ${base}`], giudizioProd: [], sintetico: true, base });
}
fs.writeFileSync('docs/prove/dati/2026-11-02-revisore-forte-corpus.json', JSON.stringify({ fonte: 'docs/prove/dati/2026-10-31-racconti-r5.json', testi: corpus }, null, 1));
console.log('testi', corpus.length);
