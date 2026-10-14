// C10b3 — la lista della città bilanciata (decisioni di Ivano):
//   · una lista senza abbastanza luoghi da visitare viene completata (una sola richiesta);
//   · il simbolo non può essere un locale;
//   · in metropoli le ricerche iniziali partono dal quartiere scelto;
//   · nel borgo la via principale resta, come passeggiata;
//   · il giro corto del borgo cade nella fascia in cui i posti della lista sono aperti.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { leggiLista, quoteLista, completaLista, QUOTE } from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';
import { kmTra } from '../../lib/cityKnowledge';
import { fetchCityKnowledge, fetchQuartiereKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';

// ─── la lista: quote, completamento, simbolo ─────────────────────────────────
const posto = (nome, categoria, extra = {}) => ({ nome, momento: 'mattina', tipo: 'da locale', categoria, ...extra });

describe('C10b3 — le quote della lista e il completamento', () => {
    const scarsa = [
        posto('Cattedrale', 'chiesa', { tipo: 'essenziale', simbolo: true }), posto('Castello', 'monumento', { tipo: 'essenziale' }), posto('Museo Civico', 'museo', { tipo: 'essenziale' }),
        posto('Bar Centrale', 'colazione', { momento: 'colazione' }), posto('Trattoria Uno', 'ristorante', { momento: 'pranzo' }), posto('Trattoria Due', 'ristorante', { momento: 'cena' }),
        posto('Pub Notte', 'dopocena', { momento: 'dopocena' }), posto('Mercato', 'mercato', { giorni: 'lun–sab', orari: '7–14' }),
        posto('Piazza Uno', 'piazza'), posto('Piazza Due', 'piazza'), posto('Belvedere', 'belvedere'),
    ];
    it('le quote: piazze e belvedere contano al massimo 2 fra i luoghi da visitare; mancano luoghi da visitare', () => {
        const l = leggiLista(JSON.stringify({ posti: scarsa }), 'Catania', 'città');
        const q = quoteLista(l, 'città');
        expect(q.piazzeBelvedere).toBe(3);
        expect(q.visite).toBe(5); // 3 + 2 piazze/belvedere contate
        expect(q.mancano).toBe(QUOTE.visiteMin - 5);
        expect(q.mancate.join(' ')).toMatch(/luoghi da visitare ≥ 8 \(5\)/);
    });
    it('una lista senza abbastanza luoghi da visitare viene completata: una sola richiesta, solo luoghi da visitare, niente doppioni', async () => {
        const l = leggiLista(JSON.stringify({ posti: scarsa }), 'Catania', 'città');
        const chiedi = vi.fn(async () => JSON.stringify({ posti: [
            posto('Teatro Massimo Bellini', 'monumento'), posto('Monastero dei Benedettini', 'chiesa'), posto('Villa Bellini', 'giardino'),
            posto('Cattedrale', 'chiesa'), posto('Bar Altro', 'colazione'), posto('Palazzo Biscari', 'palazzo'), posto('Piazza Tre', 'piazza'),
        ] }));
        const r = await completaLista({ posti: l, scala: 'città', citta: 'Catania', giorno: '2026-10-15', chiedi });
        expect(chiedi).toHaveBeenCalledTimes(1);
        expect(chiedi.mock.calls[0][0].system).toMatch(/mancano 3 LUOGHI DA VISITARE/);
        expect(r.completamento.aggiunti).toEqual(['Teatro Massimo Bellini', 'Monastero dei Benedettini', 'Villa Bellini']);
        expect(r.quoteDopo.visite).toBe(8);
        expect(r.quoteDopo.mancano).toBe(0);
        // le aggiunte non sono ancore, non sono simbolo
        expect(r.posti.filter(p => p.completamento).every(p => p.tipo === 'da locale' && !p.simbolo)).toBe(true);
        // una lista gia' bilanciata non chiede niente
        const chiedi2 = vi.fn();
        await completaLista({ posti: r.posti, scala: 'città', citta: 'Catania', giorno: '2026-10-15', chiedi: chiedi2 });
        expect(chiedi2).not.toHaveBeenCalled();
    });
    it('metropoli: un quartiere principale con meno di 3 luoghi da visitare chiede i suoi', async () => {
        const l = leggiLista(JSON.stringify({ posti: [
            ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n => posto(`Chiesa ${n}`, 'chiesa', { quartiere: 'Monti' })),
            posto('Santa Maria in Trastevere', 'chiesa', { quartiere: 'Trastevere', tipo: 'essenziale', simbolo: true }),
            posto('Colosseo', 'monumento', { quartiere: 'Monti', tipo: 'essenziale', simbolo: true }),
        ] }), 'Roma', 'metropoli');
        expect(quoteLista(l, 'metropoli').mancanoQuartieri).toEqual({ Trastevere: 2 });
        const chiedi = vi.fn(async () => JSON.stringify({ posti: [posto('Villa Farnesina', 'museo', { quartiere: 'Trastevere' }), posto('Orto Botanico', 'giardino', { quartiere: 'Trastevere' })] }));
        const r = await completaLista({ posti: l, scala: 'metropoli', citta: 'Roma', giorno: '2026-10-15', chiedi });
        expect(chiedi.mock.calls[0][0].system).toMatch(/2 nel quartiere Trastevere/);
        expect(r.quoteDopo.perQuartiere.Trastevere).toBe(3);
    });
    it('il simbolo non può essere un locale (né un essenziale può esserlo): passa al primo luogo da visitare', () => {
        const l = leggiLista(JSON.stringify({ posti: [
            posto('Caffè Storico', 'colazione', { tipo: 'essenziale', simbolo: true, momento: 'colazione' }),
            posto('Piazza Grande', 'piazza', { tipo: 'essenziale' }),
            posto('Duomo', 'chiesa', { tipo: 'essenziale' }),
        ] }), 'Lecce', 'città');
        const caffe = l.find(p => p.nome === 'Caffè Storico');
        expect(caffe.tipo).toBe('da locale');
        expect(caffe.simbolo).toBeUndefined();
        expect(l.find(p => p.nome === 'Piazza Grande').simbolo).toBeUndefined(); // una piazza non e' un simbolo
        expect(l.find(p => p.nome === 'Duomo')).toMatchObject({ simbolo: true, simboloDedotto: true });
    });
});

