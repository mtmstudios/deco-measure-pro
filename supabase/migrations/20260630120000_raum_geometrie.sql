-- Maßketten-/Polygon-Geometrie pro Raum für den Raumlevel-Export
-- (Wandabschnitte + Boden-Terme für nicht-rechteckige Räume).
-- Additiv & idempotent — bestehende Räume bleiben unberührt (NULL = Rechteck-Modus).
ALTER TABLE public.raum ADD COLUMN IF NOT EXISTS geometrie JSONB;
