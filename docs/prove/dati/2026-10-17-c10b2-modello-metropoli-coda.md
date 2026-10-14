## Roma, Napoli, Catania: prima e dopo

| Tour | Prima (C10b, 16/10: `gpt-4o-mini`, un quartiere) | Dopo (C10b2: `gpt-6.1-sol`, due quartieri) |
|---|---|---|
| c10-roma | 7 tappe, 280 min di tempo libero (Celio) | **8 tappe, 222 min** (Trastevere → Testaccio) |
| c10-roma-a | 7 tappe, 274 min | **8 tappe, 220 min** |
| c10-roma-b | 7 tappe, 280 min | **9 tappe, 184 min** |
| c10b-trastevere | 9 tappe, 189 min, 0 luoghi del quartiere (nessuna ancora) | **9 tappe, 188 min, 4 luoghi da visitare di Trastevere** |
| c10-napoli | 10 tappe, 152 min (Centro Storico) | **7 tappe, 273 min** (Decumani → Sanità): peggio |
| c10-ivano (Catania) | 12 tappe, 56 min, 5 essenziali di controllo | **10 tappe, 175 min, 2 essenziali**: peggio |

Obiettivo Roma (≥ 9 tappe e ≤ 150 min): **non raggiunto in nessuno dei 4 tour**. Più tappe e meno tempo libero di prima, non abbastanza. Napoli e Catania peggiorano, e la causa è la stessa: la lista di `gpt-6.1-sol` è più «da locale» e ha meno luoghi da visitare. A Catania mancano Teatro Bellini, Villa Bellini, Via Etnea e Fera 'o Luni, che `gpt-4o-mini` proponeva. A Napoli la mattina ai Decumani resta con 2 tappe e 113 minuti liberi.

**Il testo che vede l'utente, Roma neutra, dopo:** 09:30 Mercato di Testaccio · 10:18 Basilica di Santa Maria in Trastevere ⚓ · tempo libero 99 min · 12:30 Grano Trattoria · 14:30 Piazza d'Aracoeli · 15:27 Piramide di Caio Cestio ⚓ · 16:29 Cimitero Acattolico ⚓ · tempo libero 47 min · 18:00 Terrazza Belvedere Aventino · tempo libero 76 min · 20:00 Flavio al Velavevodetto. Prima (C10b): 09:30 Colosseo ⚓ · 10:16 San Giovanni in Laterano ⚓ · tempo libero 102 min · 12:30 Trattoria Vecchia Roma · 14:30 Piazza Vittorio · 15:12 Palazzo Massimo · tempo libero 91 min · 18:00 Belvedere Cederna · tempo libero 87 min · 20:00 Taverna Romana.

**Trastevere, dopo:** 09:30 Santa Maria in Trastevere ⚓ · 09:57 Villa Farnesina ⚓ · tempo libero 88 min · 12:30 Osteria da Fortunata · 14:30 Piazza Farnese · 15:06 Porta Settimiana · 15:41 Orto Botanico ⚓ · tempo libero 100 min · 18:00 Bar San Calisto · 18:58 Belvedere Tarpeo · 20:00 Ai Tre Scalini. Prima: 09:30 Campo de' Fiori · Piazza Farnese · tempo libero 106 min · … · Colosseo · … (nessun luogo di Trastevere).

## Costo e tempo col modello nuovo

**Per lista** (prima del giorno per città, poi la lista è dal server per tutti):

| | Catania | Roma | Napoli | Palermo | Lecce | Troina | Trastevere (lista del quartiere) |
|---|---|---|---|---|---|---|---|
| Tempo della chiamata AI | 42,8 s | 37,0 s | 40,3 s | 33,0 s | 45,2 s | 21,4 s | 9,0 s |
| Tempo totale (con la verifica) | 44,2 s | 38,3 s | 41,4 s | 35,5 s | 46,5 s | 22,3 s | — |
| Costo (token + Google, listino) | 0,56 $ | 0,53 $ | 0,59 $ | 0,56 $ | 0,56 $ | 0,17 $ | 0,26 $ |

**Per tour** (lista dal server; listino del banco con una foto per tappa; tempo dal via al tour pronto):

| Tour | Costo | Tempo | Token `gpt-6.1-sol` (in/out) | Token `gpt-4o-mini` (narratore) | Traduttore | Selettore |
|---|---|---|---|---|---|---|
| c10-ivano | 0,26 $ | 32,8 s | 7.312 / 538 | 1.633 / 569 | 4,7 s | 10,0 s |
| c10-roma | 0,29 $ | 33,1 s | 7.563 / 573 | 1.494 / 478 | 3,9 s | 10,1 s |
| c10-roma-a | 0,28 $ | 31,7 s | 7.192 / 572 | 1.497 / 486 | 3,0 s | 10,9 s |
| c10-roma-b | 0,33 $ | 32,2 s | 7.448 / 628 | 1.554 / 551 | 3,5 s | 11,3 s |
| c10-napoli | 0,25 $ | 43,4 s | 7.283 / 516 | 1.352 / 425 | 3,5 s | 8,1 s |
| c10-troina | 0,30 $ | 28,6 s | 4.465 / 448 | 1.223 / 377 | 3,6 s | 7,5 s |
| c10b-trastevere | 0,51 $ (con la lista del quartiere) | 39,2 s | 8.240 / 963 | 1.552 / 534 | 3,6 s | 8,6 s |
| c10b-troina-mezza | 0,22 $ | 22,5 s | 3.659 / 215 | 925 / 191 | 4,1 s | 3,1 s |

