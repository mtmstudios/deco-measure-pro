-- Sonnenschutz-Konfigurator: konfigurierte Positionen einem Projekt (Kunde) zuordnen.
-- Scope wie die übrigen Positionstabellen: RLS über projekt.betrieb_id.
CREATE TABLE IF NOT EXISTS public.sonnenschutz_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES public.projekt(id) ON DELETE CASCADE,
  produkt TEXT NOT NULL,
  modell TEXT,
  gruppe TEXT,
  breite_cm NUMERIC,
  hoehe_cm NUMERIC,
  anzahl INTEGER NOT NULL DEFAULT 1,
  schienenfarbe TEXT,
  fenstertyp TEXT,
  zuschlaege JSONB NOT NULL DEFAULT '[]'::jsonb,
  einzelpreis NUMERIC,
  gesamtpreis NUMERIC,
  bezeichnung TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sonnenschutz_position_projekt_id_idx
  ON public.sonnenschutz_position (projekt_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sonnenschutz_position TO authenticated;
GRANT ALL ON public.sonnenschutz_position TO service_role;

ALTER TABLE public.sonnenschutz_position ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sonnenschutz_position_all_via_projekt" ON public.sonnenschutz_position
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projekt p
    WHERE p.id = sonnenschutz_position.projekt_id
      AND p.betrieb_id = public.current_betrieb_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projekt p
    WHERE p.id = sonnenschutz_position.projekt_id
      AND p.betrieb_id = public.current_betrieb_id()
  ));