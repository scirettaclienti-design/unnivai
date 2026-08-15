// Gate FOTO — resolvePoiPhoto: una foto si mostra solo se ancorata al place_id.
//
// Caso reale (device 14-15/08): "Ippocampo" mostrava un cortile con ghiaia,
// "La Masseria" un parco giochi. La foto veniva da findPlaceFromQuery per nome,
// senza verificare che il risultato fosse lo stesso posto.

import { describe, it, expect } from 'vitest';
import { resolvePoiPhoto } from '../../lib/poiPhoto';

const POI = { googlePlaceId: 'ChIJ_abc123', name: 'La Masseria', city: 'Ippocampo' };
const FOTO = 'https://test.supabase.co/functions/v1/places-proxy?path=place%2Fphoto&photo_reference=xyz';

describe('Gate FOTO — resolvePoiPhoto', () => {
    it('poi con place_id + details con googlePhoto → ritorna l\'URL', () => {
        expect(resolvePoiPhoto(POI, { googlePhoto: FOTO })).toBe(FOTO);
    });

    it('senza googlePlaceId → null, qualunque foto arrivi', () => {
        // È il caso che ha prodotto il bug: senza ancoraggio, la foto poteva
        // essere di qualunque posto con un nome simile.
        expect(resolvePoiPhoto({ name: 'La Masseria', city: 'Ippocampo' }, { googlePhoto: FOTO })).toBeNull();
        expect(resolvePoiPhoto({ googlePlaceId: null }, { googlePhoto: FOTO })).toBeNull();
        expect(resolvePoiPhoto({ googlePlaceId: '' }, { googlePhoto: FOTO })).toBeNull();
    });

    it('details null (proxy off / timeout 5s / HTTP non ok / nessun result) → null', () => {
        expect(resolvePoiPhoto(POI, null)).toBeNull();
        expect(resolvePoiPhoto(POI, undefined)).toBeNull();
    });

    it('details senza googlePhoto → null', () => {
        expect(resolvePoiPhoto(POI, {})).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: null })).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: '' })).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: '   ' })).toBeNull();
    });

    it('URL Unsplash → null: non è mai la foto di un POI', () => {
        // STEP_FALLBACK_IMAGE di tourShape.js:13 è esattamente questo URL.
        expect(resolvePoiPhoto(POI, {
            googlePhoto: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
        })).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: 'http://images.unsplash.com/x.jpg' })).toBeNull();
    });

    it('poi null/undefined → null, nessun crash', () => {
        expect(resolvePoiPhoto(null, { googlePhoto: FOTO })).toBeNull();
        expect(resolvePoiPhoto(undefined, { googlePhoto: FOTO })).toBeNull();
        expect(resolvePoiPhoto(null, null)).toBeNull();
    });

    it('googlePhoto di tipo inatteso → null, nessun crash', () => {
        expect(resolvePoiPhoto(POI, { googlePhoto: 42 })).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: {} })).toBeNull();
        expect(resolvePoiPhoto(POI, { googlePhoto: [] })).toBeNull();
    });

    it('ritorna sempre string o null, mai undefined', () => {
        expect(resolvePoiPhoto(POI, { googlePhoto: FOTO })).toBeTypeOf('string');
        expect(resolvePoiPhoto(POI, null)).toBeNull();
        expect(resolvePoiPhoto({}, {})).toBeNull();
    });
});
