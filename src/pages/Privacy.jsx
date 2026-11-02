import PaginaLegale from './PaginaLegale';
import { PRIVACY, COLLEGAMENTI } from '../lib/testiAccount';

export default function Privacy() {
    return <PaginaLegale contenuto={PRIVACY} altra={{ a: '/termini', testo: COLLEGAMENTI.TERMINI }} />;
}
