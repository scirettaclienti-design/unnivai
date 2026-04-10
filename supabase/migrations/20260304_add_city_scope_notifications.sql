-- Migration to add city_scope to notifications table
-- This allows frontend filtering by city so users only see relevant notifications.

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS city_scope TEXT;

-- Create an index to speed up the city_scope queries
CREATE INDEX IF NOT EXISTS idx_notifications_city_scope 
    ON public.notifications(city_scope);

-- Update RLS to ensure users can insert this column
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true); -- Allows anyone authenticated to insert (guides to users)
Allora ho verificato tutto quello che hai fatto