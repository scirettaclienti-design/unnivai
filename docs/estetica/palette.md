# Palette dell'app — la regola (ESTETICA-COERENZA)

1. **Fondi** solo della Scala Ossidiana: `obsidian-bg` (pagina), `obsidian-card` (riquadri), `obsidian-raised` (elementi sollevati, tasti spenti).
2. **Testo primario e secondario** solo `obsidian-primary` e `obsidian-secondary`; mai bianco, nero o grigio di Tailwind.
3. **Un solo accento, `brand-orange`** (con `-hover` e `-deep`), per azioni, stato attivo ed evidenze; sul fondo arancione il testo è `obsidian-bg`.
4. **Bordi** `obsidian-border` (tenui, `-elevated` se serve rilievo); l'arancione (`brand-orange/30…60`) solo sull'elemento attivo.
5. **Nessun colore nuovo**: niente ocra, terracotta, oliva, rosso, rosa, giallo, grigi shadcn, gradienti multicolore.
6. **Contrasto del testo ≥ 4,5:1** sul suo fondo (sono vietate le opacità `/40…/70` sul testo secondario; minimo `/80`).
7. **Avvisi ed errori**: un solo colore di avviso `status-warning` (#D9B25A) e uno di errore `status-error` (#E0817A), attenuati e distinti dall'accento; solo per stato, mai per azioni o decorazione.

Fuori da questa regola, per scelta documentata: le copertine per categoria (`getCoverPalette`, tinte calde su fondo scuro) e `status-success` (regola 7 non lo riguarda).

## La mappa di navigazione (MAPPA-STILE)

- Lo stile della mappa durante la navigazione è lo **stile Google «DoveVAI — Navigazione»** (Cloud Console), legato a un suo Map ID. Il Map ID sta **solo** in `VITE_GOOGLE_MAP_ID_NAV` (Vercel e `.env` locale), mai nel codice; senza la variabile la navigazione usa `VITE_GOOGLE_MAP_ID` come prima. I filtri CSS di NAV-3 sono tolti.
- Colori dello stile (dal canvas, schermata 1): terra `#0F0E0D`, edifici `#171513`, strade `#26231F`.
- Il percorso sopra quello stile, tutti ≥ 3:1 su terra, edifici e strade (`navStileMappa.test.js`): **fatto** tratteggio chiaro `#A8A29E`; **prossimo** accento `#F97316` pieno e spesso; **resto** grigio caldo `#8F8880` pieno e sottile. Si distinguono anche senza colore (tratteggio / spessore).
- Il tasto indietro ha la sua riga in alto (sopra il filo del giorno e la pillola, che partono 3,5 rem sotto).
