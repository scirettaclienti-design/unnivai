-- RACCONTO DI TAPPA — secondo controllo (Haiku 4.5, frase per frase). Si aggiunge alla tabella place_racconti: quale modello ha controllato e
-- la risposta per ogni frase («nelle fonti» sì/no). Solo colonne nuove e facoltative: i racconti già salvati restano com'erano; quelli scritti con
-- la versione vecchia del controllo (`versione` ≠ quella del codice) si riscrivono alla prima richiesta.
ALTER TABLE public.place_racconti ADD COLUMN IF NOT EXISTS modello_verifica text;
ALTER TABLE public.place_racconti ADD COLUMN IF NOT EXISTS verifica jsonb CHECK (verifica IS NULL OR jsonb_typeof(verifica) = 'array');
