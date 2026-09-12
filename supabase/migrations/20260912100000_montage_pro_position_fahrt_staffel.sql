-- Montage pro Position (typabhängig) + Fahrt-Staffel-Bezeichnung auf Projektebene.
-- Montagekosten hängen vom Befestigungs-/Produkttyp ab → pro Position, nicht pauschal.
-- Fahrt bleibt projektweit (ein Anfahrtssatz je Auftrag); fahrt_zone hält die gewählte Staffel.
-- Alle Beträge brutto (inkl. MwSt.), konsistent zu den Produktpreisen. Additiv/idempotent.

ALTER TABLE public.sonnenschutz_position ADD COLUMN IF NOT EXISTS montage_typ TEXT;
ALTER TABLE public.sonnenschutz_position ADD COLUMN IF NOT EXISTS montage_kosten NUMERIC; -- pro Einheit, brutto

ALTER TABLE public.projekt ADD COLUMN IF NOT EXISTS fahrt_zone TEXT;
