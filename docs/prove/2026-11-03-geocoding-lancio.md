# GEOCODING-LANCIO — le curiosità del cammino non dipendono più da Nominatim (03/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-notte-geocoding-lancio` (verificata con `pwd`), ramo `notte/geocoding-lancio` da `origin/main` (`e7c3fc8`). Uniti su main: `9a69457` (Google + memoria per zona) e `81cacb8` (la riserva Nominatim parte solo se mancano i nomi). **openai-proxy è alla v48** (da `81cacb8`; la v46 era identica a `e7c3fc8`; la v48 scaricata è identica ai file del repo). Nessuna migrazione, nessun secret, places-proxy non toccato.

## Cosa cambia per Ivano
- Via e quartiere per le curiosità li trova il **server** con il geocoding inverso di Google (stessa chiave `GOOGLE_MAPS_API_KEY` di places-proxy, già sul progetto). Il telefono non chiede più Nominatim a ogni richiesta: lo chiede solo se il server risponde «nomi non trovati» (Google e Photon giù).
- **Memoria per zona** condivisa fra gli utenti: celle di ~100 m, tabella già esistente `places_cache` (nessuna migrazione), 7 giorni, più una memoria dell'istanza. Chi cammina dove un altro è già passato non fa nessuna richiesta esterna.
- Se i nomi di Google non portano a nessun quartiere (a Catania Google dice solo «Centro», non Giudecca, Civita, San Berillo) parte UNA richiesta a Photon per i soli nomi dei quartieri. Senza, Catania perdeva 5 candidati su 9 nei punti misurati.
- Testi aggiornati (`testiAccount.js`): Google fa anche via e quartiere; Nominatim solo se Google non risponde.

## Come funziona e che cosa permette Google
`places-proxy` inoltra solo `place/findplacefromtext|details|textsearch|nearbysearch|photo` (e la ricerca «new»), con la chiave del server; **non ha un endpoint di geocoding**: aggiungerlo vorrebbe dire ripubblicare places-proxy (vietato a me). Perciò `openai-proxy` chiama direttamente `maps.googleapis.com/maps/api/geocode/json?latlng=…&result_type=route|neighborhood|sublocality&language=it` con lo stesso secret (i secret sono del progetto). Funziona: nella prova sul sito pubblicato ogni richiesta ha avuto 1 risposta di Google, nessuna diagnosi d'errore.
- **Prezzo** (listino letto oggi, `developers.google.com/maps/billing-and-pricing/pricing`, «Last updated 2026-11-02»): Geocoding **10.000 richieste gratis al mese**, poi 5,00 $ ogni 1.000 (fino a 100.000), 4,00 $ fino a 500.000, 3,00 $ fino a 1 milione.
- **Condizioni** (Service Specific Terms, 6.3): 6.3.1 si possono tenere latitudine e longitudine fino a 30 giorni; 6.3.2 indirizzo e campi strutturati si possono tenere «solo per la funzione rivolta all'utente che ha fatto la richiesta», **non come sostituto di una nuova chiamata e mai fra utenti diversi**. Quindi **una memoria condivisa dei nomi di via e quartiere di Google non è consentita**. Per questo la memoria per zona tiene solo il risultato già verificato su Wikipedia (pageid, titolo, tipo di voce), mai un testo di Google; la prova lo controlla (`Giudecca`, il quartiere di Google, non compare nella riga salvata). È una lettura prudente ma non un parere legale: se Ivano la ritiene ancora troppo vicina, il rimedio è una costante (`TTL_CELLA_MS`) o togliere la scrittura in `places_cache`, e il costo sale come nel caso «a freddo» qui sotto.

## Prove (rete vera; l'orologio e la voce finti dello script esistente)
Richieste esterne per le stesse 18 richieste di curiosità dei tre giri del 02/11 (Trastevere 7, Monti 6, Catania 5), contate con `scripts/prova-nav/geocoding-conteggio.mjs` (stesso codice di v43 e v48 su rete vera):

| | Nominatim | Photon | Google | Wikipedia |
|---|---|---|---|---|
| PRIMA (v43, telefono + server) | **18** | 0 | 0 | 71 |
| DOPO, primo utente (memoria vuota) | 0 | 4 (solo Catania) | 17 | 65 |
| DOPO, secondo utente (stessi giri) | 0 | 1 | 4 | 18 |

Prova WebKit sul sito pubblicato (`curiosita-quartieri.webkit.mjs`, GPS finto, giri Trastevere e Catania; il conteggio lo dà il server nella risposta, campo `richieste`):

| | curiosità uscite | richieste al proxy | Nominatim | Photon | Google | Wikipedia |
|---|---|---|---|---|---|---|
| PRIMA Trastevere / Catania | 2 / 5 | 7 / 5 | 7 / 5 (telefono) | — | — | non visibile (71 dal conteggio sopra) |
| DOPO primo passaggio | **2 / 5** | 8 / 5 | 1 / 0 | 0 / 5 | 7 / 5 | 31 / 29 |
| DOPO secondo passaggio (zone già note) | **2 / 5** | 7 / 5 | 0 / 0 | 0 / 0 | 1 / 0 | 5 / 0 |

