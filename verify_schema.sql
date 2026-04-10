SELECT conname, conrelid::regclass, confrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.guide_requests'::regclass;
