# CURIOSITA-CITTA — nessuna curiosità di un'altra città (29/10/2026)

## Diagnosi (scritta prima della correzione)
- **Fonte**: un elenco fisso di 7 frasi, `TESTI.it.curiosita` in `src/lib/vociTesti.js`. Non vengono da AI, dal server né dal tour: sono scritte nel codice, **senza città**.
- **Dove escono**: `MapPage.jsx`, `onNavPosition` («Cultural Surprise»): a piedi o in bici, ogni ~300 m `dire('curiosita')` prende la frase `surpriseCount % 7` e la mostra come toast «🎧 …» (`dvai:toast`); con la voce accesa la legge a voce (`parla`, voce umana via `openai-proxy`). Nient'altro nel codice mostra o legge «curiosità» (le altre occorrenze sono il saluto dell'assistente e un prompt AI per le schede dei monumenti, fuori da questo incarico).
- **Perché Roma esce a Catania**: la frase «Roma ha più di duemila fontanelle pubbliche… nasoni» è nell'elenco comune e nessun codice confronta la città del giro con la frase. Il tour porta `city`, ma `onNavPosition` non lo guarda mai. A Catania, ogni ~300 m a piedi, a rotazione, usciva anche quella (a voce, come fatto falso).
- **In più**: le altre 6 frasi sono generiche «italiane» senza fonte (es. «la musica in piazza è programmata dal comune», «ogni esibizione è certificata»): non verificabili.

## Correzione
- `CURIOSITA` in `vociTesti.js`: ogni curiosità porta la sua `citta`. `curiositaDellaCitta(cittaDelGiro)` restituisce solo quelle con la stessa città (maiuscole e accenti non contano); città del giro mancante → nessuna.
- `MapPage` mostra e legge solo quelle; se non ce ne sono, silenzio (nessun toast, nessuna voce).
- Rimaste: **la sola curiosità di Roma**. Le 6 generiche sono tolte, perché senza città nota non si possono mostrare (regola: meglio nessuna che una falsa). Quindi **a Catania oggi non esce nessuna curiosità**.

## Prove
- `mapPageCuriosita.test.jsx` (MapPage montata, cammino > 300 m): Catania → nessun toast, nessuna voce; Roma → solo la curiosità di Roma, a schermo e a voce; città assente → nessuna. Falliscono sul codice di prima.
- `curiositaCitta.test.js`: ogni curiosità ha città; Roma sì, Catania/Milano/«Roma Termini»/vuoto no.
- WebKit iPhone 14 (`npm run test:e2e:webkit`): giro a Catania ripreso e camminato per ~1,2 km: nessun toast «🎧», nessuna richiesta di voce con fontanelle/Roma. Fallisce sul codice di prima.

## Cosa NON risolve
- **Catania non ha curiosità**: il motore le toglie, non le crea. Servono curiosità scritte e verificabili per ogni città (con la fonte); non le ho inventate. Proposta: una per tappa o per quartiere, nel dato del giro, con fonte, come i racconti di tappa.
- Le curiosità AI delle schede monumento (`funFacts`, prompt narratore) e i racconti di tappa non sono toccati: non ho verificato se anche lì un fatto di un'altra città possa uscire.
- Non provato su iPhone vero (GPS e voce di iOS).
