/**
 * Baut einen vollständigen Raum-Snapshot (raum + alle Sub-Tabellen)
 * für den Upload via upsert_raum_snapshot RPC.
 */
import { supabase } from "@/integrations/supabase/client";

export type RaumSnapshot = {
  raum: {
    id: string;
    projekt_id: string;
    name: string;
    etage: string | null;
    raumhoehe_cm: number | null;
    laenge_cm: number | null;
    breite_cm: number | null;
    deckentyp: string | null;
    bemerkung: string | null;
    reihenfolge: number | null;
    geometrie: unknown;
  };
  teilflaechen: unknown[];
  oeffnungen: unknown[];
  heizkoerper: unknown[];
  acryl: unknown[];
  leistungen: unknown[];
};

export async function buildRaumSnapshot(raumId: string): Promise<RaumSnapshot> {
  const [raumR, tfR, oeffR, hkR, acR, rlR] = await Promise.all([
    supabase.from("raum").select("*").eq("id", raumId).single(),
    supabase.from("raum_teilflaeche").select("*").eq("raum_id", raumId),
    supabase.from("oeffnung").select("*").eq("raum_id", raumId),
    supabase.from("heizkoerper").select("*").eq("raum_id", raumId),
    supabase.from("acryl_position").select("*").eq("raum_id", raumId),
    supabase.from("raum_leistung").select("*").eq("raum_id", raumId),
  ]);
  if (raumR.error) throw new Error(raumR.error.message);
  const r = raumR.data;
  return {
    raum: {
      id: r.id,
      projekt_id: r.projekt_id,
      name: r.name,
      etage: r.etage ?? null,
      raumhoehe_cm: r.raumhoehe_cm ?? null,
      laenge_cm: r.laenge_cm ?? null,
      breite_cm: r.breite_cm ?? null,
      deckentyp: r.deckentyp ?? null,
      bemerkung: r.bemerkung ?? null,
      reihenfolge: r.reihenfolge ?? null,
      geometrie: r.geometrie ?? null,
    },
    teilflaechen: (tfR.data ?? []).map((x) => ({
      typ: x.typ,
      laenge_cm: x.laenge_cm,
      breite_cm: x.breite_cm,
      hoehe_cm: x.hoehe_cm,
      flaeche_m2: x.flaeche_m2,
      bemerkung: x.bemerkung,
      daten: x.daten ?? {},
    })),
    oeffnungen: (oeffR.data ?? []).map((x) => ({
      typ: x.typ,
      breite_cm: x.breite_cm,
      hoehe_cm: x.hoehe_cm,
      bemerkung: x.bemerkung,
      daten: x.daten ?? {},
    })),
    heizkoerper: (hkR.data ?? []).map((x) => ({
      breite_cm: x.breite_cm,
      hoehe_cm: x.hoehe_cm,
      tiefe_cm: x.tiefe_cm,
      abstand_boden_cm: x.abstand_boden_cm,
      bemerkung: x.bemerkung,
      daten: x.daten ?? {},
    })),
    acryl: (acR.data ?? []).map((x) => ({
      laenge_m: x.laenge_m,
      beschreibung: x.beschreibung,
      daten: x.daten ?? {},
    })),
    leistungen: (rlR.data ?? []).map((x) => ({
      leistung_id: x.leistung_id,
      bezeichnung: x.bezeichnung,
      einheit: x.einheit,
      menge: x.menge,
      daten: x.daten ?? {},
    })),
  };
}

/**
 * Speichert den letzten bekannten Snapshot des Raums lokal (IndexedDB).
 * Wird u.a. für Offline-Öffnen genutzt.
 */
export async function cacheRaumSnapshotLocal(snap: RaumSnapshot): Promise<void> {
  const { putDraft } = await import("./offline-db");
  await putDraft({
    raumId: snap.raum.id,
    projektId: snap.raum.projekt_id,
    updatedAt: Date.now(),
    data: snap,
  });
}
