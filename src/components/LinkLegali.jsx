import { Link } from 'react-router-dom';
import { COLLEGAMENTI } from '../lib/testiAccount';

/** «Privacy · Termini»: Landing, Login e Profilo. Le pagine sono pubbliche. */
export default function LinkLegali({ className = '' }) {
    const stile = 'inline-flex items-center min-h-[44px] px-2 text-xs font-bold text-obsidian-secondary hover:text-obsidian-primary underline underline-offset-4';
    return (
        <nav aria-label={COLLEGAMENTI.PRIVACY_E_TERMINI} className={`flex items-center justify-center gap-3 ${className}`} data-testid="link-legali">
            <Link to="/privacy" className={stile}>{COLLEGAMENTI.PRIVACY}</Link>
            <span aria-hidden="true" className="text-obsidian-secondary">·</span>
            <Link to="/termini" className={stile}>{COLLEGAMENTI.TERMINI}</Link>
        </nav>
    );
}
