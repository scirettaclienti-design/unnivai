-- DVAI-031: Indice JSONB su notifications.action_data per ottimizzare
-- le query sulla chat guida-utente (action_data->>'request_id').
-- Previene table scan con crescita delle notifiche.

CREATE INDEX IF NOT EXISTS idx_notifications_action_data_request_id
    ON public.notifications ((action_data->>'request_id'));

-- Indice aggiuntivo sul campo user_id + is_read per le query più frequenti
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, is_read)
    WHERE is_read = false;

COMMENT ON INDEX idx_notifications_action_data_request_id IS
    'DVAI-031: Accelera query JSONB su action_data->request_id nella chat guida-utente';
