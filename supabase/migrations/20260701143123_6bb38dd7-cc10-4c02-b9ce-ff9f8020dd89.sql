-- Snapshot upsert for a Raum: replaces all sub-rows in one transaction.
-- Payload shape:
-- {
--   "raum": { id, projekt_id, name, etage, raumhoehe_cm, laenge_cm, breite_cm,
--             deckentyp, bemerkung, reihenfolge, geometrie },
--   "teilflaechen": [ { id?, typ, laenge_cm, breite_cm, hoehe_cm, flaeche_m2, bemerkung, daten } ],
--   "oeffnungen":   [ { id?, typ, breite_cm, hoehe_cm, bemerkung, daten } ],
--   "heizkoerper":  [ { id?, breite_cm, hoehe_cm, tiefe_cm, abstand_boden_cm, bemerkung, daten } ],
--   "acryl":        [ { id?, laenge_m, beschreibung, daten } ],
--   "leistungen":   [ { leistung_id, bezeichnung, einheit, menge, daten } ]
-- }

CREATE OR REPLACE FUNCTION public.upsert_raum_snapshot(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_raum_id UUID;
  v_projekt_id UUID;
  v_owner_betrieb UUID;
  v_current_betrieb UUID := public.current_betrieb_id();
BEGIN
  v_raum_id := (p->'raum'->>'id')::uuid;
  v_projekt_id := (p->'raum'->>'projekt_id')::uuid;

  IF v_raum_id IS NULL OR v_projekt_id IS NULL THEN
    RAISE EXCEPTION 'raum.id und raum.projekt_id sind erforderlich';
  END IF;

  IF v_current_betrieb IS NULL THEN
    RAISE EXCEPTION 'Kein Betrieb-Kontext (nicht angemeldet)';
  END IF;

  -- Projekt muss dem eigenen Betrieb gehören
  SELECT betrieb_id INTO v_owner_betrieb FROM public.projekt WHERE id = v_projekt_id;
  IF v_owner_betrieb IS NULL OR v_owner_betrieb <> v_current_betrieb THEN
    RAISE EXCEPTION 'Projekt nicht im Zugriff';
  END IF;

  -- Raum upsert (bestehende raum.projekt_id darf sich nicht ändern; wir verlassen uns auf RLS-Policies)
  INSERT INTO public.raum (id, projekt_id, name, etage, raumhoehe_cm, laenge_cm, breite_cm,
                           deckentyp, bemerkung, reihenfolge, geometrie)
  VALUES (v_raum_id,
          v_projekt_id,
          COALESCE(p->'raum'->>'name', 'Raum'),
          NULLIF(p->'raum'->>'etage',''),
          NULLIF(p->'raum'->>'raumhoehe_cm','')::numeric,
          NULLIF(p->'raum'->>'laenge_cm','')::numeric,
          NULLIF(p->'raum'->>'breite_cm','')::numeric,
          NULLIF(p->'raum'->>'deckentyp',''),
          NULLIF(p->'raum'->>'bemerkung',''),
          NULLIF(p->'raum'->>'reihenfolge','')::int,
          p->'raum'->'geometrie')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    etage = EXCLUDED.etage,
    raumhoehe_cm = EXCLUDED.raumhoehe_cm,
    laenge_cm = EXCLUDED.laenge_cm,
    breite_cm = EXCLUDED.breite_cm,
    deckentyp = EXCLUDED.deckentyp,
    bemerkung = EXCLUDED.bemerkung,
    reihenfolge = EXCLUDED.reihenfolge,
    geometrie = EXCLUDED.geometrie,
    updated_at = now();

  -- Sub-Tabellen komplett ersetzen (last-write-wins Snapshot)
  DELETE FROM public.raum_teilflaeche WHERE raum_id = v_raum_id;
  DELETE FROM public.oeffnung         WHERE raum_id = v_raum_id;
  DELETE FROM public.heizkoerper      WHERE raum_id = v_raum_id;
  DELETE FROM public.acryl_position   WHERE raum_id = v_raum_id;
  DELETE FROM public.raum_leistung    WHERE raum_id = v_raum_id;

  INSERT INTO public.raum_teilflaeche (raum_id, typ, laenge_cm, breite_cm, hoehe_cm, flaeche_m2, bemerkung, daten)
  SELECT v_raum_id,
         COALESCE(x->>'typ','sonstige'),
         NULLIF(x->>'laenge_cm','')::numeric,
         NULLIF(x->>'breite_cm','')::numeric,
         NULLIF(x->>'hoehe_cm','')::numeric,
         NULLIF(x->>'flaeche_m2','')::numeric,
         NULLIF(x->>'bemerkung',''),
         COALESCE(x->'daten','{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p->'teilflaechen','[]'::jsonb)) AS x;

  INSERT INTO public.oeffnung (raum_id, typ, breite_cm, hoehe_cm, bemerkung, daten)
  SELECT v_raum_id,
         COALESCE(x->>'typ','fenster'),
         NULLIF(x->>'breite_cm','')::numeric,
         NULLIF(x->>'hoehe_cm','')::numeric,
         NULLIF(x->>'bemerkung',''),
         COALESCE(x->'daten','{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p->'oeffnungen','[]'::jsonb)) AS x;

  INSERT INTO public.heizkoerper (raum_id, breite_cm, hoehe_cm, tiefe_cm, abstand_boden_cm, bemerkung, daten)
  SELECT v_raum_id,
         NULLIF(x->>'breite_cm','')::numeric,
         NULLIF(x->>'hoehe_cm','')::numeric,
         NULLIF(x->>'tiefe_cm','')::numeric,
         NULLIF(x->>'abstand_boden_cm','')::numeric,
         NULLIF(x->>'bemerkung',''),
         COALESCE(x->'daten','{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p->'heizkoerper','[]'::jsonb)) AS x;

  INSERT INTO public.acryl_position (raum_id, laenge_m, beschreibung, daten)
  SELECT v_raum_id,
         NULLIF(x->>'laenge_m','')::numeric,
         NULLIF(x->>'beschreibung',''),
         COALESCE(x->'daten','{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p->'acryl','[]'::jsonb)) AS x;

  INSERT INTO public.raum_leistung (raum_id, leistung_id, bezeichnung, einheit, menge, daten)
  SELECT v_raum_id,
         NULLIF(x->>'leistung_id','')::uuid,
         NULLIF(x->>'bezeichnung',''),
         NULLIF(x->>'einheit',''),
         NULLIF(x->>'menge','')::numeric,
         COALESCE(x->'daten','{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p->'leistungen','[]'::jsonb)) AS x;

  RETURN v_raum_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_raum_snapshot(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_raum_snapshot(jsonb) FROM anon;
