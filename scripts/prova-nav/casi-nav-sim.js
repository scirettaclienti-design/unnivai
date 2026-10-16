// NAV-SIM — i due giri veri su cui si simula la camminata (Crea il tuo Percorso, wizard vuoto: solo il testo).
// Si generano UNA volta col banco esteso e l'account di prova (BANCO_CASI=navsim-troina,navsim-catania), poi la prova WebKit
// li legge dal grezzo salvato. Il giorno è scelto perché la lista della città di quel «domani» sia già sul server
// (Troina 16/10, Catania 15/10, versione c10b-7): nessuna lista nuova da pagare.
export const TESTO_TROINA = 'fammi fare domani una giornata tra natura e luoghi storici';
export const TESTO_CATANIA = 'Domani una giornata nel centro di Catania';
const VUOTE = { budget: '', duration: '', interests: [], group: '', pace: '' };

export const CASI_NAV_SIM = [
    { id: 'navsim-troina', modo: 'crea', luogo: 'Troina', ora: '10:00', giorno: '2026-10-15', richiesta: TESTO_TROINA, prefs: VUOTE, onboarding: null },
    { id: 'navsim-catania', modo: 'crea', luogo: 'Catania', ora: '09:30', giorno: '2026-10-14', richiesta: TESTO_CATANIA, prefs: VUOTE, onboarding: null },
];
