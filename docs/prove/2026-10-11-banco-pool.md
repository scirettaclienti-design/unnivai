# BANCO-POOL — pool e merito nei grezzi, Napoli, b-roma-A, Firenze (11/10/2026)

Due giri di banco con il motore `600057f`, account di prova, nessun caso Per Te, ora di Roma 19:52–19:57:
- [banco-11](2026-10-11-banco-11.md): Napoli, b-roma-A, Firenze;
- [banco-12](2026-10-11-banco-12.md): Firenze, secondo giro.

**Costo: 0,85 $ stimati (tetto 1 $)**, di cui 0,65 $ di chiamate fatte dal banco (token 0,006 + Google
0,64) e 0,20 $ di foto stimate.

## Esito contro il "fatto quando"

| Obiettivo | Esito |
|---|---|
| Grezzi nuovi con il pool | ✅ `banco-11.json`, `banco-12.json`: per ogni momento fino a 15 candidati, più le scelte del modello e le ricerche mirate |
| Napoli e b-roma-A: ogni ripetizione classificata con la prova dal pool | ✅ nel senso letterale: **in questi giri non ci sono ripetizioni** (Napoli: chiesa, piazza, museo, panorama; b-roma-A: piazza, panorama, museo). ⚠️ Le ripetizioni dei giri vecchi (banco-8) **restano non classificabili**: allora il pool non veniva salvato |
| Firenze: 2 giri confrontati fra loro e con C5d; modello o pool? | ✅ **tutti e due, in catena**: il modello sceglie diversamente, la ricerca mirata parte da un altro punto e trova candidati diversi. La deviazione viene dai candidati (sotto) |
| Nessun cambio di comportamento del motore | ✅ provato in due modi (sotto) |
| Suite, pubblicazione | 1440 test verdi; vedi il messaggio di chiusura |

## Cosa c'è nel grezzo

Per ogni caso itinerario, `pool` ha per ogni momento (`g1-mattina`, …) un campo `candidati`, al massimo 15.
Per ognuno:
- `place_id`, `nome`, `famiglia`;
- `merito`: il punteggio del Gate MERITO, relativo a quel pool;
- `minuti` dalla tappa prima (o dal centro del gruppo per la prima tappa);
- `deviazione` verso la tappa dopo, come la calcola il motore C5d;
- `scelto`, `nelGiro` (la rifinitura può averlo sostituito);
- `motivo`: la **prima regola in cui perde contro lo scelto**, nell'ordine in cui il motore le applica:
  marchio, tetto, varietà, "toglie l'unica alternativa", "lascia senza", fuori strada, poi merito e
  strada.

In più: `sceltaModello` (le scelte del modello come sono arrivate) e `ricerche` (le ricerche mirate prima
e dopo la scelta). Niente dati dell'utente: solo luoghi.

È la classifica che il motore calcola già a ogni posto (`ranked`), registrata nel momento in cui
sceglie. Il motivo è letto dalle chiavi della classifica, non ricostruito.

## Il giro non cambia: la prova

- **Test** (`bancoPool.test.js`): su 40 giornate casuali con seme fisso, il giro con la registrazione
  accesa e quello con la registrazione spenta hanno le stesse tappe, le stesse tracce e lo stesso report
  (a parte il pool).
- **Contro il motore precedente**: le stesse 40 giornate girate su `8a68c51` e sul motore nuovo danno un
  risultato **identico byte per byte** (152 826 byte).

## Firenze: perché i giri cambiano

| Cosa | banco-11 (A) | banco-12 (B) |
|---|---|---|
| Pool di pranzo, aperitivo, cena | uguale | uguale |
| Pool di mattina e pomeriggio | + Museo del Bargello, Museo dell'Opera del Duomo | + **Porta San Niccolò**, Museo Ferragamo |
| Ricerca mirata "cultura" del pomeriggio | da Osteria dei Leoni | da Piazza della Passera |
| Scelte del modello al pomeriggio e all'aperitivo | Piazza Santa Trìnita + Piazza della Passera; San Francesco Panorama | Piazza della Passera + SS. Annunziata; Belvedere Franco Zeffirelli |
| Giro | Passera → Loggia dei Lanzi → Osteria dei Leoni → Palazzo Davanzati → Cattedrale dell'Immagine → **Zeffirelli** → De' Benci | Strozzi → Loggia dei Lanzi → Osteria dei Leoni → Cattedrale dell'Immagine → **Porta San Niccolò** → Zeffirelli → De' Benci |
| Deviazione massima | **15,4** (Zeffirelli all'aperitivo) | 5,8 (Cattedrale dell'Immagine) |
| Voce 12 | 🔴 (1 incrocio, deviazione oltre 10) | 🔴 (1 incrocio) |

