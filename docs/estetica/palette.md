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

- Lo stile della mappa durante la navigazione è lo **stile Google «Unnivai · Ossidiana Navigazione»** (Cloud Console), assegnato alla **modalità buio** del suo Map ID. Il Map ID sta **solo** in `VITE_GOOGLE_MAP_ID_NAV` (Vercel Production e Preview, `.env.example`), mai nel codice; la mappa di navigazione si crea con quel `mapId`, `colorScheme: DARK` e inclinazione 0 (vista dall'alto, anche per la camera). Senza la variabile la navigazione usa `VITE_GOOGLE_MAP_ID` come prima; la mappa di Esplora non cambia. Una sola variante (Ossidiana) a ogni ora: mattina, tramonto e notte arriveranno come Map ID separati. I filtri CSS di NAV-3 sono tolti.
- Colori dello stile (dal canvas, schermata 1): terra `#0F0E0D`, edifici `#171513`, strade `#26231F`.
- Il percorso sopra quello stile, tutti ≥ 3:1 su terra, edifici e strade (`navStileMappa.test.js`): **fatto** tratteggio chiaro `#A8A29E`; **prossimo** accento `#F97316` pieno e spesso; **resto** grigio caldo `#8F8880` pieno e sottile. Si distinguono anche senza colore (tratteggio / spessore).
- Il tasto indietro ha la sua riga in alto (sopra il filo del giorno e la pillola, che partono 3,5 rem sotto).

### La mappa del giro come esperienza continua (nav-camera, 25/10)

- **Panoramica** (prima di «Avvia»): sempre Ossidiana (`VITE_GOOGLE_MAP_ID_NAV`, `colorScheme: DARK`), dall'alto (inclinazione 0, nord in alto), **tutte le tappe nell'inquadratura**, segnaposti numerati che non si sovrappongono (`separaSegnaposti`), tracciato **arancione** pieno con l'alone, card in basso con titolo, «Giornata … · … a piedi · … km · N tappe» e «Avvia». Niente ricerca città né meteo; il tasto indietro sta nella sua riga.
- **«Avvia»** parte subito. La camera **vola su di te in ~1,5 s** (zoom 18, inclinazione 50°, edifici 3D), poi insegue con orientamento nella direzione di marcia (bussola; se manca, il percorso davanti a te; se manca, la prossima tappa), lisciato. **«Vista giro»** torna alla panoramica; **«centra»** torna su di te.
- **Colore per fascia** (`VITE_GOOGLE_MAP_ID_NAV_MATTINA|_TRAMONTO|_NOTTE`): la mappa della fascia si prepara sotto durante il volo e compare in dissolvenza (600 ms); la vecchia si rilascia. Una volta per fascia. Il resto del giorno e le fasce senza Map ID restano Ossidiana. L'inclinazione 0 del prompt Ossidiana vale solo per la panoramica.
- **Partenza**: prima del primo passo una freccia grande al centro indica la direzione fisica verso la prima tappa; sparisce dopo 10 m nel verso giusto.
- **Scheda in basso**: la miniatura è una foto vera di Places o non c'è (mai stock, mai segnaposto).
