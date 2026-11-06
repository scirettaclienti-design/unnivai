# PROFILO-SEZIONI (T28) — nel Profilo ogni sezione funziona o non si vede

Ramo `notte/profilo-sezioni`. Nessuna migrazione, nessuna funzione del server, nessun secret, nessun deploy.

## Cosa cambia per Ivano

- **Mete**: funziona con dati veri. Ora si apre per prima. Un giro rifatto conta come una Meta nuova. L'elenco si ferma a 5, poi «Vedi tutte».
- **Risultati**: prima era una frase fissa, senza dati. Ora mostra giri finiti, città, tappe raggiunte e km, con i traguardi presi e il prossimo. Mostra anche dove hai girato e dove ti fermi di più. Senza dati: tutto a zero e il primo traguardo.
- **Rivivi**: prima leggeva le foto (`user_photos`, 0 righe), quindi non ha mai mostrato niente. Ora ogni giro finito ha il tracciato, la data e le tappe raggiunte. Aperta la scheda: mappa vera, tappe una per una, «Rifai questo giro».
- **Richieste**: non si vede più, né sul web né nell'app. Il pannello resta pronto per V2 in `components/RichiesteGuide.jsx`, come le pagine dietro `V1LockedGuard`.
- **DNA**: le quattro schede (Il tuo DNA, I tuoi interessi, Come giri, A tavola) hanno il marchio.
  - Ogni gusto ha la percentuale grande e una parola: Forte, Medio, Leggero, Non conta.
  - Una legenda dice come si legge e cosa fanno + e −.
  - Una riga dice quanto il DNA guida davvero i giri, dalla fiducia vera.
  - Dopo un + l'esito sta sotto quel gusto: «Fatto: più natura. 29% → 44%».
  - Il tasto Salva dice lo stato: arancione con «Modifiche non ancora salvate», poi spento con «Salvato».
  - I pesi del DNA non cambiano.

**Un limite da sapere**: Rivivi vale per i giri finiti da adesso. Quelli di prima hanno nel registro solo città e numeri, quindi restano nelle Mete. Rivivi lo dice.

## Dove sta l'istantanea del giro

Il registro `dna_events` non ha le tappe, e la tabella `completed_tours` (0 righe, mai usata) ha solo l'id. Una colonna nuova avrebbe richiesto una migrazione, vietata stanotte.

Quindi a giro completato MapPage scrive l'istantanea in `saved_tours`, con `tour_id` «fatto-…» e `fatta` su ogni tappa.

- Non è un «salvato»: non registra `tour_saved`, il DNA non ne sa niente e `leggiGiriSalvati` la esclude.
- Stesse regole di accesso dei giri salvati. L'eliminazione dell'account la cancella: FK `ON DELETE CASCADE`, nessuna tabella nuova in `elimina_dati_utente`.
- La privacy dice ora che teniamo anche i giri finiti con le loro tappe (`testiAccount.js`; la data della bozza non è cambiata).
- Se la scrittura non riesce il giro resta nelle Mete e non compare in Rivivi: nessun nuovo tentativo.

**Proposta**: una colonna `completed_at` su `saved_tours` sarebbe più pulita del prefisso. Non serve per il lancio.

## Rifai questo giro

Stesse tappe, nessuna generazione (0 $ di AI). Gli orari restano quelli sull'orologio: oggi se la prima tappa è ancora da venire, altrimenti domani. Il giro ha un id nuovo, quindi lascia la sua Meta e la sua riga. `openNow` e `currentHours` si tolgono perché valevano quel giorno.

## Prove

Script: `scripts/prova-nav/profilo-sezioni.webkit.mjs`. WebKit iPhone 14, vite locale su porta libera 4371, cwd e titolo verificati prima delle credenziali. Esiti: `docs/prove/dati/2026-11-07-profilo-sezioni.json`.

| Parte | Account | Esito |
|---|---|---|
| `vero` | account di prova, Supabase vero | giro «Tour di Catania» percorso col GPS finto (4/4), contatori 53 → 54; 72 tasti censiti, 46 toccati, 0 difetti |
| `vero`, Rifai | account di prova, Supabase vero | Rifai fino alla fine giro: giri 54 → 55, tappe 321 → 324, righe di Rivivi 2 → 3 |
| `nuovo` | account nuovo vuoto, simulato | stati vuoti; 58 tasti censiti, 56 toccati, 0 difetti |
| `ospite` | ospite anonimo, simulato | stati vuoti; 58 tasti censiti, 56 toccati, 0 difetti |
| `finto` | account con giri, simulato | tracciato al posto della mappa senza Google; + scrive una riga e mostra 29% → 44%; Salva passa a «Salvato»; 64 tasti censiti, 61 toccati, 0 difetti |

I tasti non toccati:

- sempre «Esci» ed «Elimina account»;
- sul Supabase vero anche quelli che scrivono (+, −, Azzera, Rimuovi, Salva), provati sul simulato;
- «Azzera tutto» su `finto`: il censimento lo ha trovato, ma al momento del tocco non c'era più. Lo copre il test unitario.

