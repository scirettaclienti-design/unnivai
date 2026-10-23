# Migrazioni archiviate (23/10/2026)

Questi 22 file avevano una versione a 8 cifre (es. `20260304_...`) e nessuna riga
corrispondente nello storico di produzione: `supabase db push` li avrebbe rifiutati
o riapplicati. Sono qui, fuori da `supabase/migrations/`, per non sporcare lo storico.
Non vanno rieseguiti alla cieca. Molti oggetti risultano già in produzione (applicati a mano).
Risultano NON applicati in produzione (letto dal catalogo il 23/10/2026):
- tabella `guide_applications` (20260411_gdpr_delete_policies_and_guide_applications) — da valutare con la corsia V2 guide/attività
- policy storage `avatars_*` e `business_media_*` (20260412_dvai047_storage_bucket_policies) — da valutare con la corsia V2 guide/attività
- indici `idx_activities_*` (20260303_enhance_activities_monuments) — da valutare con la corsia V2 guide/attività
- indice `idx_notifications_action_data_request_id` (20260412_dvai031_...) — notifications da verificare per V1
- trigger `protect_biz_tier` (20260412_protect_subscription_tier) — da valutare con la corsia V2 guide/attività
Controllati solo gli oggetti più riconoscibili: gli altri file non sono stati verificati uno per uno.
Per applicarne uno: nuovo file con timestamp completo in `supabase/migrations/`.
