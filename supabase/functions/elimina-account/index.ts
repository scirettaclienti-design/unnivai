/**
 * ACCOUNT-PRIVACY — «Elimina account» dal Profilo (linea guida Apple 5.1.1(v): la cancellazione parte dall'app).
 *
 * Cancellare un utente di auth richiede la service_role, che sta solo qui. La funzione:
 *   1. verifica il JWT del chiamante e ricava l'utente DA LÌ (mai un id nel corpo): si cancella solo se stessi;
 *   2. chiede una conferma esplicita nel corpo ({ "conferma": "elimina" });
 *   3. public.elimina_dati_utente(): i dati dell'utente in una transazione (migrazione 20261103010000_elimina_account.sql);
 *   4. toglie da Storage i file di cui l'utente è proprietario (tour-images, business-media);
 *   5. cancella l'utente di auth (sessioni, identità e le righe a cascata se ne vanno con lui).
 * L'ordine tiene l'utente di auth per ultimo: se un passo si ferma, il JWT vale ancora e si può rifare (ogni passo è ripetibile).
 *
 * Risposte: 200 { esito: 'eliminato' } · 401 token mancante o non valido · 400 conferma mancante · 405 · 503 { code: 'MIGRAZIONE_MANCANTE' }
 * (la funzione SQL non c'è ancora sul database) · 500 { code: 'DATI' | 'STORAGE' | 'ACCOUNT' }. Mai un «fatto» se un passo è fallito.
 * Nei log niente email, niente token: solo l'esito e un id troncato.
 *
 * Deploy (da Ivano, dopo `supabase db push` della migrazione):
 *   supabase functions deploy elimina-account --project-ref ahecpiwsdhghkndncejb --use-api
 * (con la verifica del JWT del gateway accesa, di difetto: serve un accesso valido, anche anonimo).
 * Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, già presenti nelle funzioni. Nessun secret nuovo.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const PAROLA_DI_CONFERMA = 'elimina';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ errore: 'solo POST' }, 405);

    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ errore: 'Non autorizzato', code: 'NON_AUTORIZZATO' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const chiave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !chiave) {
        console.error('[elimina-account] configurazione mancante');
        return json({ errore: 'configurazione mancante', code: 'CONFIGURAZIONE' }, 500);
    }
    const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. Chi è: lo dice il JWT, non il corpo.
    const { data: dati, error: eUtente } = await db.auth.getUser(token);
    const utente = dati?.user;
    if (eUtente || !utente?.id) return json({ errore: 'Token non valido', code: 'NON_AUTORIZZATO' }, 401);
    const sigla = utente.id.slice(0, 8);

    // 2. La conferma è esplicita: una chiamata a caso non cancella niente.
    let corpo: { conferma?: unknown } = {};
    try { corpo = await req.json(); } catch { /* corpo vuoto: manca la conferma */ }
    if (typeof corpo?.conferma !== 'string' || corpo.conferma.trim().toLowerCase() !== PAROLA_DI_CONFERMA) {
        return json({ errore: 'Manca la conferma', code: 'CONFERMA_MANCANTE' }, 400);
    }

    // 3. I dati, in una transazione.
    const { data: esito, error: eDati } = await db.rpc('elimina_dati_utente', { p_user: utente.id, p_email: utente.email ?? null });
    if (eDati) {
        const manca = eDati.code === 'PGRST202' || eDati.code === '42883' || /could not find the function|does not exist/i.test(eDati.message ?? '');
        console.error(`[elimina-account] ${sigla}… dati non cancellati (${eDati.code ?? 'senza codice'})`);
        return manca
            ? json({ errore: 'La cancellazione non è ancora attiva su questo database.', code: 'MIGRAZIONE_MANCANTE' }, 503)
            : json({ errore: 'I dati non sono stati cancellati.', code: 'DATI' }, 500);
    }

    // 4. I file di Storage (l'API, non una DELETE sulla tabella: i file veri vanno via davvero).
    const file: { bucket: string; name: string }[] = Array.isArray(esito?.files) ? esito.files : [];
    const perBucket = new Map<string, string[]>();
    for (const f of file) {
        if (typeof f?.bucket !== 'string' || typeof f?.name !== 'string') continue;
        perBucket.set(f.bucket, [...(perBucket.get(f.bucket) ?? []), f.name]);
    }
    for (const [bucket, nomi] of perBucket) {
        const { error: eStorage } = await db.storage.from(bucket).remove(nomi);
        if (eStorage) {
            console.error(`[elimina-account] ${sigla}… file non tolti da ${bucket}`);
            return json({ errore: 'I file non sono stati cancellati.', code: 'STORAGE' }, 500);
        }
    }

    // 5. L'utente di auth, per ultimo.
    const { error: eAccount } = await db.auth.admin.deleteUser(utente.id);
    if (eAccount) {
        console.error(`[elimina-account] ${sigla}… utente di auth non cancellato`);
        return json({ errore: 'L\'account non è stato cancellato.', code: 'ACCOUNT' }, 500);
    }

    console.log(`[elimina-account] ${sigla}… eliminato (file: ${file.length})`);
    return json({ esito: 'eliminato' });
});
