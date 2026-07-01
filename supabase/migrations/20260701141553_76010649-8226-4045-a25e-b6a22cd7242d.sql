
CREATE TABLE public.fehlermeldung (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  benutzer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  betrieb_id UUID REFERENCES public.betrieb(id) ON DELETE SET NULL,
  notiz TEXT NOT NULL,
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  user_agent TEXT,
  route TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.fehlermeldung TO authenticated;
GRANT ALL ON public.fehlermeldung TO service_role;

ALTER TABLE public.fehlermeldung ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own error reports"
  ON public.fehlermeldung FOR INSERT TO authenticated
  WITH CHECK (benutzer_id = auth.uid());

CREATE POLICY "Read own error reports"
  ON public.fehlermeldung FOR SELECT TO authenticated
  USING (benutzer_id = auth.uid());
