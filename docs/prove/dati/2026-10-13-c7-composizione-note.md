---

## Diagnosi 0 — c1 sul giro CONTINUITA' (0 $, dai grezzi): errori veri e soglie

Le **37 violazioni c1** del giro precedente (`2026-10-13-banco-esteso-continuita.json`), una per una. Le fasce (pranzo 12:00–14:45, cena 19:30–23:00) le avevo scelte io; qui separo gli errori del motore da quelli del righello.

**Esito: 20 errori veri del motore, 17 di soglia o di ambito del banco.**

| Classificazione | Violazioni | Che cosa |
|---|---|---|
| errore del motore | **20** | ristoranti a mattina, pomeriggio e aperitivo (e secondi pasti conseguenti) nei due Catania «ristoranti tipici» (13); un ristorante all'aperitivo a Bologna (Trattoria del Tempo Buono); pizzeria all'aperitivo + pizzeria a cena a Napoli (Veloce); due ristoranti al dopocena a Milano; un bistrot nel pomeriggio a Palermo |
| soglia (ambito) | **15** | **Per Te**: osterie alle 10:00, 11:41, 16:00… sono tour tematici gastronomici a orari STIMATI, senza momenti. Il righello c1 non andava applicato (non c'è nessun pasto «fuori fascia» in un elenco che non ha fasce). Non l'ho «risolto»: l'ho tolto dall'ambito di c1 |
| soglia (misura) | 1 | Bar Popolare (cocktail bar, con `restaurant` fra i types) contato come pasto: il tipo principale lo dice bar |
| soglia (richiesta) | 1 | Osteria Angolo degli Orefici alle 15:00 a Bologna: il testo chiede «un pomeriggio tra portici e osterie» |

Soglie corrette in `controlli.js` (**validate prima del giro**: rosso sul cattivo, verde sul buono; con il **vecchio** controllo i tre esempi buoni davano 2, 1 e 3 falsi allarmi, col nuovo 0):

1. il **tipo principale** decide cosa è un pasto (`eRistorante`): un cocktail bar marcato anche ristorante, un forno, un caffè non lo sono;
2. un ristorante in un momento che il **testo chiede esplicitamente** («il pomeriggio nelle osterie») non conta;
3. **Per Te** esce dall'ambito di c1 (non ha momenti).

c2 invece si è **allargata**: ora conta un ristorante anche all'**aperitivo** e al **dopocena** (prima solo mattina e pomeriggio); lì non esiste una richiesta che lo giustifichi.

Causa degli errori veri, sempre nello stesso punto: con una richiesta a tema cibo (la parola «ristoranti» nel testo, o `categoria=cibo` del traduttore) `daySkeleton` dava la categoria `cibo` a **ogni** momento e `bucketCandidates` con `anyCategory` accettava ogni candidato in ogni momento tranne pranzo e cena (D-CATANIA B1, `daySkeleton.js:160-183`). Il pool stesso nasceva di soli ristoranti (le query del traduttore erano «trattoria tipica» e «osteria»).

Le 37, una per una (classificazione e causa):

| Caso | Momento | Tappa @ ora | Tipo principale | Classificazione | Causa |
|---|---|---|---|---|---|
| crea-catania-catanese-veg | mattina | La Locanda @ 09:30 | restaurant | errore del motore | tema cibo applicato a mattina: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese-veg | pomeriggio | PLANTE Lab @ 15:47 | vegetarian_restaurant | errore del motore | tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese-veg | aperitivo | Spaghetti & Co. @ 18:00 | italian_restaurant | errore del motore | ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| crea-catania-catanese-veg | pomeriggio | Trattoria Sorano @ 14:30 | italian_restaurant | errore del motore | secondo pasto seduto: tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese-veg | pomeriggio | PLANTE Lab @ 15:47 | vegetarian_restaurant | errore del motore | secondo pasto seduto: tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese-veg | aperitivo | Spaghetti & Co. @ 18:00 | italian_restaurant | errore del motore | secondo pasto seduto: ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| crea-catania-catanese-veg | cena | La Taverna del Grande Albero (Trattoria Mediterranea) @ 20:00 | restaurant | errore del motore | secondo pasto vicino a un ristorante fuori fascia (conseguenza) |
| crea-catania-catanese | pomeriggio | Antica Sicilia @ 15:47 | seafood_restaurant | errore del motore | tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese | aperitivo | Trattoria Casalinga da Nino Mannino @ 18:00 | italian_restaurant | errore del motore | ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| crea-catania-catanese | pomeriggio | Trattoria Sorano @ 14:30 | italian_restaurant | errore del motore | secondo pasto seduto: tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese | pomeriggio | Antica Sicilia @ 15:47 | seafood_restaurant | errore del motore | secondo pasto seduto: tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| crea-catania-catanese | aperitivo | Trattoria Casalinga da Nino Mannino @ 18:00 | italian_restaurant | errore del motore | secondo pasto seduto: ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| crea-catania-catanese | cena | Trattoria Il mare @ 20:00 | italian_restaurant | errore del motore | secondo pasto vicino a un ristorante fuori fascia (conseguenza) |
| crea-bologna-pomeriggio | pomeriggio | Osteria Angolo degli Orefici @ 15:00 | bistro | soglia (richiesta) | il testo chiede «un pomeriggio tra portici e osterie»: l'osteria delle 15:00 e' voluta |
| crea-bologna-pomeriggio | aperitivo | Trattoria del Tempo Buono @ 18:00 | italian_restaurant | errore del motore | ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| crea-milano-sera | dopocena | Il Marchese Milano @ 23:55 | italian_restaurant | errore del motore | ristorante al dopocena (categoria cibo per tutti i momenti) |
| crea-milano-sera | dopocena | The Roof Milano @ 22:30 | restaurant | errore del motore | secondo pasto seduto: ristorante al dopocena (categoria cibo per tutti i momenti) |
| crea-milano-sera | dopocena | Il Marchese Milano @ 23:55 | italian_restaurant | errore del motore | secondo pasto seduto: ristorante al dopocena (categoria cibo per tutti i momenti) |
| crea-palermo-mercato-veg | pomeriggio | Ecologica Bistrot @ 14:30 | restaurant | errore del motore | secondo pasto seduto: tema cibo applicato a pomeriggio: ristorante dove il tema chiedeva esperienze |
| veloce-napoli-pizza | aperitivo | 'A Puteca d' 'a Pizza @ 19:00 | pizza_restaurant | errore del motore | ristorante all'aperitivo (categoria cibo per tutti i momenti) |
| veloce-napoli-pizza | cena | Pizzeria Donna Sofia Ai Tribunali | Napoli @ 20:15 | pizza_restaurant | errore del motore | secondo pasto vicino a un ristorante fuori fascia (conseguenza) |
| sorprendimi-catania-pomeriggio | aperitivo | Bar Popolare @ 18:00 | cocktail_bar | soglia (misura) | cocktail bar con restaurant tra i types contato come pasto: il tipo principale lo dice bar |
| perte-roma-1000 | - | Osteria Pizzeria Come Va? @ 10:00 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1000 | - | Osteria Sonnino @ 11:41 | restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1000 | - | Osteria Sonnino @ 11:41 | restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1000 | - | OSTERIA DA SAMU @ 13:13 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria Della Parola @ 17:15 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria Pizzeria Come Va? @ 16:00 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria da Fortunata - Pellegrino @ 17:35 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria Sonnino @ 19:00 | restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria da Fortunata - Pellegrino @ 17:35 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-roma-1600 | - | Osteria Sonnino @ 19:00 | restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-catania-1300 | - | Trattoria Giglio Rosso @ 15:39 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-catania-1300 | - | Antica Sicilia @ 14:20 | seafood_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-catania-1300 | - | Trattoria Giglio Rosso @ 15:39 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-firenze-1100-veg | - | Osteria dei Medici @ 11:46 | restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |
| perte-firenze-1100-veg | - | Osteria Campo di Marte @ 13:39 | italian_restaurant | soglia (ambito) | Per Te: tour tematico gastronomico a orari STIMATI, senza momenti; c1 non gli si applica |

## Che cosa è stato fatto

- **Tema cibo solo nei pasti** (`daySkeleton`, `foodTheme`). Il tema (testo o categoria cibo del traduttore) non è più una categoria per ogni momento: pranzo e cena sono cibo, l'aperitivo è un bar, **mattina e pomeriggio sono esperienze** (`tema: 'esperienze'`: mercato storico, palazzi, via storica). Le altre categorie esplicite (musei, bar, natura) valgono per tutti i momenti come prima. Una richiesta **esplicita** per il momento («la colazione», «il pomeriggio in pasticceria», «un pomeriggio tra portici e osterie») si rispetta e si dichiara nel tracciato (`esplicito`).
- **Un pasto per fascia** (`mealRules`, nei bucket). Un ristorante sta solo a pranzo e cena; la mattina un locale è una colazione (caffè, forno, pasticceria, bar semplice, non cocktail bar); l'aperitivo è un bar; pomeriggio e dopocena non accolgono ristoranti. Poiché sta nei bucket, vale anche per il riempimento dei buchi di CONTINUITA'. Un forno non è un pranzo, salvo lo street food.
- **Niente zone** (`zone.js`, scartate nella ricerca e sul pool). Tipo principale o tipo da zona (locality, sublocality, neighborhood, political, route…) oppure un nome che è solo quello di un'area («Centro Storico Catania», «Zona Centro»: Google lo registra come `tourist_attraction`, i types non lo tradiscono).
- **Candidati del tema**: nuova ricerca mirata `esperienze` («mercato storico palazzo barocco via storica»), **una sola per mattina e pomeriggio**, tutta la pagina di Google (20 risultati). Scelta fra 4 formulazioni provate dal vivo su Catania, Palermo, Roma e Napoli (la prima versione, con pasticceria e caffè nella query, restituiva soprattutto mercati e pasticcerie, inutili a mattina e pomeriggio). `market` ora ha una categoria dello scheletro (prima i mercati non stavano in nessun momento).
- **Tipico** (`foodTheme`): nei pasti le cucine estere (tipo principale o nome: sushi, kebab, burger…) sono escluse, e i posti locali (nome: trattoria, osteria, putia…; tipo principale italiano/pesce/pizza) hanno una spinta di merito di +0,2; il bistrot vegetariano +0,08 (prima il tipico, poi il vegetariano). Nel tracciato di ogni pasto: `tipico: { richiesto, locale, perche }`.
- **Vegetariano**: la dieta resta solo sulle ricerche del cibo e sui posti dove si mangia (l'esperienza non porta il criterio). La riga «Locali cercati come vegetariani: verifica sul posto.» esiste già e copre il «se il dato manca».
- **Selettore**: con il tema cibo la categoria arriva al modello come `misto` (dato in ingresso, **il testo del prompt non è cambiato**): niente più «TUTTE le tappe devono appartenere alla categoria cibo».
- **Banco**: c1 con le soglie sopra, c2 allargata, nuova **c12** (zone come tappe), report C7, 3 casi nuovi (`crea-palermo-streetfood`, `crea-roma-da-romano`, `crea-napoli-arte`). Chiavi di cache: itinerari `unnivai_insiderf16_composizione_`, pool `gg5_`.
- Non toccati: regola orari, durate (C6a), CONTINUITA' (salvo che il riempimento ora passa dai bucket con la regola dei pasti), percorso, frasi approvate, quote, testo dei prompt.

## Il tetto di 2 ricerche mirate: bastano, con una scelta

Mattina e pomeriggio **condividono una sola** ricerca (`esperienze`), l'aperitivo ne usa una (`nightlife`): 2, dentro il tetto. Con due ricerche distinte («mercato storico» per la mattina, «palazzo barocco, via storica» per il pomeriggio) ne servirebbero **3**: **+1 ricerca = +$0,035 per tour** a tema cibo (listino `place/textsearch#new`); una colazione cercata apposta (caffè, pasticceria) sarebbe la **4ª**, +$0,07 in tutto. Non ho alzato il tetto.

**Costo misurato** (token + Google, senza foto): i 9 casi a tema cibo $0,158 per tour; negli stessi 7 casi già presenti prima $0,123 → $0,148; i due Catania «ristoranti tipici» $0,123 → $0,159 e $0,194 (4 e 5 ricerche di testo, 8 tappe vere da raccontare invece di 5 e 6). Sull'insieme dei 20 casi in comune: $0,144 → $0,155 (+7%), ricerche di testo 3,6 → 3,9. **La voce «Costo» dell'asticella peggiora oltre la varianza (+4 casi rossi: i due Catania, milano-sera, veloce-roma-rione)**: soglia $0,20 con le foto stimate (1 per tappa). I due Catania per più ricerche e più tappe, milano-sera per più ricerche (3 → 5); veloce-roma-rione (4 → 5 ricerche, senza tema cibo) è varianza.

## Spesa

Pilota scartato 0,862 $ (la ricerca delle esperienze era ancora la prima versione) + run A (5 casi del tema) 0,897 $ + run A2 (3 casi rigirati con le esperienze a 20 risultati) 0,546 $ + run B (18 casi) 2,742 $ = **5,047 $ sul tetto di 5 $: ho sforato di 0,05 $** (il tetto del banco si controlla prima di ogni caso, e l'ultimo l'ha superato). Il grezzo contiene A2 + A + B (4,185 $).

## Cosa ho letto dal giro

- **c1, c2, c3, c12 = 0** su tutti i 23 casi girati (sugli stessi casi del giro di prima, misurati con i controlli di adesso: c1 20 → 0, c2 12 → 0, c3 1 → 0). **c5 e c11 restano 0.** Nessuna zona come tappa.
- **Catania «un giorno da catanese, nei ristoranti tipici»**: mattina Market Fera O'Luni, Palazzo Beneventano, Palazzo Minoriti; pranzo Trattoria Il mare; pomeriggio Palazzo degli Elefanti, Porta Uzeda; aperitivo Bar Popolare; cena Trattoria Sorano (tabella sopra). Prima: 7 ristoranti su 7.
- **Percorso 2 → 2, verità 0 → 0, ripetizioni 1 → 1**, nessuna voce oltre la varianza **tranne Costo** (vedi sopra).
- Il tempo libero resta dove le esperienze finiscono (pool esaurito): è lo stesso meccanismo di CONTINUITA'.

## Casi non rigirati

11 casi di 34 **non sono stati rigirati** perché il tetto di spesa non bastava: `veloce-catania-relax-2125`, `veloce-catania-relax-2330`, `veloce-siracusa-parco`, `sorprendimi-milano-sera`, `sorprendimi-firenze-cultura`, `sorprendimi-napoli-tardi` e i 5 **Per Te**. Il report confronta i 23 girati con il giro precedente.

## Cosa ho dato per vero senza verificarlo

1. **Per Te**: c1 non gli si applica (ambito), ma le osterie alle 10:00 in un tour gastronomico restano: è una domanda di prodotto, non risolta qui. I 5 Per Te **non sono stati rigirati**: il loro codice cambia solo per il filtro delle zone dentro `discoverRealPOIs` (che tocca anche i loro pool) e per le chiavi di cache; non l'ho misurato.
2. **I 6 casi serali a una tappa non rigirati** (Veloce Catania 21:25 e 23:30, Veloce Siracusa parco, tre Sorprendimi): li ho lasciati fuori perché hanno un solo locale o nessun ristorante da correggere; non è una prova.
3. **Il giro è fatto in pezzi**: `crea-roma-da-romano` e `crea-napoli-arte` sono del run A, **prima** di portare le esperienze a 20 risultati (Roma ha fatto la ricerca `esperienze` dopo la scelta con 12 risultati; Napoli non usa quella ricerca). Un solo campione per caso.
4. **La colazione non nasce da sola**. La regola vale (la mattina un locale è un caffè/forno/pasticceria/bar semplice) e il test la prova, ma nei 23 casi la mattina non ha locali: mattina e pomeriggio sono esperienze. «Colazione in un caffè aperto» e «il pomeriggio in pasticceria» sono provate col modello finto, **non dal vivo**.
5. **«Dichiarato»** per le richieste esplicite vuol dire nel **tracciato** (`esplicito`), non a schermo.
6. **`route` come zona** (richiesta tua): una via con tipo principale `route` non è più una tappa. Nei grezzi salvati non ne ho trovate (0 su tutte le tappe e sul pool), quindi non ho visto l'effetto; il tema `romance` di Per Te (lungomare, scalinate) potrebbe perdere qualche via.
7. **Il tipico è lessicale**: «locale» = nome (trattoria, osteria, putia…) o tipo principale italiano; Google non ha un campo «cucina regionale». «La Locanda» (restaurant) risulta «non verificabile». Le cucine estere escluse sono quelle che Google tipizza o che hanno nel nome sushi, kebab, burger, ecc.: nei 23 casi non ne è stata esclusa nessuna (0), quindi **l'esclusione è provata solo dal test**.
8. **Il vegetariano «tipico se possibile»**: nel test il pasto locale batte il bistrot vegetariano; dal vivo il Catania vegetariano ha 1 pasto locale su 2 (l'altro «non verificabile»). La ricerca senza dieta per recuperare un posto tipico con dato mancante **non** c'è: costerebbe un'altra ricerca e la dieta è rigida per scelta (P7b).
9. **«Da romano»** viene riconosciuto da un suffisso (-ese, -ano, -ino, -ense…) con una lista di eccezioni breve («da solo», «da Roma» no); può sbagliare su parole simili. In un test che usava «Domani voglio vivere Roma da romano» come frase neutra (`scheletroScelta`) la ricerca mirata attesa è ora `esperienze` e non `cultura`.
10. **I mercati come esperienza**: ho mappato `market` in `passeggiata`/`shopping`; di pomeriggio molti sono chiusi e li toglie la regola degli orari (non ho misurato quanti).
11. **`Piazza Ballaro`** (tipo principale `coffee_shop` su Google) è entrata come esperienza della mattina a Palermo: una svista di tipo di Google, non la correggo.
12. **Il righello c2 allargato** ad aperitivo e dopocena è una mia scelta di definizione; lo stesso per il +0,2 del «tipico».
13. **Il costo** è stimato col listino del banco, non letto dalla fatturazione.
14. **Il deploy** su Vercel non è visibile da questa sessione.
