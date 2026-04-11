/**
 * Trending — DVAI-035: In attesa di implementazione con dati reali da Supabase.
 * Visualizza overlay "Disponibile a breve" invece di dati mock mescolati con reali.
 */
import ComingSoonOverlay from "../components/ComingSoonOverlay";

export default function TrendingPage() {
    return (
        <ComingSoonOverlay
            icon="🔥"
            title="Trending Ora"
            subtitle="Presto scoprirai le esperienze più popolari in tempo reale: classifiche live, tendenze per città e i tour che tutti stanno prenotando."
            backTo="/dashboard-user"
            backLabel="Home"
            accent="red"
            features={[
                { emoji: "📊", title: "Classifiche live", desc: "Aggiornate ogni ora in base alle prenotazioni" },
                { emoji: "🏆", title: "Top esperienze", desc: "I tour più votati della settimana" },
                { emoji: "🌍", title: "Per città", desc: "Filtra per Roma, Milano, Napoli e oltre" },
                { emoji: "⚡", title: "Ultimi posti", desc: "Notifiche in tempo reale sulla disponibilità" },
            ]}
        />
    );
}
