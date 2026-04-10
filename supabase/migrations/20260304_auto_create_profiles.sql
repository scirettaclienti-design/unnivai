-- Migration to automatically create a profile when a new user signs up
-- AND fix the constraint that rejects "explorer" roles.

-- First, drop the strict constraint that blocks 'explorer' roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Optionally, we can relax it:
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('tourist', 'explorer', 'guide', 'business', 'user', 'admin'));

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'role', 'explorer'),
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to ensure clean slate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate trigger 
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill missing profiles for existing auth users who don't have one
INSERT INTO public.profiles (id, role, first_name, last_name)
SELECT 
  au.id, 
  COALESCE(au.raw_user_meta_data->>'role', 'explorer'),
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  ''
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
