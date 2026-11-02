/**
 * ACCOUNT-PRIVACY — i testi di account e privacy in un file solo (voce Unnivai: diretta, frasi corte, da insider).
 *
 * Qui stanno: l'«Elimina account» del Profilo, il consenso ai servizi AI di terzi, e le pagine /privacy e /termini.
 * Ogni affermazione sui dati è stata verificata sul codice (grep) il 03/11/2026: se il codice cambia, cambia anche il testo.
 * Le pagine sono una BOZZA da far verificare a un legale. I segnaposto «[DA COMPILARE: …]» non si inventano: li compila Ivano.
 */

export const NOME_PRODOTTO = 'Unnivai';
export const DATA_AGGIORNAMENTO = '3 novembre 2026';
export const BOZZA = 'Bozza da far verificare a un legale';

// Segnaposto evidenti: la pagina li mostra su sfondo giallo. Nessun dato inventato.
export const SEGNAPOSTO = {
    TITOLARE: '[DA COMPILARE: nome e cognome o ragione sociale del titolare]',
    INDIRIZZO: '[DA COMPILARE: indirizzo del titolare]',
    CONTATTO: '[DA COMPILARE: email per la privacy]',
    FORO: '[DA COMPILARE: foro competente e legge applicabile, a cura del legale]',
    ETA: '[DA COMPILARE: età minima per usare Unnivai, a cura del legale]',
};

// ─── Elimina account (Profilo) ───────────────────────────────────────────────

export const PAROLA_ELIMINA = 'elimina';

export const ELIMINA = {
    VOCE_PROFILO: 'Elimina account',
    VOCE_SOTTO: 'Cancella il tuo account e tutto quello che c\'è dentro.',
    TITOLO: 'Elimina il tuo account',
    COSA_SI_CANCELLA: [
        'L\'account: email, password e accessi.',
        'Il profilo, i gusti, gli interessi e il DNA dei tuoi giri.',
        'I giri salvati, i preferiti e le notifiche.',
        'Le foto e i file che hai caricato.',
    ],
    NON_SI_TORNA: 'Non si torna indietro. Non posso recuperare niente, nemmeno io.',
    OSPITE_NOTA: 'Questo è un giro di prova senza email: sparisce con l\'account.',
    ISTRUZIONE: (parola) => `Per confermare scrivi «${parola}».`,
    CAMPO: 'Scrivi qui',
    CONFERMA: 'Elimina per sempre',
    ANNULLA: 'Non adesso',
    IN_CORSO: 'Cancello tutto…',
    // Dopo: ritorno alla home
    FATTO: 'Account eliminato. I tuoi dati non ci sono più.',
    // Onesti quando qualcosa non va: mai un falso «fatto».
    NON_ATTIVA: 'La cancellazione non è ancora attiva su questo servizio. Non ho cancellato niente. Scrivici e lo facciamo noi.',
    NON_RIUSCITA: 'Non sono riuscito a cancellare tutto. Il tuo account c\'è ancora. Riprova tra poco.',
    SENZA_RISPOSTA: 'La risposta non è arrivata. Non so se ho finito. Riapri l\'app: se l\'account c\'è ancora, riprova.',
    SENZA_RETE: 'Non riesco a raggiungere il servizio di cancellazione: manca la rete, oppure non è ancora attivo. Non ho cancellato niente. Riprova, o scrivici.',
    SESSIONE: 'La tua sessione è scaduta. Entra di nuovo e riprova.',
};

// ─── Consenso ai servizi AI di terzi ─────────────────────────────────────────

export const CONSENSO_AI = {
    TITOLO: 'Prima di partire: chi scrive i tuoi giri',
    INTRO: 'Per scrivere un giro, un racconto o una risposta mando del testo a due servizi AI di aziende esterne. Una volta sola, ti spiego cosa.',
    SERVIZI: [
        {
            nome: 'Anthropic (Claude)',
            ricevono: 'Scrive i testi: i giri, i racconti delle tappe, la chat e le curiosità. Riceve cosa chiedi, la città, le tappe e le loro coordinate, i tuoi gusti e interessi e le fonti pubbliche del luogo.',
        },
        {
            nome: 'OpenAI',
            ricevono: 'Dà la voce in navigazione: riceve la frase da dire. Se Anthropic non risponde, può scrivere lui il testo al suo posto.',
        },
    ],
    NON_RICEVONO: 'Non ricevono la tua email, la tua password né il tuo nome.',
    PRIVACY_LINK: 'Come tratto i dati',
    OK: 'Va bene',
    NON_ADESSO: 'Non adesso',
    // Senza consenso le funzioni AI non partono, e lo dicono.
    SENZA: 'Senza il tuo ok non posso scrivere giri, racconti né risposte. Te lo richiedo appena ci riprovi.',
    DAI_CONSENSO: 'Dai il consenso',
    BLOCCATO: 'Per farlo mi serve il tuo ok sui servizi AI.',
};

