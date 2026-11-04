// VOCE-TEST — le prove non consumano il credito OpenAI della voce: ogni contesto del browser nasce con l'opzione esplicita
// «voce del telefono» (window.__VOCE_TELEFONO__ e localStorage.dvai_voce_telefono, letti da src/lib/voce.js), qualunque account usi.
// Lo stesso `import` è nelle prove che girano sul sito. Per provare apposta la voce vera: VOCE_VERA=1 (consuma credito).
export const INIZIO_VOCE_TELEFONO = () => {
    window.__VOCE_TELEFONO__ = true;
    try { localStorage.setItem('dvai_voce_telefono', '1'); } catch { /* niente */ }
};

export function conVoceTelefono(browser) {
    if (process.env.VOCE_VERA === '1') return browser;
    const nuovoContesto = browser.newContext.bind(browser);
    browser.newContext = async (...a) => {
        const ctx = await nuovoContesto(...a);
        await ctx.addInitScript(INIZIO_VOCE_TELEFONO);
        return ctx;
    };
    return browser;
}
