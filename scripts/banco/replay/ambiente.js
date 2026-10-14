// C10c-replay — l'ambiente del replay: nessun indirizzo vero, nessun canale di rete. Gli indirizzi dei proxy puntano a un
// dominio che non esiste (.invalid): se qualcosa sfuggisse al `fetch` del replay non arriverebbe da nessuna parte.
// XMLHttpRequest e WebSocket lanciano. Il `fetch` lo mette replay.giro.js, caso per caso, dal tracciato.
import { vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://replay.invalid');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'replay');
vi.stubEnv('VITE_PLACES_PROXY_URL', 'https://replay.invalid/functions/v1/places-proxy');
vi.stubEnv('VITE_OPENAI_API_KEY', '');

class Vietato {
    constructor() { throw new Error('replay: uscita in rete vietata (XMLHttpRequest/WebSocket)'); }
}
vi.stubGlobal('XMLHttpRequest', Vietato);
vi.stubGlobal('WebSocket', Vietato);
// fino al primo caso, nessuna rete: il replay mette il suo fetch
vi.stubGlobal('fetch', async (url) => { throw new Error(`replay: uscita in rete vietata prima del caso (${String(url).slice(0, 120)})`); });
