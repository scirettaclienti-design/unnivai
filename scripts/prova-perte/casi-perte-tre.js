// PER-TE-TRE (T27) — i casi della prova di Per Te: Roma, Catania e Troina a tre ore (9:30, 13:00, 19:00) di venerdì 6/11/2026,
// ora solare, col DNA equivalente a quello di Ivano (natura ~46%, cibo ~39%, cultura ~20%: il suo non si legge dal suo account),
// fiducia alta. `comeLaHome`: la chiamata è quella di DashboardUser (i temi si cercano anche di sera, per le proposte «per domattina»,
// e il pool dell'insider segue il DNA). Nessun ritmo o compagnia (dnaGiro assente): vale il passo di difetto.
export const GIORNO_PERTE_TRE = '2026-11-06';
export const FUSO_PERTE_TRE = '+01:00';
export const DNA_IVANO_EQUIVALENTE = { natura: 0.46, food: 0.39, cultura: 0.2, _share: 0.45 };
const LUOGHI = ['Roma', 'Catania', 'Troina'];
const ORE = ['09:30', '13:00', '19:00'];
export const CASI_PERTE_TRE = LUOGHI.flatMap(luogo => ORE.map(ora => ({
    id: `t27-${luogo.toLowerCase()}-${ora.replace(':', '')}`, modo: 'perte', luogo, ora, giorno: GIORNO_PERTE_TRE,
    onboarding: null, attesa: luogo, dna: DNA_IVANO_EQUIVALENTE, comeLaHome: true,
})));
