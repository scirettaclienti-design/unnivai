# Palette dell'app — la regola (ESTETICA-COERENZA)

1. **Fondi** solo della Scala Ossidiana: `obsidian-bg` (pagina), `obsidian-card` (riquadri), `obsidian-raised` (elementi sollevati, tasti spenti).
2. **Testo primario e secondario** solo `obsidian-primary` e `obsidian-secondary`; mai bianco, nero o grigio di Tailwind.
3. **Un solo accento, `brand-orange`** (con `-hover` e `-deep`), per azioni, stato attivo ed evidenze; sul fondo arancione il testo è `obsidian-bg`.
4. **Bordi** `obsidian-border` (tenui, `-elevated` se serve rilievo); l'arancione (`brand-orange/30…60`) solo sull'elemento attivo.
5. **Nessun colore nuovo**: niente ocra, terracotta, oliva, rosso, rosa, giallo, grigi shadcn, gradienti multicolore.
6. **Contrasto del testo ≥ 4,5:1** sul suo fondo (sono vietate le opacità `/40…/70` sul testo secondario).

Fuori da questa regola, per scelta documentata: le copertine per categoria (`getCoverPalette`, tinte calde su fondo scuro) e il banco dei colori `status-*` dei messaggi di sistema altrove nell'app.
