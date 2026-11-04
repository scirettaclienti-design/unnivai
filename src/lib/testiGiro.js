/**
 * BANCO-DIFETTI-2 (T23) — I TESTI ONESTI DEL GIRO, in un file solo (voce Unnivai: il dato nudo, mai un aggettivo).
 *
 *  · `richiesta`: quando l'utente ha chiesto una cosa precisa (un luogo, un tipo di posto, un'ora) e il giro non la contiene,
 *    una riga dice quale e perche' (D6). La riga comincia con la cosa chiesta, come l'utente l'ha scritta.
 *
 * Funzioni pure: ricevono i fatti gia' misurati (km, ora, nome del posto) e li mettono in frase.
 */

const km1 = (km) => String(Math.round(km * 10) / 10).replace('.', ',');
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const maiuscola = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const TESTI_GIRO = {
    richiesta: {
        /** «Vaticano: i Musei Vaticani sono a 1,8 km dalle tappe del giro, oltre 1,2 km a piedi.» */
        lontano: ({ cosa, posto, km, capKm }) => `${maiuscola(cosa)}: ${posto ? `${posto} è` : 'il posto più vicino è'} a ${km1(km)} km dalle tappe del giro, oltre ${km1(capKm)} km a piedi.`,
        /** «Spa e centri benessere: a Catania quelli trovati sono chiusi nelle ore del giro.» */
        chiuso: ({ cosa, citta, uno = false }) => (uno
            ? `${maiuscola(cosa)}: è chiuso nelle ore in cui il giro ci passa.`
            : `${maiuscola(cosa)}: a ${citta} quelli trovati sono chiusi nelle ore del giro.`),
        /** «Capo: Mercato del Capo non entra negli orari del giro.» — aperto e vicino, ma la sosta non ci sta senza spostare le altre tappe */
        nonEntra: ({ cosa, posto }) => `${maiuscola(cosa)}: ${posto ? `${posto} non entra` : 'non entra'} negli orari del giro.`,
        /** «Cioccolato: a Scicli non ho trovato posti di questo tipo.» / «Ortigia: non l'ho trovato a Siracusa.» */
        nonTrovato: ({ cosa, citta, luogo = false }) => (luogo
            ? `${maiuscola(cosa)}: non l'ho trovato a ${citta}.`
            : `${maiuscola(cosa)}: a ${citta} non ho trovato posti di questo tipo.`),
        /** «2 tappe su 6 non sono di natura: entro 1,2 km non ho trovato altri parchi, giardini o belvedere aperti.» */
        nonDelTema: ({ n, totale, tema, altri, capKm }) => `${n} ${n === 1 ? 'tappa' : 'tappe'} su ${totale} non ${n === 1 ? 'è' : 'sono'} di ${tema}: entro ${km1(capKm)} km non ho trovato altri ${altri} aperti che entrino negli orari del giro.`,
        /** «Il giro parte alle 15:40, non alle 15:00.» */
        ora: ({ chiesta, vera }) => `Il giro parte alle ${hhmm(vera)}, non alle ${hhmm(chiesta)}.`,
    },
};
