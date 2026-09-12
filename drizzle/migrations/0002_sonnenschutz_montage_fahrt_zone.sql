ALTER TABLE public.sonnenschutz_position ADD COLUMN IF NOT EXISTS montage_typ TEXT;
ALTER TABLE public.sonnenschutz_position ADD COLUMN IF NOT EXISTS montage_kosten NUMERIC;
ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS fahrt_zone TEXT;