// C9-DIAGNOSI — com'e' fatto il pool di un giro, a 0 $: legge le risposte REGISTRATE dei proxy (C9_FIXTURE, e C9_EXTRA se c'e')
// e rifa il percorso del motore con le sue stesse funzioni (esclusioni, soglia di qualita', famiglie, categorie dei momenti, orari).
// Nessuna rete, nessuna modifica al motore. Scrive C9_POOL_OUT (JSON).
//
// Non si lancia da solo: npx vitest run -c scripts/banco/vitest.c9.config.js scripts/banco/diagnosi-c9-pool.live.js
import { it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { passesHardExclusions, isCityItself, applyQualityThreshold, applyGeoSanity } from '@/services/placesDiscoveryService';
import { zoneReason } from '@/lib/zone';
import { candidateFamily, candidateMomentCategories, isMealPlace } from '@/services/momentSelection';
import { openStatus } from '@/lib/openingHours';
import { MOMENTS } from '@/lib/dayMoments';
import { haversineKm } from '@/services/tourShape';

const FIX = process.env.C9_FIXTURE;
const EXTRA = process.env.C9_EXTRA;
const OUT = process.env.C9_POOL_OUT;
const CITTA = process.env.C9_CITTA || 'Catania';
const GIORNO = process.env.C9_GIORNO || '2026-10-15'; // giovedi'
const CENTRO = (process.env.C9_CENTRO || '37.5078836,15.0830032').split(',').map(Number); // il centro che il motore passa alla ricerca
// "Piazza Duomo": il punto di cui si chiede la distanza (Piazza duomo di Google; il Duomo e la Cattedrale stanno a pochi metri)
const DUOMO = (process.env.C9_PIAZZA || '37.5024087,15.0877191').split(',').map(Number);
if (!FIX || !OUT) throw new Error('C9_FIXTURE e C9_POOL_OUT mancanti');

const fix = JSON.parse(readFileSync(FIX, 'utf8')).risposte;
const extra = EXTRA && existsSync(EXTRA) ? JSON.parse(readFileSync(EXTRA, 'utf8')).risposte : {};
const tutte = { ...fix, ...extra };

// Il candidato come lo fa buildPOIFromCandidate (solo i campi che servono qui)
const comeCandidato = (p) => ({
    place_id: p.place_id, name: p.name, title: p.name, types: p.types || [], primaryType: p.primary_type ?? null, rating: p.rating || 0, user_ratings_total: p.user_ratings_total || 0,
    latitude: p.geometry?.location?.lat, longitude: p.geometry?.location?.lng, lat: p.geometry?.location?.lat, lng: p.geometry?.location?.lng,
    business_status: p.business_status || 'OPERATIONAL',
    ...(Array.isArray(p.opening_hours?.periods) ? { openingPeriods: p.opening_hours.periods } : {}),
    ...(p.current_opening_hours && Array.isArray(p.current_opening_hours.periods) ? { currentHours: p.current_opening_hours } : {}),
    ...(Number.isFinite(p.utc_offset_minutes) ? { utcOffsetMinutes: p.utc_offset_minutes } : {}),
});
const ricerche = Object.entries(tutte).filter(([k]) => k.startsWith('places|') && k.includes('path=place/textsearch'))
    .map(([k, v]) => ({
        query: (k.match(/query=([^&]*)/) || [])[1], radius: Number((k.match(/radius=(\d+)/) || [])[1]), location: (k.match(/location=([^&]*)/) || [])[1],
        risultati: v.corpo?.results || [], status: v.corpo?.status, cache: v.cache, daExtra: k in extra && !(k in fix),
    }));

// quando si e' aperti: l'arrivo in una fascia (sosta da 30 minuti), a passi di 30 minuti dentro la fascia
const arrivo = (hh, mm) => new Date(`${GIORNO}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+02:00`);
const fasce = Object.fromEntries(MOMENTS.filter(m => ['mattina', 'pomeriggio'].includes(m.key)).map(m => [m.key, m]));
const apertoInFascia = (c, f) => {
    const a = f.start.h * 60 + f.start.m, b = f.end.h * 60 + f.end.m;
    const inizio = openStatus(c, arrivo(f.start.h, f.start.m), 30).stato;
    let inQualchePunto = false, sempre = true, ignoto = false;
    for (let t = a; t + 30 <= b; t += 30) {
        const st = openStatus(c, arrivo(Math.floor(t / 60), t % 60), 30).stato;
        if (st === 'aperto') inQualchePunto = true; else if (st === 'sconosciuto') ignoto = true; else sempre = false;
    }
    return { inizio, inQualchePunto, tuttaLaFascia: sempre && !ignoto, sconosciuto: ignoto && !inQualchePunto };
};

const risultato = { citta: CITTA, giorno: GIORNO, centro: CENTRO, piazza: DUOMO, ricerche: [], candidati: [] };
it('pool', () => {
    const visti = new Map();
    for (const r of ricerche) {
        const raw = r.risultati;
        const hard = raw.filter(passesHardExclusions);
        const nonCitta = hard.filter(c => !isCityItself(c, CITTA));
        const senzaZone = nonCitta.filter(c => !zoneReason({ ...c, primaryType: c.primary_type ?? c.primaryType }, CITTA));
        const geo = applyGeoSanity(senzaZone, CENTRO[0], CENTRO[1], CITTA);
        // il motore passa a ogni ricerca il tipo di soglia GLOBALE ("kind globale"): CULTURA per le richieste vaghe (vedi il registro del giro)
        const { pois, scaleLevel } = applyQualityThreshold(geo, process.env.C9_SOGLIA || 'CULTURA', false);
        const tenuti = pois.slice(0, 12);
        // lo stato di OGNI risultato grezzo, nell'ordine in cui Google li ha dati
        const idSoglia = new Set(pois.map(c => c.place_id)), idTenuti = new Set(tenuti.map(c => c.place_id)), idGeo = new Set(geo.map(c => c.place_id));
        const stato = (c) => {
            if (!passesHardExclusions(c)) return 'escluso: dati o tipo (rating 0, servizio, area)';
            if (isCityItself(c, CITTA)) return 'escluso: e\' la citta\'';
            const z = zoneReason({ ...c, primaryType: c.primary_type ?? c.primaryType }, CITTA);
            if (z) return `escluso: zona (${z})`;
            if (!idGeo.has(c.place_id)) return 'escluso: troppo lontano';
            if (!idSoglia.has(c.place_id)) return 'sotto la soglia di qualita\'';
            if (!idTenuti.has(c.place_id)) return 'tagliato: oltre i primi 12';
            return 'tenuto';
        };
        const righe = raw.map((c, i) => ({ pos: i + 1, nome: c.name, tipo: c.primary_type ?? null, rating: c.rating ?? null, recensioni: c.user_ratings_total ?? null, stato: stato(c) }));
        risultato.ricerche.push({
            query: r.query, raggio: r.radius, centro: r.location, cache: r.cache, daExtra: r.daExtra, grezzi: raw.length, dopoEsclusioni: hard.length, dopoCitta: nonCitta.length, dopoZone: senzaZone.length,
            sopraSoglia: pois.length, livelloSoglia: scaleLevel, tenuti: tenuti.length,
            tenutiNomi: tenuti.map(c => c.name), scartatiDalTaglio: pois.slice(12).map(c => c.name), righe,
        });
        for (const c of tenuti) if (!visti.has(c.place_id)) visti.set(c.place_id, { c, da: r.query });
    }
    for (const { c: p, da } of visti.values()) {
        const c = comeCandidato(p);
        const pasto = isMealPlace(c);
        const cat = [...candidateMomentCategories(c)];
        const o = { mattina: apertoInFascia(c, fasce.mattina), pomeriggio: apertoInFascia(c, fasce.pomeriggio) };
        const kmDuomo = haversineKm(DUOMO[0], DUOMO[1], c.latitude, c.longitude);
        risultato.candidati.push({
            nome: c.name, place_id: c.place_id, da, tipoPrincipale: c.primaryType, rating: c.rating, recensioni: c.user_ratings_total, pasto, famiglia: candidateFamily(c), categorie: cat,
            perMattina: cat.some(k => fasce.mattina && MOMENTS.find(m => m.key === 'mattina').categories.includes(k)),
            perPomeriggio: cat.some(k => MOMENTS.find(m => m.key === 'pomeriggio').categories.includes(k)),
            aperto: o, metriDalDuomo: Math.round(kmDuomo * 1000),
        });
    }
    writeFileSync(OUT, JSON.stringify(risultato, null, 1));
});
