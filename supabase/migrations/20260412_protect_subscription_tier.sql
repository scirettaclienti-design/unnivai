-- Protezione server-side del subscription_tier su businesses_profile
-- Impedisce a un business di auto-promuoversi a 'elite' via client
-- Solo il service_role (backend/admin) può cambiare il tier

CREATE OR REPLACE FUNCTION protect_business_subscription_tier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Se il tier sta cambiando e il chiamante NON è service_role, blocca
    IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
        IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
            NEW.subscription_tier := OLD.subscription_tier;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_biz_tier ON businesses_profile;
CREATE TRIGGER protect_biz_tier
    BEFORE UPDATE ON businesses_profile
    FOR EACH ROW
    EXECUTE FUNCTION protect_business_subscription_tier();
