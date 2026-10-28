# NAV-MAPPA-VISIBILE — la freccia di partenza è un lampo solo (28/10/2026)

## Cosa non andava
La freccia restava accesa finché non facevi 10 m nel verso giusto verso la prima tappa del giro, e il testo nominava sempre
`activeRoute[0]`. Se la prima tappa si chiudeva prima (arrivo, «Salta», tappa fatta), la freccia restava sopra la mappa alla tappa 2
con «Parti da qui verso Porta Uzeda» mentre la prossima era la Basilica.

## Cosa cambia
- `navGuida.frecciaDaSpegnere`: la freccia si spegne appena una tappa è fatta o saltata, si apre una scheda di arrivo o il GPS è `perso`.
- Chiavistello in `MapPage`: una volta spenta non si riaccende (solo un nuovo «Avvia» la riaccende; la ripresa di un giro salvato no).
  La ripresa del segnale dopo «Ho perso il segnale» non la riaccende.
- `navGuida.tappaDellaFreccia`: il nome è la prima tappa ancora da fare, mai la prima del giro se è già passata.
- Il testo sta in `NAV_TESTI.PARTENZA_VERSO` (stessa frase di prima, nessun testo nuovo).
Non toccati: camera, voce, arrivo, percorso, «Salta», segnaposti, motore dei giri.

## Prove
- Test: `src/__tests__/lib/frecciaPartenza.test.js` (10): avvio, tappa 2, tappa saltata, arrivo, segnale perso e ripresa, ripresa di un giro, testo.
- Suite 226 file / 2791 test verdi, lint 0 errori, build ok.
- WebKit (iPhone 13, GPS finto, giro Catania a 12 tappe, `scripts/prova-nav/freccia-tappa2.webkit.mjs`, grezzo in `docs/prove/dati/2026-10-28-freccia-partenza-webkit.json`):
  - avvio: freccia presente, testo «Parti da qui verso Porta Uzeda» (`schermate/freccia-partenza/freccia-3-avvio-con-freccia.png`);
  - arrivo alla tappa 1: freccia assente;
  - tappa 2: freccia assente, pillola «60 m · verso Basilica Cattedrale di Sant'Agata», centro della mappa libero (`freccia-4-tappa-2.png`).
- Il segnale perso e la ripresa sono coperti dal test sul chiavistello, non dal browser (il GPS finto non simula il silenzio).

## Prova di 10 minuti su iPhone
1. Avvia un giro a piedi: all'inizio la freccia punta la prima tappa e il testo la nomina.
2. Fai 10 m verso la tappa: la freccia sparisce.
3. Arriva alla tappa 1 (o premi «Salta»): alla tappa 2 il centro della mappa è libero, il testo in alto nomina la tappa 2.
4. Metti l'iPhone in modo aereo per un minuto e riaccendi: nessuna freccia.
5. Chiudi l'app a metà giro e riprendi: nessuna freccia.

## Cosa NON risolve
- Se non fai mai 10 m nel verso giusto e non arrivi né salti, la freccia resta (come da regola di partenza).
- Non cambia l'angolo della freccia, né la camera, né i testi della pillola.
- Il segnale perso non è provato su un telefono vero.
