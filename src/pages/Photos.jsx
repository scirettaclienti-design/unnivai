/**
 * Photos — DVAI-035: In attesa di implementazione con storage Supabase reale.
 * Visualizza overlay "Disponibile a breve" brand-coerente invece di dati mock.
 */
import ComingSoonOverlay from "../components/ComingSoonOverlay";

export default function PhotosPage() {
    return (
        <ComingSoonOverlay
            icon="📸"
            title="Foto dei Tour"
            subtitle="Presto potrai condividere i tuoi scatti migliori dai tour, sfogliare le storie degli altri viaggiatori e creare ricordi indimenticabili."
            backTo="/dashboard-user"
            backLabel="Home"
            accent="terracotta"
            features={[
                { emoji: "🖼️", title: "Galleria immersiva", desc: "Griglia e feed delle tue avventure" },
                { emoji: "❤️", title: "Like e commenti", desc: "Connettiti con la community DoveVAI" },
                { emoji: "🔗", title: "Condivisione social", desc: "Instagram, Facebook, WhatsApp" },
                { emoji: "🏷️", title: "Tag automatici", desc: "Luoghi e tour taggati dall'AI" },
            ]}
        />
    );
}
