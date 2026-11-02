-- EMAIL-LANCIO — dopo ogni iscrizione alla lista d'attesa parte l'email di conferma.
--
-- · public.waitlist.email_inviata_at: quando l'email è partita (null = ancora da mandare).
--   La scrive solo l'Edge Function lista-attesa-email (service role); anon continua a poter fare solo insert.
-- · trigger waitlist_invia_email: dopo l'insert chiama la funzione con pg_net, mandando solo l'id della riga.
--   La chiamata è asincrona e non può far fallire l'iscrizione: un errore diventa un warning nei log di Postgres.
--
-- Ordine di rilascio: deploy della funzione lista-attesa-email e i suoi secret PRIMA di questa migrazione
-- (altrimenti le iscrizioni di quel momento restano con email_inviata_at null: si rimandano, vedi il report).
-- Verifica: supabase db push --dry-run (deve elencare solo questa), poi supabase db push.

create extension if not exists pg_net with schema extensions;

alter table public.waitlist add column if not exists email_inviata_at timestamptz;

create or replace function public.waitlist_invia_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://ahecpiwsdhghkndncejb.supabase.co/functions/v1/lista-attesa-email',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'waitlist_invia_email: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.waitlist_invia_email() from public, anon, authenticated;

drop trigger if exists waitlist_invia_email on public.waitlist;
create trigger waitlist_invia_email
  after insert on public.waitlist
  for each row execute function public.waitlist_invia_email();
