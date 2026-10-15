// TROINA-FIX — il controllo fisso della GUARDIA DELLA HOME: «ogni flusso della home da' almeno un tour con posti veri».
//
// Un posto vero e' una tappa con il suo place_id di Google (le righe di tempo libero non contano). Un flusso passa se:
//   · un itinerario (Quiz, Sorprendimi, Crea): almeno una tappa vera;
//   · Per Te: almeno un tour servito con almeno una tappa vera.
// Un caso con un errore, saltato (tetto) o con uscite in rete nel replay non passa: la guardia non sa se il flusso esce.
// Funzione pura sul grezzo del banco (giro vero o replay): la usano `npm run banco:guardia` e i test.

/** Le tappe vere di un caso del grezzo. */
export const tappeVere = (caso) => (caso?.tours || []).flatMap(t => t.stops || []).filter(s => s && !s.tempoLibero && s.place_id);

/**
 * @param {{ casi: object[] }} grezzo il grezzo del banco (giro vero o replay)
 * @param {{ attesi?: Array<string|{ id: string, flusso?: string }> }} [o] i casi che devono esserci (un caso assente non passa)
 * @returns {{ ok: boolean, righe: Array<{ id: string, luogo: string|null, flusso: string|null, ok: boolean, tour: number, tappe: number, posti: string[], motivo: string|null }> }}
 */
export function controllaGuardia(grezzo, { attesi = [] } = {}) {
    const casi = Array.isArray(grezzo?.casi) ? grezzo.casi : [];
    const perId = new Map(casi.map(c => [c.id, c]));
    const nomeFlusso = new Map(attesi.filter(a => typeof a === 'object').map(a => [a.id, a.flusso ?? null]));
    const ids = [...new Set([...attesi.map(a => (typeof a === 'object' ? a.id : a)), ...casi.map(c => c.id)])];
    const righe = ids.map((id) => {
        const c = perId.get(id);
        if (!c) return { id, luogo: null, flusso: nomeFlusso.get(id) ?? null, ok: false, tour: 0, tappe: 0, posti: [], motivo: 'caso assente nel giro' };
        const vere = tappeVere(c);
        const tourConPosti = (c.tours || []).filter(t => (t.stops || []).some(s => s && !s.tempoLibero && s.place_id)).length;
        let motivo = null;
        if (c.saltato) motivo = `saltato: ${c.saltato}`;
        else if (c.errore) motivo = `errore: ${c.errore}`;
        else if (c.replay?.uscite?.length) motivo = `replay: ${c.replay.uscite.length} uscite in rete`;
        else if (tourConPosti === 0) motivo = `nessun tour con posti veri (source ${c.source ?? '?'}${c.chiusoOra ? `, «${c.chiusoOra}»` : ''})`;
        return { id, luogo: c.luogo ?? null, flusso: nomeFlusso.get(id) ?? c.modo ?? null, ok: motivo === null, tour: tourConPosti, tappe: vere.length,
            posti: vere.map(s => s.title), motivo };
    });
    return { ok: righe.length > 0 && righe.every(r => r.ok), righe };
}

/** La tabella della guardia, in testo. */
export const tabellaGuardia = ({ ok, righe }) => [
    `GUARDIA DELLA HOME: ${ok ? 'PASSATA' : 'FALLITA'} (${righe.filter(r => r.ok).length}/${righe.length} flussi con posti veri)`,
    ...righe.map(r => `  ${r.ok ? '✅' : '❌'} ${r.id}: ${r.ok ? `${r.tour} tour, ${r.tappe} tappe — ${r.posti.join(', ')}` : r.motivo}`),
].join('\n');
