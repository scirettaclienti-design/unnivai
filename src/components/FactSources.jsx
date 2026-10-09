import React from 'react';
import { FONTI_INFO } from '@/services/factsService';

// P3d-e — l'attribuzione dei fatti aperti, sotto la tappa che li ha usati.
// Wikipedia (CC BY-SA) chiede attribuzione e licenza; OpenStreetMap (ODbL)
// chiede "© OpenStreetMap contributors" con il link al copyright. Una tappa
// senza fonti (frase sicura del codice, nessun fatto trovato) non mostra nulla.
const ORDINE = ['wikipedia', 'wikidata', 'osm'];

export function FactSources({ fonti, className = '' }) {
    const list = Array.isArray(fonti) ? fonti.filter(f => f && FONTI_INFO[f.fonte]) : [];
    if (list.length === 0) return null;
    const perFonte = new Map();
    for (const f of list) if (!perFonte.has(f.fonte)) perFonte.set(f.fonte, f);
    const voci = ORDINE.filter(k => perFonte.has(k)).map(k => {
        const f = perFonte.get(k);
        if (k === 'wikipedia') {
            return (
                <span key={k}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">Wikipedia</a>
                    {' '}(<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.it" target="_blank" rel="noopener noreferrer" className="underline">CC BY-SA</a>)
                </span>
            );
        }
        if (k === 'wikidata') {
            return <a key={k} href={f.url} target="_blank" rel="noopener noreferrer" className="underline">Wikidata</a>;
        }
        return <a key={k} href={FONTI_INFO.osm.home} target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>;
    });
    return (
        <p data-fact-sources className={`text-[10px] text-obsidian-secondary leading-snug mt-1 ${className}`}>
            Fonti:{' '}
            {voci.map((v, i) => (
                <React.Fragment key={i}>{i > 0 ? ' · ' : ''}{v}</React.Fragment>
            ))}
        </p>
    );
}

export default FactSources;
