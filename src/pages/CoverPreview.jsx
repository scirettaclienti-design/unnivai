/**
 * PAGINA TEMPORANEA DI ANTEPRIMA & VERIFICA ESTETICA
 * ⚠️ NOTA: Questo modulo (/cover-preview) è temporaneo per la revisione visiva
 * e verrà rimosso prima di qualsiasi merge in main.
 */
import React from 'react';
import TourCover from '@/components/TourCover';

// Stessa sequenza mista d'uso reale
const SHUFFLED_CATEGORIES = [
    { key: 'food',     category: 'food' },     // Tier 1 - Arancio vivo zafferano
    { key: 'romance',  category: 'romance' },  // Tier 3 - Brace serale
    { key: 'storia',   category: 'storia' },   // Tier 2 - Bronzo antico
    { key: 'walking',  category: 'walking' },  // Tier 1 - Ambra dorata
    { key: 'shopping', category: 'shopping' }, // Tier 1 - Rame chiaro
    { key: 'insider',  category: 'insider' },  // Tier 3 - Ossidiana ambrata
    { key: 'art',      category: 'art' },      // Tier 2 - Terracotta argilla
    { key: 'natura',   category: 'natura' },   // Tier 3 - Terra d'ombra
    { key: 'coffee',   category: 'coffee' },   // Tier 2 - Moka tostato
];

export default function CoverPreview() {
    return (
        <div className="min-h-screen bg-[#0E0C0B] text-[#F5F5F4] p-4 sm:p-6 font-quicksand">
            <header className="max-w-xs sm:max-w-sm mx-auto mb-6 text-center border-b border-[#26211E] pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#A8A29E]">
                    Palette Definitiva • Temperatura Aperta
                </span>
                <h1 className="text-xl font-black text-[#F5F5F4] mt-0.5">
                    Famiglia Calda & 3 Tier di Luce
                </h1>
                <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    Rosso-Terracotta → Ambra-Oro • Icone Lineari
                </p>
            </header>

            <main className="max-w-xs sm:max-w-sm mx-auto space-y-4 pb-16">
                {SHUFFLED_CATEGORIES.map((item, idx) => (
                    <div
                        key={`${item.key}-${idx}`}
                        className="relative h-44 w-full rounded-2xl overflow-hidden border border-[#26211E] bg-[#161311] shadow-lg"
                    >
                        <TourCover
                            cover={null}
                            category={item.category}
                            title=""
                            showGlyph={true}
                            verified={false}
                        />
                    </div>
                ))}
            </main>
        </div>
    );
}
