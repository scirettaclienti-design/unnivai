// PAGAMENTI-SPENTI — l'interruttore unico dei pagamenti.
// In V1 l'app non chiede soldi: niente Stripe, niente checkout, niente prezzi.
// Per riaccenderli in V2 (guide) si cambia SOLO questo valore: ogni pulsante, pagina e
// chiamata a create-checkout passa da pagamentiVisibili(). Il codice resta, spento.
// Dentro l'app nativa (Capacitor) restano spenti comunque: Apple, linea guida 3.1.1,
// non vuole pagamenti esterni per beni digitali.
import { isAppNativa } from '../lib/appNativa';

export const PAGAMENTI_ATTIVI = false;

export const pagamentiVisibili = () => PAGAMENTI_ATTIVI === true && !isAppNativa();

// Tipi di notifica che esistono solo con i pagamenti attivi.
export const TIPI_NOTIFICA_PAGAMENTO = ['price_offer', 'payment_confirmed'];

// Un prezzo in euro da mostrare, oppure null quando i pagamenti sono spenti.
export const prezzoDaMostrare = (valore) =>
    pagamentiVisibili() && Number(valore) > 0 ? Number(valore) : null;
