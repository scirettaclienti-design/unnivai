import { UtensilsCrossed, Landmark, Trees, Moon, Footprints, Coffee, ShoppingBag } from 'lucide-react';

// Gli interessi che l'utente sceglie (onboarding e Profilo). `seeds` sono gli id
// CORE che entrano nel seme del DNA. Un'unica definizione per le due schermate.
export const INTERESTS = [
    { id: 'food',      icon: UtensilsCrossed, label: 'Mangiare e bere',      seeds: ['food'] },
    { id: 'cultura',   icon: Landmark,        label: 'Storia e arte',        seeds: ['cultura', 'arte'] },
    { id: 'natura',    icon: Trees,           label: 'Natura e panorami',    seeds: ['natura'] },
    { id: 'nightlife', icon: Moon,            label: 'Vita notturna',        seeds: ['nightlife'] },
    { id: 'avventura', icon: Footprints,      label: 'Camminare e scoprire', seeds: ['avventura'] },
    { id: 'relax',     icon: Coffee,          label: 'Ritmo lento',          seeds: ['relax'] },
    { id: 'shopping',  icon: ShoppingBag,     label: 'Shopping e mercati',   seeds: ['shopping'] },
];

// id scelti → id CORE del seme (senza doppioni).
export const computeSeed = (selectedIds) => {
    const flat = selectedIds.flatMap(id => INTERESTS.find(i => i.id === id)?.seeds || []);
    return [...new Set(flat)];
};

// id CORE del seme → interessi scelti (l'inverso): un interesse e' scelto se
// tutti i suoi id CORE sono nel seme.
export const interestIdsFromSeed = (seedIds = []) =>
    INTERESTS.filter(i => i.seeds.every(s => seedIds.includes(s))).map(i => i.id);
