import { supabase } from "@/integrations/supabase/client";

export type RaumLeistungRow = {
  id: string;
  raum_id: string;
  leistung_id: string | null;
  bezeichnung: string | null;
  einheit: string | null;
  menge: number | null;
  daten: Record<string, unknown> | null;
};

export async function setRaumLeistung(
  raumId: string,
  code: string,
  active: boolean,
  catalog: { id: string; code: string; bezeichnung: string; einheit: string }[],
) {
  const kat = catalog.find((c) => c.code === code);
  if (!kat) return;
  if (active) {
    const { data: existing } = await supabase
      .from("raum_leistung")
      .select("id")
      .eq("raum_id", raumId)
      .eq("leistung_id", kat.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("raum_leistung").insert({
        raum_id: raumId,
        leistung_id: kat.id,
        bezeichnung: kat.bezeichnung,
        einheit: kat.einheit,
      });
    }
  } else {
    await supabase.from("raum_leistung").delete().eq("raum_id", raumId).eq("leistung_id", kat.id);
  }
}

export function leistungAktiv(rows: RaumLeistungRow[], catalogId: string | undefined) {
  if (!catalogId) return false;
  return rows.some((r) => r.leistung_id === catalogId);
}
