// DNA-4 — la «fascia di DNA» che entra nella chiave di Per Te.
//
// Per Te non si rigenera a ogni gesto (DOPPIO-FIX): cambia solo quando il DNA cambia in modo che il motore se ne accorge.
// La fascia e' una stringa corta e stabile, calcolata dai pesi del DNA (dnaWeights, con `_share`):
//   - FIDUCIA a gradini, da `_share` (quanto il DNA pesa nel punteggio, 0..0,45):
//       0 = il DNA non agisce (share 0)   1 = poca (fino a 0,15: il seme, o 6-10 eventi)
//       2 = media (fino a 0,30)           3 = alta (oltre 0,30)
//   - le 2 CATEGORIE PIU' FORTI, ciascuna col suo livello: 1 = peso da 0,20 a 0,50, 2 = peso da 0,50 in su.
//     Sotto 0,20 una categoria non conta. A parita' di livello decide l'ordine alfabetico (mai il peso grezzo:
//     un +0,05 dentro lo stesso livello non puo' cambiare la fascia).
// Con share 0 la fascia e' sempre `dna0`, qualunque siano i pesi: il motore non li legge, rigenerare sarebbe spendere per niente.
import { CORE_CATEGORIES } from '@/services/preferenceEngine';

export const FASCIA_SOGLIA_LIVELLO_1 = 0.2;
export const FASCIA_SOGLIA_LIVELLO_2 = 0.5;
export const FASCIA_CATEGORIE = 2;
export const FASCIA_FIDUCIA_POCA_FINO_A = 0.15;
export const FASCIA_FIDUCIA_MEDIA_FINO_A = 0.3;

/** 0 / 1 poca / 2 media / 3 alta, da `_share`. */
export function gradinoFiducia(share) {
    const s = Number(share);
    if (!Number.isFinite(s) || s <= 0) return 0;
    if (s <= FASCIA_FIDUCIA_POCA_FINO_A) return 1;
    if (s <= FASCIA_FIDUCIA_MEDIA_FINO_A) return 2;
    return 3;
}

const livello = (peso) => {
    const p = Number(peso);
    if (!Number.isFinite(p) || p < FASCIA_SOGLIA_LIVELLO_1) return 0;
    return p < FASCIA_SOGLIA_LIVELLO_2 ? 1 : 2;
};

/** La fascia di DNA, es. `f1:food2+natura1`, `f3:cultura1`, `f1:-` (fiducia ma nessuna categoria forte) o `dna0`. */
export function fasciaDna(dnaWeights) {
    const f = gradinoFiducia(dnaWeights?._share);
    if (f === 0) return 'dna0';
    const forti = CORE_CATEGORIES
        .map((cat) => ({ cat, lv: livello(dnaWeights?.[cat]) }))
        .filter((c) => c.lv > 0)
        .sort((a, b) => b.lv - a.lv || a.cat.localeCompare(b.cat))
        .slice(0, FASCIA_CATEGORIE);
    return `f${f}:${forti.length ? forti.map((c) => `${c.cat}${c.lv}`).join('+') : '-'}`;
}
