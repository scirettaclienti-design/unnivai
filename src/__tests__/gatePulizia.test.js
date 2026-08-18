/**
 * Gate PULIZIA — test dei cinque diff.
 *
 * Regola del gate: un campo senza sorgente non si mostra. Questi test provano
 * che i default finti sono spariti e che al loro posto c'è `null`, non uno zero
 * o una stringa che a valle diventa un'affermazione ("Gratuito", "Max 10 Pers").
 *
 * I test su stringhe rimosse leggono il sorgente: sono la rete anti-regressione
 * per i pezzi di JSX che non passano da una funzione pura.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { useToast } from '@/hooks/use-toast';
import { normalizeTourStep } from '@/services/tourShape';
import { canonicalizeStopsFromCandidates } from '@/services/aiRecommendationService';

const SRC = resolve(__dirname, '..');

// I commenti del gate citano le stringhe rimosse per spiegare perché sono
// sparite. Un grep sul file grezzo le ritroverebbe lì e passerebbe/fallirebbe
// per il motivo sbagliato: qui si misura il codice, non la documentazione.
// Si tolgono i blocchi /* */ e le righe che iniziano con //. Le righe con un
// `//` a metà (URL) restano intatte, così nessuna stringa reale sparisce.
const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');

const read = (rel) => stripComments(readFileSync(resolve(SRC, rel), 'utf8'));

// Per le asserzioni di PRESENZA il problema non si pone (un commento non puo'
// far passare per sbaglio un `toContain` su codice che deve esserci), e lo
// stripper e' troppo grezzo su file con JSX comment annidati come App.jsx:
// mangerebbe righe di codice vere. Li si legge il file com'e'.
const readRaw = (rel) => readFileSync(resolve(SRC, rel), 'utf8');

// Cattura il messaggio composto da useToast leggendo l'evento che dispatcha.
const captureToast = (payload) => {
    let captured = null;
    const listener = (e) => { captured = e.detail; };
    window.addEventListener('dvai:toast', listener);
    try {
        const { toast } = useToast();
        toast(payload);
    } finally {
        window.removeEventListener('dvai:toast', listener);
    }
    return captured;
};

describe('P2 — composizione titolo+descrizione del toast', () => {
    it('NON produce ".:" quando il titolo finisce con un punto', () => {
        const { message } = captureToast({
            title: 'Non riesco a raggiungere i posti.',
            description: 'Riprova tra un attimo.',
        });
        expect(message).not.toContain('.:');
        expect(message).toBe('Non riesco a raggiungere i posti. Riprova tra un attimo.');
    });

    it('NON produce "!:" quando il titolo finisce con un punto esclamativo', () => {
        const { message } = captureToast({
            title: 'Grazie per la recensione!',
            description: 'Il tuo feedback aiuta la community.',
        });
        expect(message).not.toContain('!:');
        expect(message).toBe('Grazie per la recensione! Il tuo feedback aiuta la community.');
    });

    it('mantiene i due punti quando il titolo NON ha punteggiatura finale', () => {
        const { message } = captureToast({
            title: 'Errore',
            description: 'Non è stato possibile salvare la recensione.',
        });
        expect(message).toBe('Errore: Non è stato possibile salvare la recensione.');
    });

    it('senza description il titolo passa intatto', () => {
        const { message } = captureToast({ title: 'Impostazioni salvate!' });
        expect(message).toBe('Impostazioni salvate!');
    });

    it('propaga il type: ReviewModal non deve piu\' passare `variant`', () => {
        const { type } = captureToast({ title: 'Fatto', type: 'success' });
        expect(type).toBe('success');
        const src = read('components/ReviewModal.jsx');
        expect(src).not.toContain('variant:');
    });
});

