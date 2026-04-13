/**
 * chatSanitizer.js
 * 
 * Modulo Anti-Disintermediazione per la piattaforma Unnivai.
 * Scansiona e oscura automaticamente numeri di telefono, indirizzi email 
 * e link esterni dai messaggi di chat scambiati tra Guida ed Esploratore 
 * PRIMA della stipula del preventivo pagato.
 */

export const sanitizeMessage = (text) => {
    if (!text) return { sanitizedText: '', hasViolations: false };

    let sanitizedText = text;
    let hasViolations = false;

    // 1. Regex per Numeri di Telefono (molto aggressiva per beccare formati strani)
    // Cerca sequenze di almeno 7-10 cifre, anche se separate da spazi, punti, trattini o scritte come '+39'
    const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{0,4}/g;
    
    // Controlliamo se la regex trova qualcosa di 'sostanziale' (non solo un numero a caso come "siamo in 4")
    // Lo facciamo sostituendo solo se la lunghezza dei numeri trovati è tipica di un telefono (>= 8 cifre di numeri puri)
    sanitizedText = sanitizedText.replace(phoneRegex, (match) => {
        const digitsOnly = match.replace(/\D/g, '');
        if (digitsOnly.length >= 8) {
            hasViolations = true;
            return '[Numero Nascosto]';
        }
        return match;
    });

    // 2. Regex per Indirizzi Email
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    if (emailRegex.test(sanitizedText)) {
        hasViolations = true;
        sanitizedText = sanitizedText.replace(emailRegex, '[Email Nascosta]');
    }

    // 3. Regex per mascheramenti "Testuali" di Email (es. "mario chiocciola gmail punto it")
    const testualeChiocciolaRegex = /([a-zA-Z0-9._-]+)\s*(chiocciola|at|@)\s*([a-zA-Z0-9._-]+)\s*(punto|dot|\.)\s*([a-zA-Z]+)/gi;
    if (testualeChiocciolaRegex.test(sanitizedText)) {
        hasViolations = true;
        sanitizedText = sanitizedText.replace(testualeChiocciolaRegex, '[Email Nascosta]');
    }

    // 4. URL generici (http, https, www, .com, .it, .org)
    const urlRegex = /(?:https?:\/\/|www\.)[^\s]+/gi;
    if (urlRegex.test(sanitizedText)) {
        hasViolations = true;
        sanitizedText = sanitizedText.replace(urlRegex, '[Link Nascosto]');
    }

    // 5. Social links e handles specifici
    const socialRegex = /(?:instagram\.com|ig:|facebook\.com|fb\.com|wa\.me|t\.me|whatsapp\.com)\/[a-zA-Z0-9_.-]+/gi;
    if (socialRegex.test(sanitizedText)) {
        hasViolations = true;
        sanitizedText = sanitizedText.replace(socialRegex, '[Link Nascosto]');
    }

    // 6. Social handles (@username) — ma non @dominio (già coperto da email)
    const handleRegex = /@[a-zA-Z0-9_]{3,30}\b/g;
    const handleTest = sanitizedText.match(handleRegex);
    if (handleTest && handleTest.some(h => !h.includes('.'))) {
        hasViolations = true;
        sanitizedText = sanitizedText.replace(handleRegex, (match) => {
            if (match.includes('.')) return match; // è una email già gestita
            return '[Handle Nascosto]';
        });
    }

    return {
        sanitizedText,
        hasViolations
    };
};
