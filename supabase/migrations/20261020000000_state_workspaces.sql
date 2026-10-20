-- Preserve every existing row and its JSON. Legacy clients belong to State 3543.
ALTER TABLE public.players ADD COLUMN state_id text NOT NULL DEFAULT '3543';
ALTER TABLE public.svs_plans ADD COLUMN state_id text NOT NULL DEFAULT '3543';
ALTER TABLE public.players DROP CONSTRAINT players_pkey,
  ADD CONSTRAINT players_pkey PRIMARY KEY (state_id, id);
ALTER TABLE public.svs_plans DROP CONSTRAINT svs_plans_pkey,
  ADD CONSTRAINT svs_plans_pkey PRIMARY KEY (state_id, id);
-- Existing officer-only RLS policies remain in force.
