import PaginaLegale from './PaginaLegale';
import { TERMINI, COLLEGAMENTI } from '../lib/testiAccount';

export default function Termini() {
    return <PaginaLegale contenuto={TERMINI} altra={{ a: '/privacy', testo: COLLEGAMENTI.PRIVACY }} />;
}
