// BANCO-NAZ — le righe per tappa, condivise fra la prova reale (prova.live.js)
// e il banco nazionale (scripts/banco/): stessi controlli automatici di verita'
// e voce in tutti e due.
import { voiceIssues } from '@/lib/narrationLight';
import { testoPulito } from '@/lib/stopPhrases';

// Una riga per tappa: chi l'ha scelta (modello / riparazione / ripiego), i
// minuti dalla prima e la famiglia (C1: dal tracciato interno della tappa).
export const row = (s, fatti, riempite) => ({
    title: s.title, types: (s.types || []).slice(0, 3), moment: s.moment || null, at: s.scheduledTime || null,
    min: s._tracciato ? s._tracciato.minuti : (s.travelMinutesFromPrev ?? null),
    scelta: s._tracciato?.scelta ?? (riempite ? (riempite.has(s.place_id) ? 'riparazione' : 'modello') : null),
    famiglia: s._tracciato?.famiglia ?? null, ...(s._tracciato?.motivo ? { motivo: s._tracciato.motivo } : {}),
    fatti: fatti || [], description: s.description, sicura: !!s._fraseSicura,
});

// P3d-j — per la tabella tappa / fatti / descrizione / verita' / voce: le
// scelte del modello e cosa ne ha fatto il codice, piu' due controlli
// automatici (la revisione a mano resta nel resoconto).
//   verita'  la rete non ha tolto niente e il testo e' pulito (niente null,
//            segnaposto, vuoti); se usa un fatto, e' davvero uno dei fatti.
//   voce     nessuna frase con un problema di voce (voiceIssues).
export const conComposizione = (r, comp, fattiPer) => {
    const c = comp.get(r.place_id) || {};
    const frasi = String(r.description || '').split(/(?<=[.!?])\s+/).filter(Boolean);
    const fatti = fattiPer || [];
    const fattoUsato = c.usaFatto ? frasi[0] : null;
    return {
        ...r,
        sceltaModello: c.scelta || null, usaFatto: c.usaFatto ?? null, gancio: c.gancio ?? null, interesse: c.interesse ?? null,
        riserva: c.riserva || [], rete: c.rete || [],
        verita: (c.rete || []).length === 0 && testoPulito(r.description) && (!fattoUsato || fatti.some(f => String(f.testo || f).startsWith(fattoUsato))),
        voce: frasi.every(f => voiceIssues(f).length === 0),
    };
};
