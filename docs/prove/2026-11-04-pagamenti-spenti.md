# PAGAMENTI-SPENTI (T13), 04/11/2026

## Cosa cambia per Ivano
Al lancio l'app non mostra prezzi né pagamenti. Un solo valore, `PAGAMENTI_ATTIVI` in `src/config/pagamenti.js`, è `false`. Per riaccendere i pagamenti in V2 (guide) si cambia quel valore. Nell'app nativa i pagamenti restano spenti anche con il valore a `true` (`isAppNativa()`), per Apple. Il codice non è stato cancellato.

## Strade trovate
| # | Strada | Prima (V1) | Dopo |
|---|---|---|---|
| 1 | Notifiche: pulsante «ACCETTA E PAGA» (`Notifications.jsx`, chiama `create-checkout`) | visibile su ogni notifica `price_offer` | assente; `handleAcceptOffer` esce subito |
| 2 | Notifiche `price_offer` / `payment_confirmed` con importi nel testo (`dataService.js`, lista e realtime) | `price_offer` visibile | filtrate, come le altre di V2 |
| 3 | Avviso a comparsa di `price_offer` in `DashboardUser.jsx` | visibile | non compare |
| 4 | Mappa: cartellina tour con `€prezzo` e pillola prezzo della tappa (`MapPage.jsx`) | visibile se il tour ha prezzo | senza prezzo |
| 5 | `TourLive.jsx`: badge prezzo in euro (rotta `/tour-live`) | visibile | assente |
| 6 | Scheda tour: pillola `€` della tappa (`TourDetails.jsx`) | visibile se la tappa ha prezzo | assente |
| 7 | `BookingSystem.jsx` (finestra «Paga con Stripe»), importata in `TourDetails` ma mai aperta | non raggiungibile | non si apre nemmeno se montata |
| 8 | Dashboard guide, `TourBuilder` (campo prezzo, offerta di prezzo) | già chiuse da `V1LockedGuard` | invariato |

Visibili prima: 4 su 8 (1-3 dipendono da una notifica `price_offer`, che oggi nasce solo dal lato guide; 4-6 da dati con prezzo). Chiavi Stripe lette dal client: nessuna (nessun `VITE_STRIPE`, nessuna libreria Stripe in `package.json`). Rotte di checkout in `App.jsx`: nessuna.

Lato server: da `list_edge_functions` (04/11) `create-checkout` e `stripe-webhook` non sono pubblicate (ci sono openai-proxy v48, places-proxy e funzioni charme). Nessun deploy fatto in questo task.

## Prove
- Vitest: `src/__tests__/config/pagamentiSpenti.test.jsx` (8 test: interruttore spento, app nativa, nessuna chiave o libreria Stripe, nessuna rotta di pagamento, ogni chiamante di `create-checkout` passa dall'interruttore, finestra di prenotazione vuota). Suite completa 3288 test verdi, lint 0 errori, build ok, `banco:guardia` 12/12.
- Playwright (chromium): test 2c in `e2e/smoke.spec.ts` visita `/notifications`, `/map`, `/tour-live`: nessun testo di pagamento, nessuna richiesta verso Stripe o `create-checkout`. 7/7 verdi.

## Costo AI
0 $.

## Cosa NON risolve
- Se in futuro si pubblica `create-checkout`, il server resta chiamabile da un utente con login: l'interruttore è nel client. Prima del V2 va aggiunto un controllo anche lato funzione.
- La pagina Privacy dice già che il codice contiene la predisposizione Stripe (testo onesto, invariato).
- Dati con prezzo già nel database (tour delle guide) restano lì, solo non mostrati.

## Passi che aspettano Ivano
Nessuno. Su iPhone: aprire Notifiche, Mappa e un giro e controllare che non compaia mai un importo in euro.

## Prova sul sito pubblicato
Da compilare dopo il merge (seconda PR).
