## Diagnosi a 0 $ — Crea Catania 8:00 «con colazione»

Fonti, già pagate: il grezzo di C8c (`2026-10-14-banco-esteso-pasti.json`: pool per momento, `continuita`), la cache dei posti su Supabase (`places_cache`: 165 posti distinti di Catania, con gli orari settimanali) e il codice (`momentSelection.fillGaps`, `momentsToExpand`). Nessuna chiamata a Google o all'IA.

**Quali posti sono aperti di mercoledì tra le 8:20 e le 12:30, per famiglia** (famiglia ricavata da tipo e nome; «aperti» = aperti per tutta una sosta da 30 minuti che comincia a quell'ora):

| Famiglia | Posti nel pool | Aperti 8:50–9:20 | Aperti 9:30–10:00 | Aperti 10:30–11:00 | Aperti 11:30–12:00 | Senza orari |
|---|---|---|---|---|---|---|
| Luoghi all'aperto (piazze, lungomare, fontane, porte, belvederi) | 17 | **13** | **13** | **13** | **13** | 4 |
| Chiese | 5 | 2 | **4** | 4 | 4 | 1 |
| Mercati | 1 (Piazza Carlo Alberto) | 1 | 1 | 1 | 1 | 0 |
| Musei | 9 | 1 | **6** | 7 | 7 | 2 |
| Palazzi e altro (comprende spa e centri benessere trovati dalla ricerca) | 52 | 8 | 30 | 37 | 38 | 10 |
| Cibo (caffè, bar, pasticcerie, ristoranti) | 81 | 4 | 7 | 13 | 21 | 1 |

Il pool **permette** di riempire la mattina: dalle 8:50 ci sono 13 luoghi all'aperto aperti, dalle 9:30 quattro chiese e sei musei.

**Perché CONTINUITÀ lascia 187 minuti di tempo libero** (`continuita.tentativi: 0` nel grezzo: non ha nemmeno provato):
1. `momentsToExpand` e `momentsForMinimum` ritornano **nessun momento** quando le tappe del giorno sommano **8 o più** (`MAX_STOPS_PER_DAY`). Il giorno dell'utente: mattina 3 (la colazione è una tappa in più) + pranzo 1 + pomeriggio 2 + aperitivo 1 + passeggiata 1 + cena 1 = **9**. Senza la colazione (C8b) erano 8, con la passeggiata: già al tetto. Il tempo libero della mattina non è un problema di pool: è il tetto delle 8 tappe.
2. Le 3 tappe della mattina erano **colazione + una seconda pasticceria + un solo palazzo**: la mattina è `esplicito` (ammette i locali), quindi dopo il caffè la scelta per merito poteva cadere su un altro locale (Pasticceria Giuffrida) al posto di una visita. Nel pool della mattina i locali da colazione erano 13 su 15 posti.