// ─── Collegamenti ────────────────────────────────────────────────────────────

export const COLLEGAMENTI = {
    PRIVACY: 'Privacy',
    TERMINI: 'Termini',
    PRIVACY_E_TERMINI: 'Privacy e termini',
    TORNA: 'Indietro',
};

// ─── Pagine legali ───────────────────────────────────────────────────────────
// Struttura: sezioni { id, titolo, paragrafi?: string[], flussi?: Flusso[] }.
// Flusso: { nome, parte, verso, perche, resta }.

export const PRIVACY = {
    titolo: 'Privacy',
    sottotitolo: 'Cosa raccoglie Unnivai, chi lo riceve, per quanto tempo.',
    sezioni: [
        {
            id: 'titolare',
            titolo: 'Chi è il titolare',
            paragrafi: [
                `Titolare del trattamento: ${SEGNAPOSTO.TITOLARE}`,
                `Indirizzo: ${SEGNAPOSTO.INDIRIZZO}`,
                `Per qualsiasi richiesta sui tuoi dati: ${SEGNAPOSTO.CONTATTO}`,
            ],
        },
        {
            id: 'in-breve',
            titolo: 'In breve',
            paragrafi: [
                'Unnivai ti serve un giro a piedi. Per farlo ha bisogno di un account, di quello che ti piace e, se vuoi, di dove sei.',
                'Non vendiamo i tuoi dati. Non mostriamo pubblicità. Non usiamo strumenti di statistica o di tracciamento di terzi.',
                'Il tuo percorso sul telefono non viene salvato sui nostri server: la posizione serve a calcolare il giro e a guidarti, poi resta solo sul tuo telefono.',
                'I testi dei giri li scrivono servizi AI di aziende esterne (Anthropic e OpenAI): te lo chiediamo prima, una volta sola.',
                'Puoi cancellare l\'account e i tuoi dati in qualsiasi momento da Profilo → Elimina account.',
            ],
        },
        {
            id: 'flussi',
            titolo: 'Quali dati partono, verso chi, perché e per quanto',
            paragrafi: ['Uno per uno. Dove i tempi di conservazione non sono fissati dal codice lo scriviamo chiaro.'],
            flussi: [
                {
                    nome: 'Account e accesso (Supabase)',
                    parte: 'Email e password (la password la gestisce Supabase: noi non la vediamo), nome e città se li inserisci. Con «Prova un giro, senza account» nasce un account anonimo: un codice casuale, nessuna email.',
                    verso: 'Supabase (database e autenticazione). I dati stanno nell\'Unione Europea, regione eu-west-1 (Irlanda).',
                    perche: 'Per farti entrare e ritrovare i tuoi giri.',
                    resta: 'Finché l\'account esiste. Se lo elimini, spariscono subito. Un account anonimo registrato dopo il giro di prova diventa un account normale, con lo stesso codice.',
                },
                {
                    nome: 'Profilo, gusti e DNA dei giri (Supabase)',
                    parte: 'Interessi, preferenze di cibo e dieta, ritmo e compagnia che dichiari, gli eventi dei tuoi giri (giri fatti, città, categorie e tappe), i giri salvati, i preferiti, le notifiche.',
                    verso: 'Il nostro database su Supabase.',
                    perche: 'Per costruire giri che ti somigliano e per mostrarti il tuo Profilo.',
                    resta: 'Finché l\'account esiste, o finché non cancelli il singolo elemento dal Profilo.',
                },
                {
                    nome: 'Contatori di utilizzo (Supabase)',
                    parte: 'Quanti giri generi al giorno, legato al tuo codice utente. Per chi non ha account, un\'impronta (hash) dell\'indirizzo IP, non l\'IP in chiaro, per il limite giornaliero.',
                    verso: 'Il nostro database su Supabase.',
                    perche: 'Per tenere sotto controllo i costi e gli abusi.',
                    resta: 'I biglietti delle singole generazioni 2 giorni; il contatore giornaliero finché l\'account esiste.',
                },
                {
                    nome: 'Errori e uso della navigazione (Supabase)',
                    parte: 'Se l\'app va in errore: messaggio tecnico, indirizzo della pagina, tipo di telefono e browser e, se sei dentro, il tuo codice utente. In navigazione: inizio, tappe raggiunte, fine o abbandono del giro. Mai coordinate né percorso.',
                    verso: 'Il nostro database su Supabase.',
                    perche: 'Per riparare gli errori e capire dove la navigazione si inceppa.',
                    resta: 'Oggi senza scadenza automatica. Con l\'eliminazione dell\'account li cancelliamo.',
                },
                {
                    nome: 'File che carichi (Supabase Storage)',
                    parte: 'Foto e immagini che carichi, dove la funzione è attiva.',
                    verso: 'Supabase Storage (bucket tour-images e business-media).',
                    perche: 'Per mostrarle nell\'app.',
                    resta: 'Finché non le togli o non elimini l\'account (i tuoi file vengono cancellati con lui).',
                },
                {
                    nome: 'Posizione (GPS del telefono)',
                    parte: 'La tua posizione, solo se dai il permesso (sull\'iPhone «Durante l\'uso»). Serve a trovare la città, a partire da dove sei e a guidarti passo passo.',
                    verso: 'Resta sul telefono. Le sue coordinate partono, senza il tuo nome, verso i servizi della riga qui sotto: Google (luoghi e mappa), Open-Meteo (meteo), OpenStreetMap/Nominatim (via e quartiere) e, per il testo, Anthropic.',
                    perche: 'Per trovare luoghi vicini, calcolare il percorso, dirti il meteo, raccontarti la via.',
                    resta: 'Sul telefono, nel browser (localStorage), finché esci dall\'account o cancelli i dati del sito. Sui nostri server non salviamo il tuo percorso. Se neghi il permesso, l\'app usa la città che scegli o una posizione approssimativa dall\'indirizzo IP (vedi ipapi.co).',
                },
                {
                    nome: 'Google: luoghi, foto e mappa',
                    parte: 'Ricerche di luoghi (nome, tipo, coordinate del centro del giro) dai nostri server tramite places-proxy; la mappa e le foto dei luoghi si caricano dal tuo telefono da Google, che vede il tuo indirizzo IP e l\'area che guardi. Google converte anche coordinate in nome della città.',
                    verso: 'Google (Maps, Places, Geocoding).',
                    perche: 'Per mostrare la mappa, trovare e verificare i luoghi, orari e foto.',
                    resta: 'Le risposte delle ricerche stanno 24 ore nella nostra cache condivisa, senza alcun dato personale. Presso Google valgono le sue regole.',
                },
                {
                    nome: 'Anthropic (Claude): i testi',
                    parte: 'Per scrivere un giro: la tua richiesta, la città, durata, ritmo, compagnia, interessi, preferenze di cibo e una sintesi dei tuoi gusti (DNA). Per i racconti: nome e fonti pubbliche del luogo. Per la chat: la domanda, gli ultimi turni, le tappe del giro. Per le curiosità: coordinate, via e quartiere. Non parte l\'email né il nome.',
                    verso: 'Anthropic, tramite una nostra funzione sul server (openai-proxy): la chiave non è mai sul telefono.',
                    perche: 'Per scrivere i giri, i racconti, le risposte e le curiosità.',
                    resta: 'Noi non salviamo la chat. I racconti dei luoghi (che non contengono dati tuoi) stanno 30 giorni, quelli scartati 7. Presso Anthropic valgono le sue regole sul trattamento dei dati.',
                },
                {
                    nome: 'OpenAI: la voce e il ripiego del testo',
                    parte: 'Per la voce in navigazione: la frase da dire (per esempio «Fra cinquanta metri gira a sinistra») e la voce scelta. Se Anthropic non risponde, il testo del giro può essere scritto da OpenAI: allora riceve gli stessi dati descritti sopra per Anthropic.',
                    verso: 'OpenAI (modello gpt-4o-mini-tts per la voce), tramite la stessa funzione sul server.',
                    perche: 'Per darti una voce umana invece di quella del telefono.',
                    resta: 'Gli audio delle frasi, che non contengono dati tuoi, restano nella nostra cache (Supabase Storage, bucket voce-cache) senza scadenza automatica, così una frase già detta non si rigenera. Presso OpenAI valgono le sue regole.',
                },
                {
                    nome: 'Wikipedia, Wikidata e OpenStreetMap (Overpass)',
                    parte: 'Il nome del luogo e le sue coordinate, per cercare le voci e i dati pubblici. Nessun dato personale, ma chi risponde vede l\'indirizzo IP del telefono o del nostro server.',
                    verso: 'Wikimedia (it.wikipedia.org, wikidata.org) e overpass-api.de.',
                    perche: 'Per i racconti con fonti vere e per i dati dei luoghi.',
                    resta: 'Non conserviamo le risposte legate a te.',
                },
                {
                    nome: 'Nominatim e Photon (OpenStreetMap)',
                    parte: 'Le coordinate del telefono, per ottenere via e quartiere; gli indirizzi che digiti nella ricerca.',
                    verso: 'nominatim.openstreetmap.org dal telefono; photon.komoot.io dai nostri server come ripiego.',
                    perche: 'Per dirti dove sei e raccontarti la via.',
                    resta: 'Non conserviamo le risposte legate a te. Presso OpenStreetMap valgono le sue regole.',
                },
                {
                    nome: 'Meteo (Open-Meteo)',
                    parte: 'Coordinate o nome della città.',
                    verso: 'api.open-meteo.com e geocoding-api.open-meteo.com.',
                    perche: 'Per il meteo del giro.',
                    resta: 'Non conserviamo le risposte legate a te.',
                },
                {
                    nome: 'Posizione approssimata dall\'IP (ipapi.co)',
                    parte: 'Il tuo indirizzo IP, solo se il GPS non c\'è o lo neghi.',
                    verso: 'ipapi.co.',
                    perche: 'Per proporti una città di partenza.',
                    resta: 'Non la salviamo sui nostri server.',
                },
                {
                    nome: 'Hosting del sito (Vercel)',
                    parte: 'Come per ogni sito: indirizzo IP e dati tecnici della richiesta.',
                    verso: 'Vercel, che serve unnivai.vercel.app.',
                    perche: 'Per farti arrivare l\'app.',
                    resta: 'Secondo i tempi dei log di Vercel.',
                },
                {
                    nome: 'Caratteri (Google Fonts)',
                    parte: 'Il tuo indirizzo IP, quando il sito carica i caratteri.',
                    verso: 'fonts.googleapis.com.',
                    perche: 'Per scrivere il testo con i caratteri di Unnivai.',
                    resta: 'Non lo salviamo noi.',
                },
                {
                    nome: 'Email (Resend)',
                    parte: 'Il tuo indirizzo email e il testo del messaggio, quando ti scriviamo (conferma dell\'iscrizione alla lista d\'attesa, accesso, password), se il servizio è attivo.',
                    verso: 'Resend.',
                    perche: 'Per spedirti le email di Unnivai.',
                    resta: 'La lista d\'attesa finché non chiedi di uscire o di cancellarti.',
                },
                {
                    nome: 'Pagamenti (Stripe)',
                    parte: 'Oggi l\'app non chiede pagamenti: nessun dato di pagamento parte dal tuo telefono. Il codice contiene la predisposizione per le prenotazioni a pagamento con Stripe: se la attiviamo, questa pagina cambia prima.',
                    verso: 'Nessuno oggi.',
                    perche: '—',
                    resta: '—',
                },
                {
                    nome: 'Sul tuo telefono (localStorage)',
                    parte: 'Preferenze, ultimo giro, giri in corso, città, copia dei tuoi gusti, impostazioni delle notifiche, il consenso ai servizi AI. Sono cookie tecnici e memoria del browser: nessuna pubblicità, nessun tracciamento.',
                    verso: 'Nessuno: restano sul telefono.',
                    perche: 'Perché l\'app funzioni e riparta da dove eri.',
                    resta: 'Finché esci dall\'account o cancelli i dati del sito. Quando esci, cancelliamo quelli legati a te.',
                },
            ],
        },
        {
            id: 'base',
            titolo: 'Perché possiamo trattare i tuoi dati',
            paragrafi: [
                'Per farti funzionare l\'app (account, giri, mappa) il trattamento serve al servizio che chiedi.',
                'Per mandare il testo ai servizi AI di terzi ti chiediamo il consenso, una volta sola. Puoi dirlo anche dopo: senza, le funzioni AI non partono.',
                'Per la posizione ti chiede il permesso il telefono. Puoi toglierlo quando vuoi dalle impostazioni.',
            ],
        },
        {
            id: 'diritti',
            titolo: 'I tuoi diritti',
            paragrafi: [
                'Puoi chiedere di vedere i tuoi dati, correggerli, cancellarli, riceverli in un formato leggibile, limitarne o contestarne l\'uso.',
                'La cancellazione la fai da solo: Profilo → Elimina account. Toglie account, profilo, giri, preferiti, notifiche, DNA, file e le righe tecniche legate a te.',
                `Per il resto scrivi a ${SEGNAPOSTO.CONTATTO}.`,
                'Se pensi che i tuoi dati siano trattati male puoi fare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).',
            ],
        },
        {
            id: 'minori',
            titolo: 'Età',
            paragrafi: [SEGNAPOSTO.ETA],
        },
        {
            id: 'modifiche',
            titolo: 'Se questa pagina cambia',
            paragrafi: [
                `Ultimo aggiornamento: ${DATA_AGGIORNAMENTO}. Se aggiungiamo un servizio che riceve dati tuoi, lo scriviamo qui prima.`,
            ],
        },
    ],
};

