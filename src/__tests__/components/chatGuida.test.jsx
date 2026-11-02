// CHAT-VERITA — il telefono: cosa manda la chat al server (domanda, turni, tappe nell'ordine del giro, luogo aperto, prossima tappa),
// come mostra la risposta (testo, fonti lette, «Controllo le fonti…») e i guasti che diventano testi onesti, mai fatti.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { supabase } from '@/lib/supabase';
import { chiediAllaGuida, luogoPerChat, MSG_CHAT_RETE } from '@/services/chatGuidaService';
import { AI_ENGINE_MESSAGE } from '@/lib/aiEngineError';
import { AIDrawer, BENVENUTO_CHAT, TESTO_ATTESA_CHAT } from '@/components/Map/AIDrawer';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const TAPPE = [
    { id: 's1', name: "Fontana dell'Elefante", latitude: 37.50263, longitude: 15.08718, place_id: 'ChIJ_elefante_0001', scheduledTime: '2026-11-02T08:30:00.000Z', stayMinutes: 15 },
    { id: 's2', name: "Cattedrale di Sant'Agata", latitude: 37.50197, longitude: 15.08758, googlePlaceId: 'ChIJ_cattedrale_01', scheduledTime: '2026-11-02T08:50:00.000Z', stayMinutes: 30 },
    { id: 's3', name: 'Senza coordinate' },
    { id: 's4', name: 'Via dei Crociferi', latitude: 37.50497, longitude: 15.08483, place_id: 'ChIJ_crociferi_001' },
];
let corpi;
const risponde = (status, corpo) => vi.fn(async (_u, init) => { corpi.push(JSON.parse(init.body)); return { ok: status === 200, status, json: async () => corpo }; });

beforeEach(() => {
    corpi = [];
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'jwt' } } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('chiediAllaGuida', () => {
    it('manda domanda, turni, tappe nell\'ordine del giro con ora e sosta, il luogo aperto, l\'indice della prossima e il centro', async () => {
        vi.stubGlobal('fetch', risponde(200, { chat: { testo: 'Ciao.', fonti: [{ nome: 'F', titolo: 'F', url: 'https://it.wikipedia.org/wiki/F' }], esito: 'verificata' } }));
        const r = await chiediAllaGuida({
            domanda: 'Chi l\'ha fatta?', citta: 'Catania', tappe: TAPPE, aperto: { name: 'Palazzo Biscari', lat: 37.501, lng: 15.09 }, prossima: TAPPE[3],
            centro: { latitude: 37.503, longitude: 15.087 },
            storia: [{ role: 'assistant', content: 'Chiedimi del giro.' }, { role: 'user', content: 'Ciao' }, { role: 'system', content: 'no' }],
        });
        expect(r).toEqual({ testo: 'Ciao.', fonti: [{ nome: 'F', titolo: 'F', url: 'https://it.wikipedia.org/wiki/F' }], esito: 'verificata' });
        const dv = corpi[0].dv;
        expect(dv.purpose).toBe('chat');
        expect(dv.luoghi.map((l) => l.nome)).toEqual(["Fontana dell'Elefante", "Cattedrale di Sant'Agata", 'Via dei Crociferi']); // ordine del giro, senza la tappa senza coordinate
        expect(dv.luoghi[0]).toEqual({ place_id: 'ChIJ_elefante_0001', nome: "Fontana dell'Elefante", lat: 37.50263, lng: 15.08718, ora: '09:30', sosta: 15 });
        expect(dv.luoghi[1].place_id).toBe('ChIJ_cattedrale_01');
        expect(dv.prossima).toBe(2); // l'indice dopo aver tolto la tappa senza coordinate
        expect(dv.aperto.nome).toBe('Palazzo Biscari');
        expect(dv.centro).toEqual({ lat: 37.503, lng: 15.087 });
        expect(dv.storia).toEqual([{ ruolo: 'guida', testo: 'Chiedimi del giro.' }, { ruolo: 'utente', testo: 'Ciao' }]);
        expect(dv).not.toHaveProperty('fonti'); // le fonti le prende il server
    });

    it('i guasti diventano testi onesti: quota col testo del server, motore fermo, rete', async () => {
        vi.stubGlobal('fetch', risponde(429, { error: 'Oggi Unnivai ha raggiunto il limite di richieste. Domani riparte tutto.', code: 'GLOBAL_AUX_QUOTA_EXCEEDED' }));
        expect((await chiediAllaGuida({ domanda: 'x' })).testo).toBe('Oggi Unnivai ha raggiunto il limite di richieste. Domani riparte tutto.');
        vi.stubGlobal('fetch', risponde(502, { code: 'CHAT_MOTORE' }));
        expect((await chiediAllaGuida({ domanda: 'x' })).testo).toBe(AI_ENGINE_MESSAGE);
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        expect(await chiediAllaGuida({ domanda: 'x' })).toEqual({ testo: MSG_CHAT_RETE, fonti: [], esito: null });
    });

    it('luogoPerChat: senza nome o coordinate niente; l\'ora in Europe/Rome', () => {
        expect(luogoPerChat({ name: 'X' })).toBeNull();
        expect(luogoPerChat({ title: 'Y', lat: 1, lng: 2, scheduledTime: '2026-07-01T10:00:00.000Z' }).ora).toBe('12:00');
    });
});

describe('il cassetto della chat', () => {
    it('benvenuto in voce Unnivai; «Controllo le fonti…» mentre aspetta; la risposta con le fonti lette', async () => {
        let rispondi;
        vi.stubGlobal('fetch', vi.fn((_u, init) => new Promise((ok) => { corpi.push(JSON.parse(init.body)); rispondi = ok; })));
        render(<AIDrawer isOpen onClose={() => {}} selectedPOI={null} activeCity="Catania" tappe={TAPPE} prossima={TAPPE[1]} centro={null} />);
        expect(screen.getByText(BENVENUTO_CHAT(null))).toBeTruthy();
        expect(BENVENUTO_CHAT(null)).not.toMatch(/Ciao!|storie nascoste|curiosità/);
        fireEvent.change(screen.getByPlaceholderText('Scrivi qui...'), { target: { value: "Chi ha fatto la Fontana dell'Elefante?" } });
        fireEvent.keyDown(screen.getByPlaceholderText('Scrivi qui...'), { key: 'Enter' });
        await waitFor(() => expect(screen.getByTestId('chat-attesa').textContent).toBe(TESTO_ATTESA_CHAT));
        expect(corpi[0].dv.storia).toEqual([]); // il benvenuto non è un turno
        expect(corpi[0].dv.prossima).toBe(1);
        rispondi({ ok: true, status: 200, json: async () => ({ chat: { testo: "L'ha realizzata Vaccarini tra il 1735 e il 1737.", esito: 'verificata', fonti: [{ nome: "Fontana dell'Elefante", titolo: "Fontana dell'Elefante", url: 'https://it.wikipedia.org/wiki/Fontana_dell%27Elefante' }] } }) });
        expect(await screen.findByText("L'ha realizzata Vaccarini tra il 1735 e il 1737.")).toBeTruthy();
        expect(screen.getByTestId('chat-fonti').textContent).toContain("Fontana dell'Elefante");
        expect(screen.queryByTestId('chat-attesa')).toBeNull();
    });
});
