#!/usr/bin/env node
/**
 * APP-NATIVA — l'account demo per il revisore Apple. Lo lancia SOLO Ivano: crea un utente in produzione.
 *
 * L'account demo è un utente normale con `app_metadata.unnivai_demo_revisore = true` (src/lib/demoRevisore.js):
 * vede la scheda «Giro di prova per la revisione» e il giro di Catania con «Simula il cammino». `app_metadata` lo
 * scrive solo il server: nessun utente può accendersi il flag da solo.
 *
 * Due strade, a scelta:
 *
 *  A) Script con la chiave service role (mai nel repo, mai stampata):
 *       DEMO_EMAIL=… DEMO_PASSWORD=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/ios/account-demo.mjs --crea
 *     Crea l'utente con email già confermata, ruolo explorer e il flag; se l'email esiste già, accende solo il flag.
 *
 *  B) Registrazione dall'app o dal sito come un utente qualunque, poi una riga nel SQL Editor di Supabase:
 *       node scripts/ios/account-demo.mjs --sql revisore@esempio.it      → stampa la riga da incollare
 *
 *  Controllo (con la chiave service role): node scripts/ios/account-demo.mjs --controlla  → quanti account hanno il flag (deve essere 1)
 *
 * Senza argomenti non fa niente e spiega. Dopo aver acceso il flag, il revisore (o Ivano) deve uscire e rientrare:
 * il flag viaggia nel token di accesso.
 */
import { fileURLToPath } from 'node:url';

export const FLAG = 'unnivai_demo_revisore';
const URL_PROGETTO = process.env.VITE_SUPABASE_URL || 'https://ahecpiwsdhghkndncejb.supabase.co';

export function corpoUtenteDemo(email, password) {
    return {
        email,
        password,
        email_confirm: true,
        app_metadata: { [FLAG]: true },
        user_metadata: { role: 'explorer', full_name: 'Revisore Apple' },
    };
}

const emailValida = (e) => typeof e === 'string' && /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(e);

export function sqlFlag(email) {
    if (!emailValida(email)) throw new Error('email non valida');
    return `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"${FLAG}": true}'::jsonb where email = '${email.toLowerCase()}';`;
}

async function admin(percorso, { metodo = 'GET', corpo } = {}) {
    const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!chiave) throw new Error('manca SUPABASE_SERVICE_ROLE_KEY nell\'ambiente');
    const r = await fetch(`${URL_PROGETTO}/auth/v1/admin/${percorso}`, {
        method: metodo,
        headers: { apikey: chiave, Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dati = await r.json().catch(() => null);
    return { stato: r.status, dati };
}

async function tuttiGliUtenti() {
    const utenti = [];
    for (let pagina = 1; pagina < 50; pagina++) {
        const { stato, dati } = await admin(`users?page=${pagina}&per_page=200`);
        if (stato !== 200) throw new Error(`elenco utenti: HTTP ${stato}`);
        const lista = dati?.users || [];
        utenti.push(...lista);
        if (lista.length < 200) break;
    }
    return utenti;
}

async function crea() {
    const email = process.env.DEMO_EMAIL;
    const password = process.env.DEMO_PASSWORD;
    if (!emailValida(email) || !password || password.length < 10) {
        throw new Error('servono DEMO_EMAIL (valida) e DEMO_PASSWORD (almeno 10 caratteri) nell\'ambiente');
    }
    const { stato, dati } = await admin('users', { metodo: 'POST', corpo: corpoUtenteDemo(email, password) });
    if (stato === 200 || stato === 201) {
        console.log(`Creato l'account demo (id ${dati?.id}). Flag acceso.`);
        return;
    }
    const esiste = stato === 422 || /already|exists/i.test(JSON.stringify(dati || {}));
    if (!esiste) throw new Error(`creazione: HTTP ${stato}`);
    const utente = (await tuttiGliUtenti()).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!utente) throw new Error('l\'email risulta già usata ma non trovo l\'utente');
    const app = { ...(utente.app_metadata || {}), [FLAG]: true };
    const agg = await admin(`users/${utente.id}`, { metodo: 'PUT', corpo: { app_metadata: app } });
    if (agg.stato !== 200) throw new Error(`aggiornamento: HTTP ${agg.stato}`);
    console.log(`L'account esisteva (id ${utente.id}): flag acceso. La password non è stata cambiata.`);
}

async function controlla() {
    const conFlag = (await tuttiGliUtenti()).filter((u) => u.app_metadata?.[FLAG] === true);
    console.log(`Account con il flag del revisore: ${conFlag.length}${conFlag.length === 1 ? ' (giusto)' : ' (deve essere 1)'}`);
    process.exit(conFlag.length === 1 ? 0 : 1);
}

const principale = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (principale) {
    const [cmd, arg] = process.argv.slice(2);
    try {
        if (cmd === '--crea') await crea();
        else if (cmd === '--sql') console.log(sqlFlag(arg));
        else if (cmd === '--controlla') await controlla();
        else {
            console.log('Niente fatto. Uso:');
            console.log('  DEMO_EMAIL=… DEMO_PASSWORD=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/ios/account-demo.mjs --crea');
            console.log('  node scripts/ios/account-demo.mjs --sql <email>     (riga per il SQL Editor, dopo la registrazione dall\'app)');
            console.log('  SUPABASE_SERVICE_ROLE_KEY=… node scripts/ios/account-demo.mjs --controlla');
        }
    } catch (e) {
        console.error(`Errore: ${e.message}`);
        process.exit(1);
    }
}