// ─── il motore intero ────────────────────────────────────────────────────────
const g = (name, lat, lng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, Italia`,
    geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL',
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 300, ...extra,
});
const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };

describe('C10b3 — il motore: ricerche dal quartiere, borgo con la via e la fascia aperta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => {
        vi.unstubAllGlobals(); vi.useRealTimers();
        vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
        vi.mocked(fetchQuartiereKnowledge).mockReset(); vi.mocked(fetchQuartiereKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
    });

    it('in metropoli le ricerche iniziali partono dal quartiere scelto, non dal centro città', async () => {
        const ROMA_C = { latitude: 41.8967068, longitude: 12.4822025, isSmallTown: false, radiusKm: 10 };
        const ess = (name, lat, lng, quartiere) => ({ ...g(name, lat, lng, { primary_type: 'church', types: ['church'] }), _citta: { tipo: 'essenziale', momento: 'mattina', quartiere } });
        const lista = [ess('Santa Maria in Trastevere', 41.8895, 12.4699, 'Trastevere'), ess('Santa Cecilia', 41.8875, 12.4760, 'Trastevere'), ess('Villa Nord', 41.930, 12.480, 'Nord')];
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: lista });
        const ricerche = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
                if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-nessuno', moment: 'g1-mattina' }] }) } }] }) };
            }
            if (u.includes('textsearch')) {
                const sp = new URL(u, 'http://x').searchParams;
                ricerche.push({ q: sp.get('query'), location: sp.get('location'), radius: sp.get('radius') });
                return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
            }
            return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', candidates: [] }) };
        }));
        const r = await aiRecommendationService.generateItinerary('Roma', { duration: '1 Giorno' }, 'Domani una giornata a Trastevere', {}, '', ROMA_C, { pathType: 'custom', skipUserQuota: true });
        const iniziali = ricerche.filter(x => /piazza storica|trattoria tipica/.test(x.q || ''));
        expect(iniziali.length).toBeGreaterThan(0);
        const centro = r._citta?.centroRicerche;
        expect(centro).toBeTruthy();
        for (const x of iniziali) {
            const [lat, lng] = x.location.split(',').map(Number);
            expect(kmTra({ latitude: lat, longitude: lng }, { latitude: 41.8885, longitude: 12.47295 })).toBeLessThan(0.05); // il centro di Trastevere
            expect(x.radius).toBe('2000');
        }
    });

    // un borgo: la lista ha una chiesa e un museo (aperti solo il pomeriggio) e la via principale (per Google una via: «route»)
    const TR = { latitude: 37.7823936, longitude: 14.5949418, isSmallTown: true, radiusKm: 5 };
    const pomeriggio = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '1600' }, close: { day: d, time: '1900' } })) };
    const vicino = (name, dLat, dLng, extra) => g(name, TR.latitude + dLat, TR.longitude + dLng, { formatted_address: `${name}, 94018 Troina EN, Italia`, user_ratings_total: 40, utc_offset_minutes: 120, ...extra });
    const LISTA_BORGO = [
        { ...vicino('Chiesa Madre', 0.003, 0.006, { primary_type: 'church', types: ['church'], opening_hours: pomeriggio }), _citta: { tipo: 'essenziale', momento: 'pomeriggio', simbolo: true, categoria: 'chiesa' } },
        { ...vicino('Museo Civico', 0.0036, 0.0079, { primary_type: 'museum', types: ['museum'], opening_hours: pomeriggio }), _citta: { tipo: 'da locale', momento: 'pomeriggio', categoria: 'museo' } },
        { ...vicino('Via Conte Ruggero', 0.0025, 0.004, { types: ['route'] }), _citta: { tipo: 'da locale', momento: 'pomeriggio', categoria: 'via', passeggiata: true } },
    ];
    const borgoFetch = () => vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
            if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-nessuno', moment: 'g1-mattina' }] }) } }] }) };
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
        return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', candidates: [] }) };
    });
    const generaBorgo = () => aiRecommendationService.generateItinerary('Troina', { duration: '1 Giorno' }, 'Domani una giornata a Troina', {}, '', TR, { pathType: 'custom', skipUserQuota: true });

    it('nel borgo la via principale resta, come passeggiata: la regola delle zone non la toglie', async () => {
        // la chiesa e la via: senza la via il giro avrebbe una tappa sola
        const senzaMuseo = LISTA_BORGO.filter(p => p.name !== 'Museo Civico');
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: senzaMuseo });
        vi.stubGlobal('fetch', borgoFetch());
        const r = await generaBorgo();
        expect(r._citta.viaPrincipale).toMatchObject({ nome: 'Via Conte Ruggero' });
        expect(r._momentReport?.tema?.zoneTolte?.map(z => z.nome) || []).not.toContain('Via Conte Ruggero');
        const titoli = r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.title);
        expect(titoli).toContain('Via Conte Ruggero');
    });

    it('il giro corto del borgo cade nella fascia in cui i posti della lista sono aperti (il pomeriggio)', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: LISTA_BORGO });
        vi.stubGlobal('fetch', borgoFetch());
        const r = await generaBorgo();
        const w = r.tourWindow.windows[0];
        const oraRoma = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(d));
        expect(oraRoma(w.start)).toBeGreaterThanOrEqual(16);
        expect(oraRoma(w.end)).toBeLessThanOrEqual(19);
        const titoli = r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.title);
        expect(titoli).toEqual(expect.arrayContaining(['Chiesa Madre', 'Museo Civico']));
        expect(r.days.flatMap(d => d.stops).filter(s => s.tempoLibero)).toEqual([]);
        expect(r.days[0].scalaNote).toBe('Troina si gira in mezza giornata.');
    });
});
