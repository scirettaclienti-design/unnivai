/**
 * Gate C1 — la ricerca di una citta' dentro una tabella a chiavi.
 *
 * ORIGINE. Quattro punti del repo facevano, su un nome citta':
 *     s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
 * Il commento a TopBar.jsx:96 ne dichiarava lo scopo: "to ensure key lookups
 * work". Lo scopo era vero, il mezzo no. La trasformazione andava bene solo
 * sulle chiavi a parola singola delle due tabelle interessate (CITY_COORDS in
 * userContextService, CITY_CONFIG in QuickPath: "Roma", "Milano", "Napoli"...)
 * e distruggeva qualunque altro nome:
 *     "Reggio Emilia"        -> "Reggio emilia"
 *     "L'Aquila"             -> "L'aquila"
 *     "San Giovanni Rotondo" -> "San giovanni rotondo"
 * E non restava in RAM: da TopBar scendeva in CityContext.updateCity, che
 * scrive in localStorage E su profiles.current_city_override. Il nome storpiato
 * veniva persistito, sul device e sul database.
 *
 * IL PUNTO. Un lookup a chiave che non regge le maiuscole e' un problema del
 * LOOKUP, non del dato. Si adatta il confronto, non si riscrive la citta'.
 * Questa funzione fa esattamente e solo quello: dato l'insieme di chiavi di una
 * tabella e un nome citta', restituisce la CHIAVE che corrisponde a meno di
 * maiuscole/minuscole e spazi ai bordi — oppure null. Non restituisce mai una
 * stringa trasformata: chi chiama usa la chiave per indicizzare, e il nome
 * citta' originale resta quello che era.
 *
 * Un motore solo (regola locked #8): stesso helper per CITY_COORDS e
 * CITY_CONFIG, cosi' le due tabelle non possono divergere nel comportamento.
 *
 * NOTA sul confronto. Volutamente solo case + trim, NIENTE strip di accenti e
 * niente collasso degli spazi interni: le chiavi vere di entrambe le tabelle
 * sono nomi italiani scritti correttamente, e un match piu' permissivo
 * comincerebbe a indovinare. Se un giorno una tabella prende chiavi composte,
 * questo confronto continua a funzionare senza modifiche.
 *
 * @param {object} table   la tabella a chiavi (CITY_COORDS, CITY_CONFIG, ...)
 * @param {string} cityName nome citta' come arriva dall'utente o dal geocoding
 * @param {string[]} [ignoreKeys] chiavi che NON sono nomi di citta' (es. 'default')
 * @returns {string|null} la chiave corrispondente, o null
 */
export function findCityKey(table, cityName, ignoreKeys = []) {
    if (!table || typeof table !== 'object') return null;
    if (!cityName || typeof cityName !== 'string') return null;

    const needle = cityName.trim().toLowerCase();
    if (!needle) return null;

    const skip = new Set(ignoreKeys);
    return Object.keys(table).find(
        k => !skip.has(k) && k.toLowerCase() === needle
    ) ?? null;
}
