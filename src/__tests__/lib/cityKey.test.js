import { describe, it, expect } from 'vitest';
import { findCityKey } from '@/lib/cityKey';

// Gate C1 — findCityKey e' il sostituto della normalizzazione Title Case.
//
// Quattro punti del repo riscrivevano il nome citta' in
//     s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
// per far funzionare due lookup a chiave esatta (CITY_COORDS in
// userContextService, CITY_CONFIG in QuickPath). Funzionava sulle chiavi a
// parola singola e distruggeva ogni altro nome — e il nome distrutto veniva
// persistito (localStorage + profiles.current_city_override).
//
// Qui si verifica l'unica cosa che quella riga faceva di utile — far matchare
// il lookup a meno di maiuscole — SENZA la cosa dannosa: la funzione
// restituisce una CHIAVE della tabella, mai una versione riscritta del nome.

// Le chiavi vere delle due tabelle, per non testare su un giocattolo.
const CITY_COORDS = {
    'Roma':    { lat: 41.9028, lng: 12.4964 },
    'Milano':  { lat: 45.4642, lng: 9.1900 },
    'Napoli':  { lat: 40.8518, lng: 14.2681 },
    'Bologna': { lat: 44.4949, lng: 11.3426 },
};

const CITY_CONFIG = {
    'Roma':    { main: ['citta', 'natura', 'storia', 'cibo'] },
    'Milano':  { main: ['citta', 'moda', 'parchi', 'canali'] },
    'Napoli':  { main: ['mare', 'citta', 'vulcano', 'cibo'] },
    'default': { main: ['citta', 'natura', 'storia', 'relax'] },
};

describe('Gate C1 — findCityKey: il lookup regge le maiuscole', () => {
    it('la chiave esatta si trova', () => {
        expect(findCityKey(CITY_COORDS, 'Roma')).toBe('Roma');
    });

    it('tutto minuscolo trova la chiave (era il solo caso che la normalizzazione salvava)', () => {
        expect(findCityKey(CITY_COORDS, 'roma')).toBe('Roma');
    });

    it('tutto maiuscolo trova la chiave', () => {
        expect(findCityKey(CITY_COORDS, 'MILANO')).toBe('Milano');
    });

    it('maiuscole a caso trovano la chiave', () => {
        expect(findCityKey(CITY_COORDS, 'nApOlI')).toBe('Napoli');
    });

    it('gli spazi ai bordi non impediscono il match', () => {
        expect(findCityKey(CITY_COORDS, '  bologna  ')).toBe('Bologna');
    });
});

describe('Gate C1 — findCityKey restituisce una CHIAVE, non una stringa riscritta', () => {
    it('il valore restituito e\' identico alla chiave della tabella', () => {
        const key = findCityKey(CITY_COORDS, 'roma');
        expect(Object.keys(CITY_COORDS)).toContain(key);
        // ...e indicizza davvero la tabella: e' l'unico uso previsto.
        expect(CITY_COORDS[key]).toEqual({ lat: 41.9028, lng: 12.4964 });
    });

    it('non tocca il nome citta\' passato: quello resta affare del chiamante', () => {
        const cityName = 'Reggio Emilia';
        findCityKey(CITY_COORDS, cityName);
        expect(cityName).toBe('Reggio Emilia');
    });
});

describe('Gate C1 — findCityKey: citta\' fuori tabella', () => {
    it('un nome composto non in tabella restituisce null, non una chiave a caso', () => {
        expect(findCityKey(CITY_COORDS, 'Reggio Emilia')).toBeNull();
    });

    it('"L\'Aquila" non in tabella restituisce null', () => {
        expect(findCityKey(CITY_COORDS, "L'Aquila")).toBeNull();
    });

    it('"Forlì" non in tabella restituisce null', () => {
        expect(findCityKey(CITY_COORDS, 'Forlì')).toBeNull();
    });

    it('una tabella con chiave composta la trova comunque, a meno di maiuscole', () => {
        // Il confronto non e' legato ai nomi a parola singola: se un giorno
        // una tabella prende "Reggio Emilia" come chiave, funziona gia'.
        const T = { 'Reggio Emilia': 1, "L'Aquila": 2 };
        expect(findCityKey(T, 'reggio emilia')).toBe('Reggio Emilia');
        expect(findCityKey(T, "l'aquila")).toBe("L'Aquila");
    });
});

describe('Gate C1 — findCityKey: ignoreKeys e input degenere', () => {
    it('"default" NON e\' raggiungibile come se fosse il nome di una citta\'', () => {
        // CITY_CONFIG ha una voce 'default' che e' il fallback, non una citta'.
        expect(findCityKey(CITY_CONFIG, 'default', ['default'])).toBeNull();
        expect(findCityKey(CITY_CONFIG, 'DEFAULT', ['default'])).toBeNull();
    });

    it('escludere "default" non impedisce di trovare le citta\' vere', () => {
        expect(findCityKey(CITY_CONFIG, 'napoli', ['default'])).toBe('Napoli');
    });

    it('citta\' vuota, null o undefined → null, nessuna eccezione', () => {
        expect(findCityKey(CITY_COORDS, '')).toBeNull();
        expect(findCityKey(CITY_COORDS, '   ')).toBeNull();
        expect(findCityKey(CITY_COORDS, null)).toBeNull();
        expect(findCityKey(CITY_COORDS, undefined)).toBeNull();
    });

    it('tabella assente → null, nessuna eccezione', () => {
        expect(findCityKey(null, 'Roma')).toBeNull();
        expect(findCityKey(undefined, 'Roma')).toBeNull();
    });

    it('un valore non stringa non fa esplodere il lookup', () => {
        expect(findCityKey(CITY_COORDS, 42)).toBeNull();
        expect(findCityKey(CITY_COORDS, { city: 'Roma' })).toBeNull();
    });
});