describe('P5 — price non e\' piu\' defaultato a 0', () => {
    it('normalizeTourStep: senza price in input il campo e\' null, non 0', () => {
        const step = normalizeTourStep({ title: 'Bar del porto', description: 'x' }, 0, 'Manfredonia');
        expect(step.price).toBeNull();
        expect(step.price).not.toBe(0);
    });

    it('normalizeTourStep: un price reale sopravvive', () => {
        const step = normalizeTourStep({ title: 'Museo', price: 12 }, 0, 'Manfredonia');
        expect(step.price).toBe(12);
    });

    it('canonicalizeStopsFromCandidates: la tappa non espone alcun campo price', () => {
        const candidates = [{
            place_id: 'pid-1', name: 'Osteria Sotto Casa', rating: 4.6,
            latitude: 41.63, longitude: 15.917, type: 'food', city: 'Manfredonia',
        }];
        const aiStops = [{ place_id: 'pid-1', description: 'Odore di brace.', time: '20:30' }];
        const [stop] = canonicalizeStopsFromCandidates(aiStops, candidates);

        expect(stop).toBeTruthy();
        expect(stop.price).toBeUndefined();
        expect(Object.keys(stop)).not.toContain('price');
        // il rating reale di Google resta
        expect(stop.rating).toBe(4.6);
    });

    it('lo schema del prompt legacy non chiede piu\' price 0 ne\' rating 4.5', () => {
        const src = read('services/aiRecommendationService.js');
        expect(src).not.toContain('"price": 0');
        expect(src).not.toContain('"rating": 4.5');
    });

    it('i dieci default hardcoded di TourDetails sono spariti', () => {
        const src = read('pages/TourDetails.jsx');
        for (const fake of [
            'Guida virtuale intelligente selezionata per te.',
            'Destinazione Tour',
            '✨ Esperienza autentica',
            'Punto di partenza sulla mappa',
            'Itinerario digitale',
            'Supporto 24/7',
            'Sempre disponibile',
        ]) {
            expect(src).not.toContain(fake);
        }
        // "Max 10 Pers" non era una stringa letterale: nasceva da maxParticipants
        // defaultato a 10. Il default non esiste piu' e il badge e' sotto guardia.
        expect(src).not.toContain('maxParticipants ?? 10');
        expect(src).toContain('Number.isFinite(tour.maxParticipants)');
    });

    it('i render a lista sono protetti dall\'assenza (niente .map su undefined)', () => {
        const src = read('pages/TourDetails.jsx');
        expect(src).toContain('Array.isArray(tour.highlights) && tour.highlights.length > 0');
        expect(src).toContain('Array.isArray(tour.included) && tour.included.length > 0');
        expect(src).toContain('Array.isArray(tour.notIncluded) && tour.notIncluded.length > 0');
    });

    it('anche i CONTENITORI sono guardati: niente grid vuota dentro space-y-8', () => {
        // Un contenitore vuoto resta un figlio del wrapper `space-y-8` e si
        // porta dietro 2rem di margine: spazio morto a schermo. Vale per la
        // Info Grid, dove un tour da SurpriseTour non ha nessuno dei 4 campi.
        const src = read('pages/TourDetails.jsx');
        expect(src).toContain('{(tour.location || tour.duration ||');
        expect(src).toContain('tour.nextStart) && (');
    });

    it('la modale tappa di AiItinerary non mostra piu\' prezzo/foto/posizione', () => {
        const src = read('pages/AiItinerary.jsx');
        expect(src).not.toContain("'Gratuito'");
        expect(src).not.toContain('selectedStop.photos');
        expect(src).not.toContain('selectedStop.location');
    });

    it('PlaceDetailsView non afferma piu\' orari e distanza costanti', () => {
        const src = read('pages/TourDetails.jsx');
        expect(src).not.toContain('>Aperto<');
        expect(src).not.toContain('0.2 km');
    });
});

describe('P4 — i bottoni che portavano a una pagina inesistente', () => {
    it('AiItinerary non ha piu\' "Prenota Esperienza"', () => {
        expect(read('pages/AiItinerary.jsx')).not.toContain('Prenota Esperienza');
    });

    it('SurpriseTour non ha piu\' "Accetta Avventura" ne\' il blocco morto', () => {
        const src = read('pages/SurpriseTour.jsx');
        expect(src).not.toContain('Accetta Avventura');
        // `selectedSurpriseType` e' un altro state, vivo e usato: si asserisce
        // sullo state morto e sulla sua unica guardia, non sul prefisso comune.
        expect(src).not.toContain('setSelectedSurprise(');
        expect(src).not.toContain('{selectedSurprise &&');
    });

    it('SurpriseTour conserva la navigazione corretta, con id e state', () => {
        const src = read('pages/SurpriseTour.jsx');
        expect(src).toContain('navigate(`/tour-details/${mappedTour.id}`');
        expect(src).toContain('state: { tourData: mappedTour, isAiGenerated: true }');
    });

    it('nessun path utente punta piu\' a /tour-details senza id', () => {
        // GuidePlaceholder.jsx e' escluso di proposito: e' irraggiungibile
        // (V1LockedGuard non renderizza mai i children), quindi il suo
        // /tour-details/1 non e' un path utente. Vedi il test qui sotto.
        for (const f of ['pages/AiItinerary.jsx', 'pages/SurpriseTour.jsx']) {
            expect(read(f)).not.toContain('to="/tour-details"');
        }
    });

    it('GuidePlaceholder resta irraggiungibile: V1LockedGuard non monta i children', () => {
        const guard = readRaw('components/V1LockedGuard.jsx');
        expect(guard).toContain('return <Navigate to={`/prossimamente/${kind}`} replace />;');
        // il componente e' referenziato solo dentro le due rotte gia' wrappate
        const app = readRaw('App.jsx');
        expect(app).toContain('<V1LockedGuard kind="guide"><GuidePlaceholder type="chat" /></V1LockedGuard>');
        expect(app).toContain('<V1LockedGuard kind="guide"><GuidePlaceholder type="profile" /></V1LockedGuard>');
    });
});

describe('P6 — copy senza promesse che il codice non mantiene', () => {
    it('nessun empty state promette aggiunte periodiche di tour', () => {
        for (const f of ['pages/DashboardUser.jsx', 'pages/Explore.jsx']) {
            const src = read(f);
            expect(src).not.toContain('ogni settimana');
            expect(src).not.toContain('Torna presto');
        }
    });

    it('gli empty state offrono il generatore AI, che esiste davvero', () => {
        for (const f of ['pages/DashboardUser.jsx', 'pages/Explore.jsx']) {
            const src = read(f);
            expect(src).toContain('Nessuna guida ha ancora pubblicato un tour');
            expect(src).toContain('to="/ai-itinerary"');
        }
    });

    it('la conferma richiesta guida non afferma consegna ne\' filtro citta\'', () => {
        const src = read('pages/DashboardUser.jsx');
        expect(src).not.toContain('hanno appena ricevuto');
        expect(src).not.toContain('Le guide locali su');
        expect(src).not.toContain('Ti contatteranno presto');
        expect(src).toContain('È visibile alle guide registrate su DoveVAI. Se una guida la prende in carico, la proposta ti arriva qui.');
    });
});