Altri esiti:

- **Collaudo** (tocca la fine giro): punti 6 e 7 di `collaudo-sito.webkit.mjs` su questo codice, in locale: 6 ok (49 s), 7 ok da account e da ospite (31 s).
- **Suite**: 3589 test su 290 file, tutti verdi. Lint: 0 errori. Build ok.
- **Guardia**: 12/12, banco 10/10, pertinenza senza ❌ nuovi (3 già noti).

**Quello che le prove reali non hanno coperto**: i due giri veri (il «Tour di Catania» salvato e il giro di collaudo di Roma) non hanno orari salvati. Lo spostamento degli orari di Rifai e la riga con l'ora nella scheda sono provati solo dai test unitari (`giriFatti.test.js`, `profilo_dna6.test.jsx`), non in WebKit.

**Dati scritti in produzione**: solo account di prova, con gli stessi effetti di un giro vero. Righe in `dna_events` e 3 istantanee in `saved_tours`. In più il primo giro di Catania è stato percorso due volte (una durante la messa a punto): per questo il contatore è passato da 51 a 55 nell'arco del lavoro, compresi i collaudi.

### Schermate

Cartella `docs/prove/schermate/2026-11-07-profilo-sezioni/`. Le email sono mascherate prima dello scatto.

- `vero-01…09`: Profilo, DNA, interessi, come giri, a tavola, Mete, Risultati, Rivivi con l'account di prova
- `vero-10-fine-giro`, `vero-11-rivivi-scheda`, `vero-12-rivivi-tappe`, `vero-13-rifai-mappa`, `vero-14-dopo-rifai`
- `nuovo-01…09`, `ospite-01…09`: gli stati vuoti
- `finto-01…09`, `finto-11-rivivi-senza-google`, `finto-12-dna-dopo-piu`, `finto-13-interessi-da-salvare`, `finto-14-interessi-salvati`

## Costo

Nessuna generazione (0 in `ai_generation_ticket`), nessun racconto nuovo (0 in `place_racconti`), voce del telefono. Restano Google Maps e Directions delle pagine aperte: **stima 0,2–0,3 $ a listino**, non letta dalla fattura. Tetto 3 $.

## Cosa NON risolve

- I giri finiti prima di oggi non hanno mappa né tappe.
- La mappa di Rivivi unisce le tappe in linea retta, come la fine giro: non è il percorso camminato. Il percorso vero si vede dopo «Rifai».
- I km dei Risultati sono in linea d'aria e le righe vecchie non li hanno: il numero è per difetto, e la schermata lo dice.
- Rifai non controlla se un posto è chiuso nel giorno nuovo.
- Un giro salvato percorso due volte lo stesso giorno ha due Mete ma una sola riga in Rivivi: l'id viene dal giro e dal giorno. Con «Rifai» le righe sono due.
- **Tetto di lettura**: `REGISTRO_LETTURA_MAX` = 1000 righe. Oltre, Mete, Risultati e contatori contano meno del vero. L'account di prova è a circa 770.
- «Foto» nella barra in basso porta sul web alla pagina «in costruzione» (ha il suo contenuto; nell'app non c'è). È in tutte le pagine, non l'ho toccata.
- Il link alle notifiche in alto non ha un nome per la lettura a voce.

## Difetti del DNA visti, per T29 (non toccati)

1. **Saltare pesa il doppio di raggiungere**: `stop_skipped` vale −0,10, `stop_reached` +0,05. L'account di prova ha 238 tappe di cultura raggiunte e Cultura al 17%, senza correzioni su cultura. Il sospetto, non misurato, sono i salti dei collaudi.
2. **Tre gusti al 100%**: Cibo, Natura e Arte toccano il tetto e non si distinguono più fra loro.
3. **«−» a 0% lascia un debito nascosto**: il peso grezzo va sotto zero, a schermo resta 0% e un «+» subito dopo non muove niente. La scheda ora lo dice, la logica è invariata.
4. **Le correzioni si attenuano** come ogni evento (metà in 30 giorni): un +15 fra due mesi vale meno di 4 punti. La legenda dice che il peso si attenua col tempo.
5. **`giriDalRegistro` (`dnaRitmo.js`) raggruppa per `tour_id`**: un giro salvato percorso due volte diventa un giro solo per il ritmo appreso. L'ho corretto solo per le Mete. Rifai ha un id nuovo e non ne soffre.
6. Il tetto di 1000 righe vale anche per i pesi.

## Altro

- Il controllo di Supabase segnala `public.spatial_ref_sys` senza RLS: è la tabella di sistema di PostGIS, non l'ho toccata. Da decidere con Ivano, senza fretta.
- `completed_tours` ha i permessi larghi per `anon` e `authenticated` (senza policy di scrittura la RLS blocca comunque): è vuota e mai usata.

## Passi che aspettano Ivano

Nessun comando. Da guardare su iPhone vero, solo se vuole: la mappa della scheda di Rivivi dentro l'app (stessa chiave della mappa del giro).
