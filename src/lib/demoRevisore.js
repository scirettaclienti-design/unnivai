/**
 * APP-NATIVA — l'account demo per il revisore Apple.
 *
 * Il revisore non è a Catania: GIRO-LONTANO ferma «Avvia» oltre 20 km. Per lui solo, un giro dimostrativo fisso
 * (src/data/giroDemo.js) con la posizione simulata (camminoSimulato.js) e il tasto «Simula il cammino».
 *
 * Chi è l'account demo lo dice `app_metadata.unnivai_demo_revisore === true`: `app_metadata` lo scrive solo il
 * server (service role, Admin API o SQL di Ivano); un utente non può accenderlo da sé (`user_metadata`, che
 * l'utente può cambiare con updateUser, NON conta). Mai per un account anonimo.
 */
export const FLAG_DEMO_REVISORE = 'unnivai_demo_revisore';

export function isDemoRevisore(user) {
    if (!user || user.is_anonymous === true) return false;
    return user.app_metadata?.[FLAG_DEMO_REVISORE] === true;
}

/** Il giro aperto è quello dimostrativo e chi guarda è l'account demo: solo allora la posizione è simulata. */
export function giroDemoAttivo(user, tour) {
    return tour?.demoRevisore === true && Array.isArray(tour?.percorsoDemo) && isDemoRevisore(user);
}
