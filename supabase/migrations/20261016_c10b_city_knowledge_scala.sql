-- C10b — la scala del luogo (decisione di Ivano): borgo, città o metropoli. La PROPONE l'AI nella lista (openai-proxy,
-- versione del prompt c10b-1); il motore la conferma con le distanze fra i posti verificati. Il centro porta anche la
-- provincia e il raggio della verifica (un borgo: «nome, comune, provincia», 5 km, indirizzo nel comune).
alter table public.city_knowledge add column if not exists scala text;
alter table public.city_knowledge drop constraint if exists city_knowledge_scala_check;
alter table public.city_knowledge add constraint city_knowledge_scala_check check (scala is null or scala in ('borgo', 'città', 'metropoli'));
comment on column public.city_knowledge.scala is 'C10b — la scala proposta dall''AI (borgo | città | metropoli), null nelle liste c10-*.';
