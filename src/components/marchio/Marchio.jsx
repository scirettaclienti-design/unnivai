/**
 * ONBOARDING-ACCESSO — i pezzi del marchio Unnivai per le schermate d'ingresso (accesso, registrazione, password,
 * consenso, primo ingresso, caricamento). Dalla cartella del marchio (UNNIVAI-Site-FINAL): il logo, le curve di livello
 * del sito, le etichette in mono maiuscolo con il numero del passo, Bricolage Grotesque nei titoli. Sul fondo scuro
 * dell'app (Ossidiana) con il suo arancione: le schermate d'ingresso e l'app restano una cosa sola.
 */
import logo from '@/assets/brand/unnivai-logo.webp';
import { CARICAMENTO } from '@/lib/testiAccount';

/** Il logo (pin + «UnniVai»), 441×125. */
export function LogoUnnivai({ className = 'h-9 w-auto' }) {
    return <img src={logo} alt="Unnivai" width={441} height={125} className={className} draggable={false} />;
}

/** Le curve di livello del sito e un alone arancione in alto: decorazione, dietro a tutto. */
export function FondoMarchio({ className = '' }) {
    return (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[420px] rounded-full bg-brand-orange/10 blur-3xl" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.55]" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" fill="none">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <path
                        key={i}
                        d={`M-20 ${120 + i * 78} C 80 ${60 + i * 80}, 170 ${200 + i * 70}, 260 ${130 + i * 76} S 400 ${90 + i * 82}, 420 ${150 + i * 74}`}
                        stroke="rgba(234,242,240,0.07)"
                        strokeWidth="1"
                    />
                ))}
                <path d="M-10 700 C 90 640, 170 600, 250 520 S 380 430, 410 400" stroke="rgba(249,115,22,0.35)" strokeWidth="1.5" />
            </svg>
        </div>
    );
}

/** «01 · ACCESSO»: l'etichetta in mono maiuscolo del sito. */
export function EtichettaPasso({ numero, testo, className = '' }) {
    return (
        <p className={`font-etichetta text-[11px] tracking-[0.22em] uppercase text-brand-orange ${className}`}>
            {numero ? <>{String(numero).padStart(2, '0')} <span aria-hidden="true">·</span> </> : null}{testo}
        </p>
    );
}

/** La schermata di caricamento: solo il marchio, sul fondo dell'app (mai bianca, mai in inglese). */
export function SchermataCaricamento() {
    return (
        <div className="fixed inset-0 z-[9999] min-h-screen flex items-center justify-center bg-obsidian-bg" role="status" aria-label={CARICAMENTO.ARIA} data-testid="caricamento">
            <FondoMarchio />
            <div className="relative flex flex-col items-center gap-6">
                <LogoUnnivai className="h-12 w-auto" />
                <div className="h-[3px] w-28 overflow-hidden rounded-full bg-obsidian-raised">
                    <div className="h-full w-1/3 rounded-full bg-brand-orange marchio-scorre" />
                </div>
            </div>
            <style>{'@keyframes marchio-scorre{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}.marchio-scorre{animation:marchio-scorre 1.1s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.marchio-scorre{animation:none;width:100%}}'}</style>
        </div>
    );
}
