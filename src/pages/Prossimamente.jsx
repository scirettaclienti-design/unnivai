import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import TopBar from '../components/TopBar';
import BottomNavigation from '../components/BottomNavigation';
import { useUserContext } from '../hooks/useUserContext';

// Gate W — Schermate "Prossimamente" per Guide (V2), Attivita' (V3), Foto.
// Struttura comune, contenuto per `kind`. Voce brand: fatti asciutti, zero
// scuse, zero "torna piu' tardi", zero countdown. Un "Prossimamente" fatto
// bene e' una promessa, non un buco. Estetica finale passera' ad Antigravity.

// Contenuto per ognuna delle 3 schermate. `whenBuilder`/`subtitleBuilder`
// accettano il nome della citta' quando serve — Gate O.2 garantisce che
// city sia null (mai 'Roma' hardcoded) se non risolto → fallback "la tua citta'".
// Gate Y.4: badge = "IN COSTRUZIONE" (senza numero fase).
// L'utente esterno non ha idea dei passi V1/V2/V3 (gergo interno).
// "In costruzione" e' universalmente comprensibile, dice lo stato attuale
// senza chiedere di conoscere la roadmap. Il "quando arriva" lo dice il
// blocco QUANDO ARRIVA dentro la pagina, dove il contesto giustifica
// "Fase 2" (spiegato subito sotto).
const CONTENT = {
    guide: {
        phase: 'IN COSTRUZIONE',
        title: 'Guide Locali',
        subtitleBuilder: (cityLabel) =>
            `Persone del posto che ti fanno vedere ${cityLabel} da un ragazzo di ${cityLabel}.`,
        what:
            "Un pomeriggio, un weekend, mezza giornata. Con qualcuno che vive la citta' " +
            "che stai visitando. Chi decide dove andare, quanto restare, cosa vedere, sei " +
            "tu insieme a lui — non un itinerario stampato.",
        who:
            "A chi vuole il posto dietro il posto, non la spiegazione del monumento " +
            "davanti al monumento. A chi ha gia' visto il monumento e ora vuole sapere " +
            "dove va a mangiare chi ci lavora accanto.",
        when:
            "Fase 2. Quando la parte viaggiatore-piu'-AI (dove sei ora) sara' stabile " +
            "in mano ai primi utenti veri. Le guide arrivano poi, insieme, non prima: " +
            "ogni guida chiede tempo per essere certificata e questo lavoro parte solo " +
            "quando il resto tiene.",
        nowBuilder: (cityLabel) =>
            `La versione senza guida esiste gia' ed e' qui. L'AI ti costruisce un ` +
            `percorso su misura per ${cityLabel} oggi, con luoghi veri e orari veri.`,
    },
    attivita: {
        phase: 'IN COSTRUZIONE',
        title: 'Attivita\' Locali',
        subtitleBuilder: () =>
            'I posti che le guide portano davvero — non quelli che pagano per apparire.',
        what:
            "Ristoranti, botteghe, laboratori scelti perche' fanno bene una cosa, non " +
            "perche' pagano un abbonamento. Ogni attivita' dichiara chi e', cosa offre, " +
            "quali dati sono suoi e quali sono di Google. Zero elenchi sponsorizzati " +
            "travestiti da consigli.",
        who:
            "Ai posti veri, per esistere online senza doversi vendere. Al viaggiatore, " +
            "per non finire nella trattoria sponsorizzata che riempie Instagram e non " +
            "riempie il locale.",
        when:
            "Fase 3. Dopo le guide (Fase 2). L'ordine non e' casuale: le guide portano " +
            "gli utenti nei posti che conoscono. I posti si aggiungono a un tessuto che " +
            "esiste gia', non a un elenco vuoto.",
        nowBuilder: () =>
            'I luoghi che ti mostriamo oggi vengono da Google Places (rating vero, ' +
            'recensioni vere). Nessuno paga per apparire.',
    },
    foto: {
        phase: 'IN COSTRUZIONE',
        title: 'Le tue Foto',
        subtitleBuilder: () =>
            'Documenta il tuo percorso reale — non i posti che dovresti visitare.',
        what:
            "Ogni tour che completi ha uno spazio dove metti le foto tue. Quelle foto " +
            "restano nel tuo profilo, e con il tuo consenso possono aiutare gli utenti " +
            "successivi a vedere quel posto com'e' davvero, non nella versione filtrata " +
            "di Google.",
        who:
            "A te, per tenerti conto di cosa hai visto. Agli altri viaggiatori, per una " +
            "versione dei luoghi che non e' quella promozionale.",
        when:
            "Non ha una fase legata al lancio. Si attiva quando abbastanza tour saranno " +
            "stati completati dai primi utenti: prima di quella soglia, le foto degli " +
            "utenti sarebbero troppo poche per essere utili agli altri viaggiatori.",
        nowBuilder: () =>
            'Puoi gia\' completare un tour AI: quando la funzione foto sara\' attiva, ' +
            'la ritroverai collegata a quei tour.',
    },
};

export default function Prossimamente({ kind }) {
    const navigate = useNavigate();
    const { city } = useUserContext();
    // Gate W + O.2: city e' null se non risolto (mai 'Roma' hardcoded).
    // Fallback "la tua citta'" per non lasciare stringhe vuote nei template.
    const cityLabel = city || 'la tua citta\'';
    const content = CONTENT[kind] || CONTENT.guide;

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50/40 to-white pb-24">
            <TopBar />
            <div className="max-w-md mx-auto px-6 pt-4">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                    aria-label="Torna indietro"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Marcatore fase — smorzato, no pallino animato */}
                <div className="mb-5">
                    <span className="inline-flex items-center bg-terracotta-50 text-terracotta-700 text-[10px] font-bold px-3 py-1 rounded-full border border-terracotta-200 uppercase tracking-wider">
                        <span className="mr-1.5 text-sm leading-none">◇</span>
                        {content.phase}
                    </span>
                </div>

                <h1 className="text-3xl font-bold font-playfair text-gray-900 leading-tight mb-3">
                    {content.title}
                </h1>
                <p className="text-gray-600 text-base leading-relaxed mb-8">
                    {content.subtitleBuilder(cityLabel)}
                </p>

                <Section label="CHE COSA SARA'" text={content.what} />
                <Section label="A CHI SERVE" text={content.who} />
                <Section label="QUANDO ARRIVA" text={content.when} />
                <Section label="COSA FARE ORA" text={content.nowBuilder(cityLabel)} />

                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-6"
                >
                    <Link
                        to="/explore"
                        className="w-full inline-flex items-center justify-center gap-2 bg-terracotta-500 text-white font-bold py-3.5 px-5 rounded-2xl shadow-lg shadow-terracotta-500/20 hover:bg-terracotta-600 transition-colors"
                    >
                        Vai a esplorare
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.div>
            </div>
            <BottomNavigation />
        </div>
    );
}

function Section({ label, text }) {
    return (
        <div className="mb-6">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                — {label}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">{text}</p>
        </div>
    );
}
