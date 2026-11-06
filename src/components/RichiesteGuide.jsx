/**
 * Le richieste alle guide locali: V2. In V1 il Profilo non la monta (PROFILO-SEZIONI): come le pagine di V1LockedGuard, il pannello resta
 * pronto qui e torna rimontandolo in Profile, sotto le sue tab. Vale per i soli utenti con account: `guide_requests` e' per utente.
 */
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatModalUser from './ChatModalUser';
import { supabase } from '../lib/supabase';

// Stati di `guide_requests`, presi dal CHECK reale sul DB (verificato il
// 04/09/2026 su information_schema, non a memoria):
//   CHECK (status = ANY (ARRAY['open','accepted','declined','completed']))
//
// `'pending'` NON e' fra questi e non puo' esistere: era il valore su cui
// ramificava il badge qui sotto, quindi il ramo "In attesa" non si e' mai
// attivato e all'utente compariva la stringa grezza `open`. (Nota: la colonna
// ha DEFAULT 'pending', che viola il suo stesso CHECK — trappola dormiente
// documentata, si chiude nel gate schema.)
//
// ATTIVE = quelle su cui l'utente sta ancora aspettando qualcosa.
// `declined` e `completed` sono chiuse: una richiesta rifiutata sotto un
// titolo che la dice "attiva" e' un'affermazione falsa.
const REQUEST_STATUS_ACTIVE = ['open', 'accepted'];

const REQUEST_STATUS_LABEL = {
    open: 'In attesa',
    accepted: 'Accettata',
    declined: 'Rifiutata',
    completed: 'Completata',
};

export default function RichiesteGuide({ userId, firstName }) {
    const [myRequests, setMyRequests] = useState([]);
    const [chatModalRequest, setChatModalRequest] = useState(null);

    useEffect(() => {
        if (!userId) return;
        // Prima il filtro era `.neq('status','completed')`: escludeva solo le completate, quindi le RIFIUTATE restavano in elenco sotto
        // il titolo "Richieste Attive". Ora si chiede esplicitamente cosa e' attivo (REQUEST_STATUS_ACTIVE).
        supabase
            .from('guide_requests')
            .select('*')
            .eq('user_id', userId)
            .in('status', REQUEST_STATUS_ACTIVE)
            .order('created_at', { ascending: false })
            .limit(100) // DVAI-024
            .then(({ data, error }) => { if (!error && data) setMyRequests(data); });
    }, [userId]);

    return (
        <div className="mb-6 bg-obsidian-card border border-obsidian-border rounded-2xl p-5 shadow-lg">
            <h3 className="text-base font-bold text-obsidian-primary mb-4 flex items-center">
                <MessageCircle className="w-4 h-4 mr-2 text-obsidian-secondary" />
                Richieste Attive
            </h3>

            <div className="space-y-3">
                                {myRequests.length === 0 ? (
                                    <p className="text-sm text-obsidian-secondary italic">Non hai richieste attive al momento.</p>
                                ) : (
                                    myRequests.map((req) => (
                                        <div key={req.id} className="bg-obsidian-bg p-4 rounded-xl border border-obsidian-border flex flex-col space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-obsidian-primary text-sm">{req.city ? `Tour a ${req.city}` : 'Richiesta di tour'}</h4>
                                                    {/* La durata si stampa SOLO se c'e'. Prima era `req.duration || 3`:
                                                        con il dato assente la schermata affermava tre ore che nessuno
                                                        aveva mai scelto (regola locked #6 — un fatto, non un default
                                                        di comodo). Nei dati reali una riga su sei ha duration NULL. */}
                                                    <p className="text-xs text-obsidian-secondary">
                                                        {[
                                                            new Date(req.created_at).toLocaleDateString(),
                                                            req.duration ? `${req.duration} ore` : null,
                                                        ].filter(Boolean).join(' • ')}
                                                    </p>
                                                </div>
                                                {/* Badge sugli stati REALI del CHECK. Mai `req.status` grezzo: se
                                                    arrivasse un valore fuori mappa non si stampa nulla, invece di
                                                    mostrare una parola inglese di database all'utente. */}
                                                {REQUEST_STATUS_LABEL[req.status] && (
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border shrink-0 ${req.status === 'open'
                                                        ? 'bg-obsidian-raised text-brand-orange border-brand-orange/30'
                                                        : req.status === 'accepted'
                                                            ? 'bg-obsidian-raised text-obsidian-primary border-obsidian-border-elevated'
                                                            : 'bg-obsidian-raised text-obsidian-secondary border-obsidian-border'
                                                        }`}>
                                                        {REQUEST_STATUS_LABEL[req.status]}
                                                    </span>
                                                )}
                                            </div>
                                            {req.guide_id && (
                                                <div className="mt-2 pt-2 border-t border-obsidian-border flex items-center justify-between">
                                                    <p className="text-xs text-obsidian-secondary font-medium flex items-center">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mr-1.5"></span>
                                                        Assegnata a una guida locale
                                                    </p>
                                                    <button
                                                        onClick={() => setChatModalRequest(req)}
                                                        className="bg-brand-orange text-obsidian-bg hover:bg-brand-orange-hover transition-colors px-3 py-1.5 rounded-lg text-xs font-bold flex items-center"
                                                    >
                                                        <MessageCircle className="w-3 h-3 mr-1" /> Apri Chat
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

            <ChatModalUser
                isOpen={!!chatModalRequest}
                onClose={() => setChatModalRequest(null)}
                request={chatModalRequest}
                userId={userId}
                userName={firstName || 'Utente'}
            />
        </div>
    );
}
