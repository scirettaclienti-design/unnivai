-- C10 — la lista della città: una per città, per giorno e per versione del prompt, uguale per tutti gli utenti.
-- La scrive e la legge SOLO openai-proxy con la chiave di servizio (nessuna policy: il client non la tocca, quindi
-- nessun browser può riscrivere la lista degli altri). Il «perché» dell'AI sta in `proposti` e non esce mai dal server.
create table if not exists public.city_knowledge (
    citta       text        not null,            -- chiave normalizzata (minuscolo, senza accenti)
    giorno      date        not null,            -- il giorno del tour
    versione    text        not null,            -- versione del prompt (CITY_LIST_VERSION)
    citta_nome  text        not null,            -- come l'ha scritta il motore ("Catania")
    centro      jsonb,                           -- { lat, lng } usato per il raggio
    proposti    jsonb       not null default '[]'::jsonb,  -- la lista dell'AI: nome, momento, tipo, perché (interno)
    verificati  jsonb       not null default '[]'::jsonb,  -- i posti trovati su Google, con momento e tipo
    scartati    jsonb       not null default '[]'::jsonb,  -- nome, tipo, momento, motivo
    costo       jsonb,                           -- token, chiamate Google (e quante dalla cache), millisecondi
    created_at  timestamptz not null default now(),
    primary key (citta, giorno, versione)
);

alter table public.city_knowledge enable row level security;
-- Nessuna policy per anon/authenticated: legge e scrive solo il service role (openai-proxy).
revoke all on public.city_knowledge from anon, authenticated;

comment on table public.city_knowledge is 'C10 — la lista della città (AI propone, Google verifica), una per città e giorno, uguale per tutti. Solo service role.';
