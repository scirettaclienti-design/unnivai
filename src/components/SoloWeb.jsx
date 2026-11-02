import { Navigate } from 'react-router-dom';
import { isAppNativa } from '../lib/appNativa';

// Pagina presente solo sul web (es. «Prossimamente», Foto, Trending).
// Nell'app nativa la rotta porta alla home, senza schermata «in arrivo».
export default function SoloWeb({ children }) {
    if (isAppNativa()) return <Navigate to="/" replace />;
    return children;
}