Le curiosità **non calano** (2 e 5 prima e dopo; ieri 3 e 4: la differenza è del giorno, non del cambio). 0 ripetute, almeno 10 minuti fra una e l'altra. Il «1» di Nominatim nel primo passaggio di Trastevere era la riserva scattata per un errore di Wikipedia (non dei nomi): corretto con `81cacb8`; nel secondo passaggio 0. Dati: `docs/prove/dati/2026-11-03-geocoding-{prima,dopo,dopo2}.json` e `…-conteggio-{prima,dopo}.json`.

**Collaudo completo** sul sito pubblicato dopo la v48 (`2026-11-03-collaudo-sito-geocoding.json`): punti 1, 2, 3, **4 (curiosità del cammino)**, 6, 8, 9, 10, 11, 12, 13 ok; il 5 mostra le schede con racconto; il 7 da ospite cade, come atteso. Nessun peggioramento. Vercel READY, CI verde su `9a69457` e `81cacb8`; guardia 12/12, nessun ❌ nuovo (3 noti).

## Costo per 1.000 giri
Un giro medio (~50 minuti) fa circa 6 richieste di curiosità (18 su 3 giri). Listino sopra.
- **A freddo** (nessuna zona nota): ~5.700 richieste Google = **0 $ se restano nei 10.000 gratuiti del mese** (circa 1.750 giri al mese), altrimenti 5 $ ogni 1.000 richieste, cioè **~28 $ ogni 1.000 giri**.
- **Con la memoria**: ogni zona costa una volta per 7 giorni. Misurato sul secondo passaggio degli stessi giri: 4 richieste Google su 18 (–78%), cioè ~6 $ ogni 1.000 giri oltre la quota gratuita. In città piene (Roma centro, Catania) i percorsi si ripetono molto; la percentuale vera la darà l'uso (conteggio nel log: riga `curiosità: fonti memoria-zona|nuove richieste google=…`).
- Prima: ~6.000 richieste Nominatim ogni 1.000 giri, che il limite di 1 al secondo (e il divieto di uso pesante) non regge. Photon (solo Catania e riserva) e Wikipedia (~4 per richiesta, ma 0 con la zona nota) restano gratuiti.
- **Costo AI del task**: 0,0475 $ (3 curiosità nuove scritte nella prova «prima»; `place_racconti.costo_usd`); le prove dopo hanno riusato la cache. Tetto 0,50 $ rispettato.

## Gli altri usi di Nominatim (decisione)
- `useEnhancedGeolocation` (città): usa **già** Google per primo, Nominatim solo se Google fallisce. Non serve toccarlo.
- `CityContext` (città dal GPS, una richiesta a ogni apertura con GPS), `AddressAutocomplete` (ricerca indirizzo mentre si digita), `DashboardBusiness` e `dataService` (indirizzo di un'attività): usano ancora Nominatim dal telefono. **Non li ho toccati** (fuori dal task). Il più esposto al lancio è `CityContext`: una richiesta per apertura, tutte dallo stesso servizio con il limite di 1 al secondo per IP (ogni telefono ha il suo IP, quindi regge molto meglio delle curiosità). Proposta: stesso passaggio a Google con Nominatim di riserva.
- `userContextService.reverseGeocodeCity` usa già Google.

## Cosa NON risolve
- Il costo di Google sopra i 10.000 gratuiti: dipende da quanto le zone si ripetono.
- A Catania ogni zona nuova costa anche una richiesta a Photon; Photon è un servizio gratuito di komoot a uso equo: se diventasse un limite, la strada è un elenco dei quartieri per città scritto a mano.
- La cella dà risultati dal centro della zona (fino a ~70 m dal telefono): una via parallela vicina può passare per quella dove si cammina. Le voci restano verificate per nome e coordinate come prima.
- Gli errori di Wikipedia (qualche richiesta su 20 risponde «occupato» anche dopo 3 tentativi) restano: non si ricordano e si riprova alla richiesta dopo.
- La lettura sulle condizioni d'uso di Google non è un parere legale.

## Passi che aspettano Ivano
- Niente di bloccante. Facoltativo: decidere sulla memoria condivisa (sopra) e sul passaggio di `CityContext` a Google.
- Facoltativo, per tenere il conto: nella console di Google Cloud verificare che la chiave del server abbia «Geocoding API» tra le API consentite (oggi risponde, quindi lo è) e mettere un avviso di spesa.
- Su iPhone: camminare 5 minuti a Trastevere o a Catania centro con la voce accesa; la curiosità arriva dopo 300 m come prima; in modalità aereo/senza rete a metà strada non cambia nulla rispetto a ieri.