- **B è identico, tappa per tappa, al giro di C5d** (banco-10).
- **A somiglia a C5c-varietà** (banco-8): anche lì Davanzati al pomeriggio e Zeffirelli a 16,2.

La catena:
1. **Il modello** (temperatura 0,7) fa scelte diverse sugli stessi candidati prima della ricerca. Il pool
   di partenza è uguale: le differenze sono solo nei 4 candidati arrivati dalla ricerca mirata.
2. Il piano intermedio cambia, quindi **la ricerca mirata parte da un'altra tappa** e trova altri
   candidati.
3. **La deviazione viene dal pool che ne risulta.** In B c'è Porta San Niccolò, in Oltrarno: il
   pomeriggio finisce vicino al Belvedere Zeffirelli. In A non c'è: il pomeriggio finisce in centro e il
   Belvedere diventa un'andata e ritorno di 15,4 minuti.

All'aperitivo, in entrambi i giri, il pool ha **solo 5 panorami e nessun bar**: lo Zeffirelli è il
migliore che c'è (gli altri a 14–69 minuti). È un problema di pool della ricerca dell'aperitivo, non di
composizione.

## Napoli e b-roma-A: cosa dice il pool

- **Napoli**: nessuna ripetizione. All'aperitivo il pool ha **solo panorami** (9 candidati, nessun bar,
  dal punto panoramico a 12 minuti al Belvedere del Parco Virgiliano a 97). In banco-8 la ripetizione
  era panorama al pomeriggio + panorama all'aperitivo. Il pool di oggi dice che all'aperitivo non si
  poteva evitare. Che si potesse evitare **dal lato del pomeriggio** è coerente con questo giro (qui il
  pomeriggio ha un museo e una trattoria), ma **per il giro di allora non è dimostrato**.
- **b-roma-A**: nessuna ripetizione. All'aperitivo il pool ha 4 locali senza famiglia (Studio 26, scelto
  a 15 min; NODO; Lonely Avenue; 8 e 1/2) e 4 belvederi.
- **Da segnalare, fuori task**: "Wisdomless Club" (b-roma-A, pomeriggio) ha i tipi
  `art_gallery, bar, store`, e per il motore è famiglia **museo**. Un club con galleria preso per museo
  è un possibile problema di verità o di famiglie: non l'ho toccato.

## Cosa ho dato per vero senza verificarlo

- **Che le differenze di pool di Firenze vengano solo dalla ricerca mirata.** I 4 candidati diversi sono
  quelli che una ricerca "cultura" restituisce. Il pool salvato però non dice da quale ricerca arriva
  ogni candidato: lo deduco dai nomi e dal fatto che il resto del pool è identico.
- **Che il modello sia l'origine.** Le scelte del modello sono diverse e il pool di partenza sembra
  uguale. Non posso escludere che cambino anche i dati di Google (voti, recensioni) fra un giro e
  l'altro: il merito degli stessi luoghi è diverso (Loggia dei Lanzi 0,31 contro 0,26), ma il merito
  dipende anche dal resto del pool.
- **Il motivo dello scarto.** È la prima regola in cui il candidato perde contro lo scelto, *nel momento
  in cui il posto viene riempito*. La rifinitura che viene dopo può cambiare la tappa (il campo
  `nelGiro` lo dice), ma per i candidati non aggiorna il motivo.
- **15 candidati per momento.** Oltre il quindicesimo nella classifica non si vede niente: una diagnosi
  che dipende da un candidato più in basso non è possibile.
- **Il costo.** 0,85 $ è la stima del banco; le foto sono stimate.
