-- AVVISI (L6) — gli avvisi a Ivano su errori e costi.
--
-- 1) public.avvisi_inviati: quale avviso è già partito (chiave primaria = niente doppioni, anche con due esecuzioni insieme).
--    Chiavi: costo:<giorno> · errori:<giorno>T<ora Roma> · riepilogo:<giorno>. Solo la chiave di servizio.
-- 2) public.avvisi_conteggi(p_giorno): i numeri del giorno (Europe/Rome) in un colpo solo, per la funzione `avvisi`.
--    Legge soltanto: biglietti dei giri, racconti nuovi e il loro costo, contorno, ospiti nuovi, audio nuovi, errori dell'app.
-- 3) pg_cron: ogni ora, al minuto 5, chiama la funzione `avvisi` con pg_net. La chiave arriva dal Vault (`avvisi_chiave`).
--
-- Ordine di rilascio (vedi docs/prove/2026-11-04-avvisi.md): questa migrazione → deploy della funzione → secret → prova.
-- Il job parte appena la migrazione è applicata: finché la funzione non c'è o i secret mancano, risponde 404/401/503 e
-- non succede altro (nessuna email, nessun effetto sull'app).
-- Gli errori dell'app (public.error_logs) esistono già in produzione: il client li scrive da prima.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.avvisi_inviati (
    chiave     text        primary key,
    inviato_at timestamptz not null default now()
);
alter table public.avvisi_inviati enable row level security;   -- nessuna policy: solo la chiave di servizio
revoke all on public.avvisi_inviati from public, anon, authenticated;

create or replace function public.avvisi_conteggi(p_giorno date)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'giorno', to_char(p_giorno, 'YYYY-MM-DD'),
        'giri', (select count(*) from public.ai_generation_ticket
                  where (created_at at time zone 'Europe/Rome')::date = p_giorno and coalesce(label, '') <> 'test'),
        'racconti', jsonb_build_object(
            'passati',    (select count(*) from public.place_racconti where esito = 'passato'     and (created_at at time zone 'Europe/Rome')::date = p_giorno),
            'scartati',   (select count(*) from public.place_racconti where esito = 'scartato'    and (created_at at time zone 'Europe/Rome')::date = p_giorno),
            'senzaFonti', (select count(*) from public.place_racconti where esito = 'senza-fonti' and (created_at at time zone 'Europe/Rome')::date = p_giorno),
            'costoUsd',   (select coalesce(sum(costo_usd), 0) from public.place_racconti where (created_at at time zone 'Europe/Rome')::date = p_giorno)
        ),
        'chat', (select coalesce(sum(calls), 0) from public.ai_quota_daily where day = p_giorno)
              + (select coalesce(sum(calls), 0) from public.ai_quota_guest where day = p_giorno),
        'ospiti', (select count(*) from auth.users where is_anonymous and (created_at at time zone 'Europe/Rome')::date = p_giorno),
        'vociNuove', (select coalesce(sum(nuovi), 0) from public.voce_uso where giorno = p_giorno),
        'erroriApp', jsonb_build_object(
            'totale', (select count(*) from public.error_logs where (created_at at time zone 'Europe/Rome')::date = p_giorno),
            'top', coalesce((select jsonb_agg(jsonb_build_object('messaggio', m, 'n', n) order by n desc)
                               from (select left(message, 120) as m, count(*) as n from public.error_logs
                                      where (created_at at time zone 'Europe/Rome')::date = p_giorno
                                      group by 1 order by 2 desc limit 3) t), '[]'::jsonb)
        )
    );
$$;
revoke all on function public.avvisi_conteggi(date) from public, anon, authenticated;
grant execute on function public.avvisi_conteggi(date) to service_role;

-- Il job. Ripetibile: se esiste già lo toglie e lo rifà.
do $$
begin
    perform cron.unschedule('avvisi-orario') where exists (select 1 from cron.job where jobname = 'avvisi-orario');
    perform cron.schedule('avvisi-orario', '5 * * * *', $job$
        select net.http_post(
            url := 'https://ahecpiwsdhghkndncejb.supabase.co/functions/v1/avvisi',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-avvisi-chiave', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'avvisi_chiave' limit 1), '')
            ),
            body := jsonb_build_object('modo', 'orario')
        );
    $job$);
end $$;
