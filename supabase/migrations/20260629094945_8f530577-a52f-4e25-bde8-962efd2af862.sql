
-- Enums
CREATE TYPE public.projekt_status AS ENUM ('erfassung','geprueft','uebergeben','fehler');
CREATE TYPE public.app_role AS ENUM ('admin','mitarbeiter');

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- betrieb
CREATE TABLE public.betrieb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.betrieb TO authenticated;
GRANT ALL ON public.betrieb TO service_role;
ALTER TABLE public.betrieb ENABLE ROW LEVEL SECURITY;

-- benutzer
CREATE TABLE public.benutzer (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  betrieb_id UUID NOT NULL REFERENCES public.betrieb(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rolle public.app_role NOT NULL DEFAULT 'mitarbeiter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.benutzer TO authenticated;
GRANT ALL ON public.benutzer TO service_role;
ALTER TABLE public.benutzer ENABLE ROW LEVEL SECURITY;

-- helper: current user's betrieb_id
CREATE OR REPLACE FUNCTION public.current_betrieb_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT betrieb_id FROM public.benutzer WHERE id = auth.uid()
$$;

CREATE POLICY "benutzer_select_own_betrieb" ON public.benutzer
  FOR SELECT TO authenticated USING (betrieb_id = public.current_betrieb_id() OR id = auth.uid());
CREATE POLICY "benutzer_insert_self" ON public.benutzer
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "benutzer_update_self" ON public.benutzer
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "betrieb_select_own" ON public.betrieb
  FOR SELECT TO authenticated USING (id = public.current_betrieb_id());
CREATE POLICY "betrieb_insert_any" ON public.betrieb
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "betrieb_update_own" ON public.betrieb
  FOR UPDATE TO authenticated USING (id = public.current_betrieb_id());

-- projekt
CREATE TABLE public.projekt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES public.betrieb(id) ON DELETE CASCADE,
  kunde TEXT NOT NULL,
  adresse TEXT,
  objekt_bezeichnung TEXT NOT NULL,
  auftrag_nr TEXT,
  verkaeufer TEXT,
  sachbearbeiter TEXT,
  gewerk TEXT,
  status public.projekt_status NOT NULL DEFAULT 'erfassung',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projekt TO authenticated;
GRANT ALL ON public.projekt TO service_role;
ALTER TABLE public.projekt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projekt_all_own_betrieb" ON public.projekt
  FOR ALL TO authenticated
  USING (betrieb_id = public.current_betrieb_id())
  WITH CHECK (betrieb_id = public.current_betrieb_id());
CREATE TRIGGER trg_projekt_updated BEFORE UPDATE ON public.projekt
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- raum
CREATE TABLE public.raum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES public.projekt(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  etage TEXT,
  raumhoehe_cm NUMERIC,
  bemerkung TEXT,
  reihenfolge INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raum TO authenticated;
GRANT ALL ON public.raum TO service_role;
ALTER TABLE public.raum ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raum_all_via_projekt" ON public.raum
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = raum.projekt_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = raum.projekt_id AND p.betrieb_id = public.current_betrieb_id()));

-- raum_teilflaeche
CREATE TABLE public.raum_teilflaeche (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raum_id UUID NOT NULL REFERENCES public.raum(id) ON DELETE CASCADE,
  typ TEXT NOT NULL,
  laenge_cm NUMERIC,
  breite_cm NUMERIC,
  hoehe_cm NUMERIC,
  flaeche_m2 NUMERIC,
  bemerkung TEXT,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raum_teilflaeche TO authenticated;
GRANT ALL ON public.raum_teilflaeche TO service_role;
ALTER TABLE public.raum_teilflaeche ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tf_all_via_projekt" ON public.raum_teilflaeche FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = raum_teilflaeche.raum_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = raum_teilflaeche.raum_id AND p.betrieb_id = public.current_betrieb_id()));

-- oeffnung
CREATE TABLE public.oeffnung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raum_id UUID NOT NULL REFERENCES public.raum(id) ON DELETE CASCADE,
  typ TEXT NOT NULL,
  breite_cm NUMERIC,
  hoehe_cm NUMERIC,
  bemerkung TEXT,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oeffnung TO authenticated;
GRANT ALL ON public.oeffnung TO service_role;
ALTER TABLE public.oeffnung ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oeffnung_all_via_projekt" ON public.oeffnung FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = oeffnung.raum_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = oeffnung.raum_id AND p.betrieb_id = public.current_betrieb_id()));

-- heizkoerper
CREATE TABLE public.heizkoerper (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raum_id UUID NOT NULL REFERENCES public.raum(id) ON DELETE CASCADE,
  breite_cm NUMERIC,
  hoehe_cm NUMERIC,
  tiefe_cm NUMERIC,
  abstand_boden_cm NUMERIC,
  bemerkung TEXT,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heizkoerper TO authenticated;
GRANT ALL ON public.heizkoerper TO service_role;
ALTER TABLE public.heizkoerper ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hk_all_via_projekt" ON public.heizkoerper FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = heizkoerper.raum_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = heizkoerper.raum_id AND p.betrieb_id = public.current_betrieb_id()));

-- acryl_position
CREATE TABLE public.acryl_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raum_id UUID NOT NULL REFERENCES public.raum(id) ON DELETE CASCADE,
  laenge_m NUMERIC,
  beschreibung TEXT,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acryl_position TO authenticated;
GRANT ALL ON public.acryl_position TO service_role;
ALTER TABLE public.acryl_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acryl_all_via_projekt" ON public.acryl_position FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = acryl_position.raum_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = acryl_position.raum_id AND p.betrieb_id = public.current_betrieb_id()));

-- leistung_katalog (per betrieb)
CREATE TABLE public.leistung_katalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES public.betrieb(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  bezeichnung TEXT NOT NULL,
  einheit TEXT NOT NULL,
  einheitspreis NUMERIC,
  gewerk TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leistung_katalog TO authenticated;
GRANT ALL ON public.leistung_katalog TO service_role;
ALTER TABLE public.leistung_katalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "katalog_all_own_betrieb" ON public.leistung_katalog FOR ALL TO authenticated
  USING (betrieb_id = public.current_betrieb_id())
  WITH CHECK (betrieb_id = public.current_betrieb_id());

-- raum_leistung
CREATE TABLE public.raum_leistung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raum_id UUID NOT NULL REFERENCES public.raum(id) ON DELETE CASCADE,
  leistung_id UUID REFERENCES public.leistung_katalog(id),
  bezeichnung TEXT,
  einheit TEXT,
  menge NUMERIC,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raum_leistung TO authenticated;
GRANT ALL ON public.raum_leistung TO service_role;
ALTER TABLE public.raum_leistung ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl_all_via_projekt" ON public.raum_leistung FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = raum_leistung.raum_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.raum r JOIN public.projekt p ON p.id=r.projekt_id WHERE r.id = raum_leistung.raum_id AND p.betrieb_id = public.current_betrieb_id()));

-- regel
CREATE TABLE public.regel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  betrieb_id UUID NOT NULL REFERENCES public.betrieb(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regel TO authenticated;
GRANT ALL ON public.regel TO service_role;
ALTER TABLE public.regel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regel_all_own_betrieb" ON public.regel FOR ALL TO authenticated
  USING (betrieb_id = public.current_betrieb_id())
  WITH CHECK (betrieb_id = public.current_betrieb_id());

-- generierte_position
CREATE TABLE public.generierte_position (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES public.projekt(id) ON DELETE CASCADE,
  raum_id UUID REFERENCES public.raum(id) ON DELETE CASCADE,
  leistung_id UUID REFERENCES public.leistung_katalog(id),
  bezeichnung TEXT NOT NULL,
  einheit TEXT,
  menge NUMERIC,
  einheitspreis NUMERIC,
  summe NUMERIC,
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generierte_position TO authenticated;
GRANT ALL ON public.generierte_position TO service_role;
ALTER TABLE public.generierte_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gp_all_via_projekt" ON public.generierte_position FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = generierte_position.projekt_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = generierte_position.projekt_id AND p.betrieb_id = public.current_betrieb_id()));

-- uebergabe
CREATE TABLE public.uebergabe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES public.projekt(id) ON DELETE CASCADE,
  uebergeben_an TEXT,
  uebergeben_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  uebergeben_von UUID REFERENCES auth.users(id),
  daten JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uebergabe TO authenticated;
GRANT ALL ON public.uebergabe TO service_role;
ALTER TABLE public.uebergabe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ueb_all_via_projekt" ON public.uebergabe FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = uebergabe.projekt_id AND p.betrieb_id = public.current_betrieb_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projekt p WHERE p.id = uebergabe.projekt_id AND p.betrieb_id = public.current_betrieb_id()));

-- Auto-create betrieb + benutzer profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_betrieb_id UUID;
  v_betrieb_name TEXT;
  v_name TEXT;
BEGIN
  v_betrieb_name := COALESCE(NEW.raw_user_meta_data->>'betrieb_name', 'Mein Betrieb');
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));
  INSERT INTO public.betrieb (name) VALUES (v_betrieb_name) RETURNING id INTO v_betrieb_id;
  INSERT INTO public.benutzer (id, betrieb_id, name, email, rolle)
    VALUES (NEW.id, v_betrieb_id, v_name, NEW.email, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