Il modello nuovo costa ≈ 0,02 $ di token per tour (≈ 7.500 token in ingresso a 2 $/M + 550 in uscita a 10 $/M). Il resto è Google e foto, come prima. Il selettore impiega 8–11 s (prima ~3–5 s); nessun ripiego in tutto il giro.

## Spesa

| Voce | Listino del banco | Reale (ricerche dalla cache del proxy a 0) |
|---|---|---|
| Prove del modello (2 chiamate dirette + 1 dal proxy) | ≈ 0,003 $ | ≈ 0,003 $ |
| Confronto 1 (tempo massimo 28 s, 5 liste ripiegate) | 3,094 $ | 0,469 $ |
| 5 tentativi interrotti di `gpt-6.1-sol` nel confronto 1 | non misurato | non misurato |
| Confronto 2 (6 liste `c10b-4` + scala a parole) | 2,961 $ | 2,226 $ |
| Giro (8 tour, con la lista di Trastevere) | 1,900 $ | ≈ 1,9 $ (non separato) |
| Giro di prova su Troina (modifica poi annullata) | 0,401 $ | ≈ 0,4 $ |
| **Totale del task** | **≈ 8,36 $** (tetto approvato 8,5 $) | **≈ 5,0 $** |

## Proposte (non scritte)

1. **Il prompt della lista con `gpt-6.1-sol` chiede troppi locali e pochi simboli.** Proposta: per città e metropoli fissare la quota, cioè almeno 6 luoghi da visitare su 15 e gli essenziali «famosi anche se sono famosi». Nel prompt c'è già, ma il modello nuovo lo pesa meno. Oppure tornare a `gpt-4o-mini` per la lista e tenere `gpt-6.1-sol` dove inventa meno: borghi e quartieri. Il confronto dice che è il modello nuovo a perdere i simboli.
2. **Roma piena:** cercare dal **centro del quartiere** anche nelle ricerche iniziali (oggi partono dal centro città e solo le mirate guardano il quartiere), e una ricerca «esperienze» per quartiere. Tocca il budget delle ricerche: da decidere.
3. **Troina:** quando i posti verificati di un borgo sono vie (zone C7) o chiusi la mattina, partire dal **pomeriggio**, o lasciare la scelta dell'ora al giro corto. Tocca ORARI e la finestra: da decidere.
4. **San Silvestro a Troina:** capire quale filtro lo toglie; il tracciato oggi non lo dice.
5. **Il tempo del primo tour del giorno:** con `gpt-6.1-sol` la lista chiede 35–45 s. Una lista preparata di notte per le città più cercate (proposta 2 di C10) toglierebbe l'attesa.

## Decisioni per Ivano

1. Tenere `gpt-6.1-sol` per la lista della città (meno invenzioni, meno simboli) o solo per borghi e quartieri (proposta 1).
2. Roma piena: proposta 2.
3. Troina: proposta 3.

## Cosa ho dato per vero senza verificarlo

1. **La chiave del server e quella locale** non sono necessariamente dello stesso account OpenAI. Il modello l'ho provato con tutte e due: chiamata diretta con la locale, chiamata dal proxy con la server. Il prezzo l'ho letto sul listino pubblico, non sulla fatturazione dell'account.
2. **I tentativi interrotti** di `gpt-6.1-sol` (5 da 28 s) non so se OpenAI li fattura: non sono nel conto.
3. **Il costo reale** conta a zero le ricerche che il proxy ha servito dalla sua cache (lo dice l'intestazione `X-Cache`). Non l'ho confrontato con la fatturazione di Google.
4. **Gli orari di Troina** (Chiesa Madre, Torre Capitania, Museo Capa chiusi giovedì mattina) sono quelli di Google, presi così come sono.
5. **Le liste di controllo** degli essenziali (asticella C10) le ho usate come metro per «conosce i simboli». Non dicono se i posti nuovi di `gpt-6.1-sol` siano migliori o peggiori per un abitante (Piramide Cestia, Santa Maria della Sanità, Castel Sant'Elmo).
6. **Un campione per tour e per lista:** i modelli e Google cambiano da una chiamata all'altra. Lo mostra la scala a parole di Catania con `gpt-4o-mini`: «città» nel primo confronto, «metropoli» nel secondo.
7. **Il passaggio fra i due quartieri dentro C5c:** lo garantisce il riparatore tappa per tappa, come sempre. La regola dei centri entro 3 km è mia e dichiarata.
8. **Il deploy del client:** esce col prossimo deploy di Vercel; `openai-proxy` v20 è già in produzione. **Deploy da verificare da Ivano.**
