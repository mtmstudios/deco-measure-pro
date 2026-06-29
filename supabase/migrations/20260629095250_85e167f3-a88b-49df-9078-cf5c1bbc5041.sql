
ALTER TABLE public.raum
  ADD COLUMN IF NOT EXISTS laenge_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS breite_cm NUMERIC;

CREATE OR REPLACE FUNCTION public.duplicate_raum(p_raum_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new UUID;
BEGIN
  INSERT INTO public.raum (projekt_id, name, etage, raumhoehe_cm, laenge_cm, breite_cm, bemerkung, reihenfolge)
  SELECT projekt_id, name || ' (Kopie)', etage, NULL, NULL, NULL, bemerkung, COALESCE(reihenfolge,0) + 1
  FROM public.raum WHERE id = p_raum_id
  RETURNING id INTO v_new;

  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Raum nicht gefunden oder kein Zugriff';
  END IF;

  INSERT INTO public.raum_teilflaeche (raum_id, typ, laenge_cm, breite_cm, hoehe_cm, flaeche_m2, bemerkung, daten)
  SELECT v_new, typ, NULL, NULL, NULL, NULL, bemerkung, daten
  FROM public.raum_teilflaeche WHERE raum_id = p_raum_id;

  INSERT INTO public.oeffnung (raum_id, typ, breite_cm, hoehe_cm, bemerkung, daten)
  SELECT v_new, typ, NULL, NULL, bemerkung, daten
  FROM public.oeffnung WHERE raum_id = p_raum_id;

  INSERT INTO public.heizkoerper (raum_id, breite_cm, hoehe_cm, tiefe_cm, abstand_boden_cm, bemerkung, daten)
  SELECT v_new, NULL, NULL, NULL, NULL, bemerkung, daten
  FROM public.heizkoerper WHERE raum_id = p_raum_id;

  INSERT INTO public.acryl_position (raum_id, laenge_m, beschreibung, daten)
  SELECT v_new, NULL, beschreibung, daten
  FROM public.acryl_position WHERE raum_id = p_raum_id;

  INSERT INTO public.raum_leistung (raum_id, leistung_id, bezeichnung, einheit, menge, daten)
  SELECT v_new, leistung_id, bezeichnung, einheit, NULL, daten
  FROM public.raum_leistung WHERE raum_id = p_raum_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_raum(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_raum(UUID) TO authenticated;
