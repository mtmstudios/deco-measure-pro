ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS montage_kosten NUMERIC;
ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS fahrt_kosten NUMERIC;