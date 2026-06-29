
-- Add deckentyp to raum
ALTER TABLE public.raum ADD COLUMN IF NOT EXISTS deckentyp TEXT;

-- Seed leistung_katalog for every betrieb (idempotent via unique(betrieb_id, code))
DO $$
DECLARE
  v_betrieb RECORD;
  v_codes TEXT[][] := ARRAY[
    ['VSPACHTEL_Q3','Vollflächige Spachtelung Q3','m2','Wand/Decke'],
    ['GK_DECKE','Gipskartondecke spachteln','m2','Decke'],
    ['TAPETE_ENTF','Tapete entfernen','m2','Wand'],
    ['RAUHFASER','Raufaser tapezieren','m2','Wand'],
    ['TIEFGRUND','Tiefgrund auftragen','m2','Wand/Decke'],
    ['DISP_KL3','Dispersion Klasse 3','m2','Wand/Decke'],
    ['SILIKAT','Silikatfarbe','m2','Wand/Decke'],
    ['ABDECKVLIES','Abdeckvlies Boden','m2','Schutz'],
    ['MALERFOLIE','Malerfolie','m2','Schutz'],
    ['HK_RIPPE_LACK','Heizkörper Rippe lackieren','Stk','Heizkörper'],
    ['HK_ROHRE_LACK','Heizungsrohre lackieren','m','Heizkörper'],
    ['ACRYL','Acryl-Fuge','m','Sonder'],
    ['TUEREN_LACK','Türen lackieren','Stk','Sonder'],
    ['TUERRAHMEN_LACK','Türrahmen lackieren','Stk','Sonder'],
    ['SCHIENEN_DEMO','Schienen demontieren','m','Sonder'],
    ['HOLZDECKE_DEMO','Holzdecke demontieren','m2','Sonder'],
    ['PUTZFLAECHE','Putzfläche','m2','Sonder']
  ];
  v_row TEXT[];
BEGIN
  FOR v_betrieb IN SELECT id FROM public.betrieb LOOP
    FOREACH v_row SLICE 1 IN ARRAY v_codes LOOP
      INSERT INTO public.leistung_katalog (betrieb_id, code, bezeichnung, einheit, gewerk)
      VALUES (v_betrieb.id, v_row[1], v_row[2], v_row[3], v_row[4])
      ON CONFLICT (betrieb_id, code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Trigger: seed catalog for any new betrieb
CREATE OR REPLACE FUNCTION public.seed_leistung_katalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes TEXT[][] := ARRAY[
    ['VSPACHTEL_Q3','Vollflächige Spachtelung Q3','m2','Wand/Decke'],
    ['GK_DECKE','Gipskartondecke spachteln','m2','Decke'],
    ['TAPETE_ENTF','Tapete entfernen','m2','Wand'],
    ['RAUHFASER','Raufaser tapezieren','m2','Wand'],
    ['TIEFGRUND','Tiefgrund auftragen','m2','Wand/Decke'],
    ['DISP_KL3','Dispersion Klasse 3','m2','Wand/Decke'],
    ['SILIKAT','Silikatfarbe','m2','Wand/Decke'],
    ['ABDECKVLIES','Abdeckvlies Boden','m2','Schutz'],
    ['MALERFOLIE','Malerfolie','m2','Schutz'],
    ['HK_RIPPE_LACK','Heizkörper Rippe lackieren','Stk','Heizkörper'],
    ['HK_ROHRE_LACK','Heizungsrohre lackieren','m','Heizkörper'],
    ['ACRYL','Acryl-Fuge','m','Sonder'],
    ['TUEREN_LACK','Türen lackieren','Stk','Sonder'],
    ['TUERRAHMEN_LACK','Türrahmen lackieren','Stk','Sonder'],
    ['SCHIENEN_DEMO','Schienen demontieren','m','Sonder'],
    ['HOLZDECKE_DEMO','Holzdecke demontieren','m2','Sonder'],
    ['PUTZFLAECHE','Putzfläche','m2','Sonder']
  ];
  v_row TEXT[];
BEGIN
  FOREACH v_row SLICE 1 IN ARRAY v_codes LOOP
    INSERT INTO public.leistung_katalog (betrieb_id, code, bezeichnung, einheit, gewerk)
    VALUES (NEW.id, v_row[1], v_row[2], v_row[3], v_row[4])
    ON CONFLICT (betrieb_id, code) DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_leistung_katalog ON public.betrieb;
CREATE TRIGGER trg_seed_leistung_katalog
AFTER INSERT ON public.betrieb
FOR EACH ROW EXECUTE FUNCTION public.seed_leistung_katalog();
