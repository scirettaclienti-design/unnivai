/**
 * Gate NARRATORE-DOPO — alba e tramonto di una citta', calcolati nel CODICE.
 *
 * ─── PERCHE' UNA FORMULA E NON UNA LIBRERIA ──────────────────────────────────
 * Serve un solo numero per giorno (alba, tramonto), con una regola che lavora a
 * 45 minuti di tolleranza. La "sunrise equation" (Meeus semplificato, la stessa
 * di NOAA e di Wikipedia) sbaglia di 1-2 minuti alle nostre latitudini: per
 * questa regola e' gia' di troppo. Una dipendenza (es. suncalc) farebbe la
 * stessa formula con piu' superficie: niente rete, niente pacchetto, venti righe
 * testabili. I valori di Roma ai solstizi sono asseriti dal test.
 *
 * Il tramonto e' quello "ufficiale": centro del sole a -0.833° (rifrazione +
 * raggio del disco), cioe' quando il bordo superiore tocca l'orizzonte.
 *
 * Puro: niente orologio, niente rete.
 */

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
const UNIX_EPOCH_JD = 2440587.5;
const MS_PER_DAY = 86400000;

const jdToDate = (jd) => new Date(Math.round((jd - UNIX_EPOCH_JD) * MS_PER_DAY));

/**
 * @param {{ y: number, m: number, d: number }} day  giorno civile
 * @param {number} lat  latitudine (gradi, nord positivo)
 * @param {number} lng  longitudine (gradi, est positivo)
 * @returns {{ sunrise: Date|null, sunset: Date|null }} istanti; null se il sole
 *   quel giorno non sorge o non tramonta (non succede in Italia)
 */
export function sunTimes({ y, m, d }, lat, lng) {
    if (![y, m, d, lat, lng].every(Number.isFinite)) return { sunrise: null, sunset: null };
    // Giorno giuliano a mezzogiorno UTC del giorno civile, poi giorni da J2000.
    const jd = Date.UTC(y, m - 1, d, 12) / MS_PER_DAY + UNIX_EPOCH_JD;
    const n = Math.round(jd - J2000 + 0.0008);
    const jStar = n - lng / 360;                                   // mezzogiorno solare medio
    const M = (357.5291 + 0.98560028 * jStar) % 360;               // anomalia media
    const C = 1.9148 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG) + 0.0003 * Math.sin(3 * M * DEG);
    const lambda = (M + C + 180 + 102.9372) % 360;                 // longitudine eclittica
    const transit = J2000 + jStar + 0.0053 * Math.sin(M * DEG) - 0.0069 * Math.sin(2 * lambda * DEG);
    const sinDec = Math.sin(lambda * DEG) * Math.sin(23.4397 * DEG);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosW = (Math.sin(-0.833 * DEG) - Math.sin(lat * DEG) * sinDec) / (Math.cos(lat * DEG) * cosDec);
    if (cosW < -1 || cosW > 1) return { sunrise: null, sunset: null };
    const w = Math.acos(cosW) / DEG;
    return { sunrise: jdToDate(transit - w / 360), sunset: jdToDate(transit + w / 360) };
}
