-- Angebots-Zusatzkosten je Projekt: Montage + Fahrt.
-- Einmalig pro Auftrag (nicht je Position) → auf der Projekt-Ebene, nicht in sonnenschutz_position.
-- RLS/Grants bestehen bereits auf public.projekt.

ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS montage_kosten NUMERIC;
ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS fahrt_kosten NUMERIC;
