// F37 — il voto del POI nella card mappa era fabbricato.
//
// POIPopupCard.jsx:51-53 diceva, nel commento stesso:
//     // Fake rating since we might not always have it mapped
//     const [rating, setRating]   = useState(poi.rating || 4.5);
//     const [reviews, setReviews] = useState(poi.user_ratings_total || Math.floor(Math.random() * 500) + 50);
//
// Due difetti distinti:
//
//  1) `|| 4.5` — un voto scritto a mano per un luogo che non ne ha uno.
//
//  2) `Math.random()` — peggio di un default fisso, perche' NON e' stabile:
//     lo stesso identico POI mostrava un conteggio recensioni diverso a ogni
//     apertura del popup. E non era nemmeno un ramo raro: il chiamante
//     (MapPage.jsx:1496) scrive `reviewsCount`, mentre la card leggeva
//     `user_ratings_total`. Il lato sinistro era SEMPRE undefined, quindi il
//     numero casuale usciva sempre — anche per un POI Google con recensioni
//     vere, il cui conteggio reale veniva scartato.
//
// La convenzione di riferimento e' nel fratello che riceve lo STESSO oggetto
// (`selectedPOI` di MapPage): POIDetailDrawer.jsx:81 calcola
// `Number.isFinite(poi.rating) && poi.rating > 0` e monta il blocco rating
// solo su quello, col conteggio annidato dentro.
//
// Il test monta il componente vero. Nessun mock: senza `googlePlaceId`
// l'effect foto esce subito e non importa placesDiscoveryService.

import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { POIPopupCard } from '@/components/Map/POIPopupCard';

afterEach(cleanup);

// POI senza voto: e' il caso normale di un pin che non viene da Google Places.
const POI_SENZA_VOTO = Object.freeze({
    id: 'poi-1',
    name: 'Trattoria Portixedda',
    category: 'RISTORANTE',
    city: 'Oristano',
    description: 'Via Giuseppe Mazzini 12',
});

// POI Google con voto e conteggio REALI, nella forma in cui MapPage li scrive.
const POI_CON_VOTO = Object.freeze({
    ...POI_SENZA_VOTO,
    rating: 4.6,
    reviewsCount: 128,
});

const noop = () => {};
const renderCard = (poi) => render(
    createElement(POIPopupCard, { poi, onClose: noop, onNavigate: noop })
);

describe('POIPopupCard — il voto non si inventa (F37)', () => {
    it('senza voto reale non mostra nessun numero: ne\' il 4.5, ne\' un conteggio recensioni', () => {
        const { container } = renderCard(POI_SENZA_VOTO);
        const testo = container.textContent;

        expect(testo).not.toContain('4.5');
        // Nessun "(n)" — il conteggio recensioni non esiste per questo POI.
        expect(testo).not.toMatch(/\(\d/);
    });

    it('senza voto la riga resta la sola categoria, senza il "•" orfano', () => {
        const { container } = renderCard(POI_SENZA_VOTO);

        // La categoria c'e' ancora: e' un dato vero e non dipende dal rating.
        expect(screen.getByText('RISTORANTE')).toBeInTheDocument();
        // Il separatore apparteneva al blocco rating: senza rating sparisce con lui.
        expect(container.textContent).not.toContain('•');
    });

    it('lo stesso POI produce lo stesso output a ogni montaggio (niente Math.random)', () => {
        const rendering = [];
        for (let i = 0; i < 6; i++) {
            const { container } = renderCard(POI_SENZA_VOTO);
            rendering.push(container.innerHTML);
            cleanup();
        }

        // Con Math.floor(Math.random() * 500) + 50 questi sei differiscono quasi
        // sempre: 450 valori possibili, sei estrazioni indipendenti.
        expect(new Set(rendering).size).toBe(1);
    });

    it('con voto e conteggio reali li mostra entrambi, e rimette il "•"', () => {
        const { container } = renderCard(POI_CON_VOTO);

        expect(screen.getByText('4.6')).toBeInTheDocument();
        // 128 e' il valore REALE passato da MapPage come `reviewsCount`.
        expect(screen.getByText('(128)')).toBeInTheDocument();
        expect(container.textContent).toContain('•');
        expect(screen.getByText('RISTORANTE')).toBeInTheDocument();
    });

    it('legge il conteggio da reviewsCount (quello che MapPage scrive davvero)', () => {
        renderCard({ ...POI_SENZA_VOTO, rating: 4.2, reviewsCount: 73 });
        expect(screen.getByText('(73)')).toBeInTheDocument();
    });

    it('accetta ancora user_ratings_total come alias, se arriva da una sorgente Places grezza', () => {
        renderCard({ ...POI_SENZA_VOTO, rating: 4.2, user_ratings_total: 91 });
        expect(screen.getByText('(91)')).toBeInTheDocument();
    });

    it('un voto presente ma a zero non e\' un voto: niente blocco rating', () => {
        const { container } = renderCard({ ...POI_SENZA_VOTO, rating: 0, reviewsCount: 0 });
        expect(container.textContent).not.toContain('0.0');
        expect(container.textContent).not.toContain('•');
    });
});