export const TERMINI = {
    titolo: 'Termini',
    sottotitolo: 'Le regole per usare Unnivai, senza giri di parole.',
    sezioni: [
        {
            id: 'chi',
            titolo: 'Chi siamo',
            paragrafi: [
                `Unnivai è offerto da ${SEGNAPOSTO.TITOLARE}, ${SEGNAPOSTO.INDIRIZZO}. Contatto: ${SEGNAPOSTO.CONTATTO}.`,
            ],
        },
        {
            id: 'cosa',
            titolo: 'Cosa fa Unnivai',
            paragrafi: [
                'Unnivai costruisce giri a piedi nelle città italiane: sceglie le tappe, ti guida e ti racconta i luoghi.',
                'I giri e i racconti li scrive un\'intelligenza artificiale a partire da fonti pubbliche e da quello che ci dici. Può sbagliare.',
            ],
        },
        {
            id: 'account',
            titolo: 'Il tuo account',
            paragrafi: [
                'Puoi provare un giro senza account. Per salvarlo e rifarne altri serve un account con email e password.',
                'Tieni al sicuro la password. Quello che succede dal tuo account lo consideriamo fatto da te.',
                'Puoi eliminare l\'account quando vuoi da Profilo → Elimina account. Non si torna indietro.',
            ],
        },
        {
            id: 'verifica',
            titolo: 'Verifica prima di partire',
            paragrafi: [
                'Orari, aperture, prezzi e percorsi cambiano. Prima di andare controlla che il posto sia aperto.',
                'Cammina guardando la strada, non lo schermo. Attraversa dove è sicuro. Il giro è un suggerimento: la decisione, e la prudenza, sono tue.',
                'Le informazioni sui luoghi arrivano da fonti pubbliche (come Wikipedia e Google). Le citiamo nell\'app. Non possiamo garantire che siano complete o aggiornate.',
            ],
        },
        {
            id: 'uso',
            titolo: 'Come si usa',
            paragrafi: [
                'Usa Unnivai per te. Non copiare in blocco i contenuti, non scavalcare i limiti giornalieri, non cercare di far fare all\'AI cose che l\'app non prevede.',
                'Ci sono limiti giornalieri sui giri, per tenere i costi sotto controllo. Quando li raggiungi, l\'app te lo dice.',
                'Se carichi foto o testi, devono essere tuoi o devi avere il diritto di usarli.',
            ],
        },
        {
            id: 'terzi',
            titolo: 'Servizi di terzi',
            paragrafi: [
                'L\'app si appoggia ad altri servizi (mappe, luoghi, meteo, intelligenza artificiale, hosting). Se uno si ferma, una parte dell\'app può non funzionare. Chi riceve cosa è scritto nella pagina Privacy.',
            ],
        },
        {
            id: 'contenuti',
            titolo: 'Di chi sono i contenuti',
            paragrafi: [
                'Il nome, il marchio, il codice e il disegno di Unnivai sono del titolare.',
                'I giri che generi per te puoi usarli per te. I testi tratti da Wikipedia mantengono la loro licenza e la fonte è indicata.',
            ],
        },
        {
            id: 'responsabilita',
            titolo: 'Responsabilità',
            paragrafi: [
                'Facciamo il possibile perché l\'app funzioni, ma non possiamo prometterti che sia sempre disponibile e senza errori. Nei limiti consentiti dalla legge, non rispondiamo dei danni che derivano dall\'uso di un giro, di un orario o di un racconto sbagliato. I diritti che la legge ti riconosce come consumatore restano.',
            ],
        },
        {
            id: 'legge',
            titolo: 'Legge applicabile',
            paragrafi: [SEGNAPOSTO.FORO],
        },
        {
            id: 'modifiche',
            titolo: 'Se questa pagina cambia',
            paragrafi: [`Ultimo aggiornamento: ${DATA_AGGIORNAMENTO}. Le modifiche importanti te le diciamo nell\'app.`],
        },
    ],
};
