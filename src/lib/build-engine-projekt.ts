import { supabase } from "@/integrations/supabase/client";

/**
 * Baut aus den DB-Zeilen das "Engine-Projekt" in der Form, die die
 * Edge Function `generate-positionen` erwartet (alle Maße in cm).
 */

export type EngineProjekt = {
  kunde: string | null;
  objekt_bezeichnung: string | null;
  auftrag_nr: string | null;
  gewerk: string | null;
  adresse?: string | null;
  raeume: EngineRaum[];
};

export type EngineRaum = {
  id?: string;
  raumname: string;
  reihenfolge: number;
  laenge_cm: number | null;
  breite_cm: number | null;
  raumhoehe_cm: number | null;
  deckentyp: string | null;
  teilflaechen: any[];
  oeffnungen: any[];
  heizkoerper: any[];
  acryl: { laenge_cm: number }[];
  leistungen: { leistungs_code: string }[];
};

export async function buildEngineProjekt(projektId: string): Promise<EngineProjekt> {
  const { data: projekt, error } = await supabase.from("projekt").select("*").eq("id", projektId).single();
  if (error || !projekt) throw new Error(error?.message ?? "Projekt nicht gefunden");

  const { data: raeume } = await supabase
    .from("raum")
    .select("*")
    .eq("projekt_id", projektId)
    .order("reihenfolge", { ascending: true });

  const raumIds = (raeume ?? []).map((r: any) => r.id);

  const [tf, oe, hk, ac, rl] = await Promise.all([
    raumIds.length ? supabase.from("raum_teilflaeche").select("*").in("raum_id", raumIds) : { data: [] as any[] },
    raumIds.length ? supabase.from("oeffnung").select("*").in("raum_id", raumIds) : { data: [] as any[] },
    raumIds.length ? supabase.from("heizkoerper").select("*").in("raum_id", raumIds) : { data: [] as any[] },
    raumIds.length ? supabase.from("acryl_position").select("*").in("raum_id", raumIds) : { data: [] as any[] },
    raumIds.length
      ? supabase
          .from("raum_leistung")
          .select("raum_id, leistung_katalog(code)")
          .in("raum_id", raumIds)
      : { data: [] as any[] },
  ]);

  const byRaum = <T extends { raum_id: string }>(rows: T[] | null | undefined, id: string) =>
    (rows ?? []).filter((r) => r.raum_id === id);

  const engineRaeume: EngineRaum[] = (raeume ?? []).map((r: any) => buildEngineRaum(
    r,
    byRaum(tf.data as any, r.id),
    byRaum(oe.data as any, r.id),
    byRaum(hk.data as any, r.id),
    byRaum(ac.data as any, r.id),
    byRaum(rl.data as any, r.id),
  ));

  return {
    kunde: projekt.kunde,
    objekt_bezeichnung: projekt.objekt_bezeichnung,
    auftrag_nr: projekt.auftrag_nr,
    gewerk: projekt.gewerk,
    adresse: projekt.adresse,
    raeume: engineRaeume,
  };
}

export async function buildEngineProjektFromRaum(raumId: string): Promise<EngineProjekt> {
  const { data: raum, error } = await supabase.from("raum").select("*").eq("id", raumId).single();
  if (error || !raum) throw new Error("Raum nicht gefunden");
  const { data: projekt } = await supabase.from("projekt").select("*").eq("id", raum.projekt_id).single();

  const [tf, oe, hk, ac, rl] = await Promise.all([
    supabase.from("raum_teilflaeche").select("*").eq("raum_id", raumId),
    supabase.from("oeffnung").select("*").eq("raum_id", raumId),
    supabase.from("heizkoerper").select("*").eq("raum_id", raumId),
    supabase.from("acryl_position").select("*").eq("raum_id", raumId),
    supabase.from("raum_leistung").select("raum_id, leistung_katalog(code)").eq("raum_id", raumId),
  ]);

  const engineRaum = buildEngineRaum(
    raum,
    (tf.data as any) ?? [],
    (oe.data as any) ?? [],
    (hk.data as any) ?? [],
    (ac.data as any) ?? [],
    (rl.data as any) ?? [],
  );

  return {
    kunde: projekt?.kunde ?? null,
    objekt_bezeichnung: projekt?.objekt_bezeichnung ?? null,
    auftrag_nr: projekt?.auftrag_nr ?? null,
    gewerk: projekt?.gewerk ?? null,
    adresse: projekt?.adresse ?? null,
    raeume: [engineRaum],
  };
}

function buildEngineRaum(
  r: any,
  tf: any[],
  oe: any[],
  hk: any[],
  ac: any[],
  rl: any[],
): EngineRaum {
  return {
    id: r.id,
    raumname: r.name,
    reihenfolge: r.reihenfolge ?? 0,
    laenge_cm: r.laenge_cm,
    breite_cm: r.breite_cm,
    raumhoehe_cm: r.raumhoehe_cm,
    deckentyp: r.deckentyp ?? null,
    teilflaechen: tf.map((t) => ({
      typ: t.typ,
      laenge_cm: t.laenge_cm,
      breite_cm: t.breite_cm,
      hoehe_cm: t.hoehe_cm,
      wirkt_auf: (t.daten ?? {}).wirkt_auf,
    })),
    oeffnungen: oe.map((o) => {
      const d = o.daten ?? {};
      return {
        typ: o.typ,
        breite_cm: o.breite_cm,
        hoehe_cm: o.hoehe_cm,
        anzahl: d.anzahl ?? 1,
        von_wandflaeche_abziehen: d.von_wandflaeche_abziehen !== false,
        abdecken: !!d.abdecken,
        silikon_entfernen: !!d.silikon_entfernen,
        leibung_vorhanden: !!d.leibung_vorhanden,
        leibung_tiefe_cm: d.leibung_tiefe_cm ?? null,
        leibung_seiten: d.leibung_seiten ?? null,
      };
    }),
    heizkoerper: hk.map((h) => {
      const d = h.daten ?? {};
      return {
        typ: d.typ ?? "rippe",
        hoehe_cm: h.hoehe_cm ?? d.hoehe_cm ?? null,
        breite_cm: h.breite_cm ?? d.breite_cm ?? null,
        tiefe_cm: h.tiefe_cm ?? d.tiefe_cm ?? null,
        rippenanzahl: d.rippenanzahl ?? null,
        rohr_laengen_cm: d.rohr_laengen_cm ?? [],
        lackieren: d.lackieren !== false,
      };
    }),
    acryl: ac
      .map((a) => ({ laenge_cm: a.laenge_m != null ? Math.round(Number(a.laenge_m) * 100) : 0 }))
      .filter((a) => a.laenge_cm > 0),
    leistungen: rl
      .map((x: any) => ({ leistungs_code: x.leistung_katalog?.code }))
      .filter((x: any) => !!x.leistungs_code),
  };
}
