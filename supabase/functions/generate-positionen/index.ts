// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Befund = { stufe: "blocker" | "warnung"; meldung: string; raum_id?: string; raum_name?: string };
type Position = { code: string; bezeichnung: string; einheit: string; menge: number; formel: string };

function n(v: any): number {
  const x = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(x) ? Number(x) : 0;
}

async function computeRaum(supabase: any, raum: any) {
  const befunde: Befund[] = [];
  const positionen: Position[] = [];

  const [{ data: tfs }, { data: oeff }, { data: hks }, { data: acryl }, { data: rl }] = await Promise.all([
    supabase.from("raum_teilflaeche").select("*").eq("raum_id", raum.id),
    supabase.from("oeffnung").select("*").eq("raum_id", raum.id),
    supabase.from("heizkoerper").select("*").eq("raum_id", raum.id),
    supabase.from("acryl_position").select("*").eq("raum_id", raum.id),
    supabase.from("raum_leistung").select("*, leistung_katalog(code,bezeichnung,einheit)").eq("raum_id", raum.id),
  ]);

  const L = n(raum.laenge_cm) / 100;
  const B = n(raum.breite_cm) / 100;
  const H = n(raum.raumhoehe_cm) / 100;

  if (!L || !B || !H) {
    befunde.push({ stufe: "blocker", meldung: "Raummaße unvollständig (Länge/Breite/Höhe)", raum_id: raum.id, raum_name: raum.name });
  }
  if (H > 0 && H < 2.0) befunde.push({ stufe: "warnung", meldung: `Raumhöhe ungewöhnlich gering: ${H} m`, raum_id: raum.id, raum_name: raum.name });
  if (H > 4.0) befunde.push({ stufe: "warnung", meldung: `Raumhöhe ungewöhnlich hoch: ${H} m`, raum_id: raum.id, raum_name: raum.name });

  const bodenFlaeche = L * B;
  let deckenFlaeche = bodenFlaeche;
  let wandFlaeche = 2 * (L + B) * H;

  for (const t of tfs ?? []) {
    const a = (n(t.laenge_cm) * n(t.breite_cm)) / 10000;
    const wirkt = (t.daten as any)?.wirkt_auf as string | undefined;
    const sign = t.typ === "abzug" ? -1 : 1;
    if (wirkt === "decke") deckenFlaeche += sign * a;
    if (wirkt === "wand") wandFlaeche += sign * a;
  }

  for (const o of oeff ?? []) {
    const d = (o.daten as any) ?? {};
    const anzahl = n(d.anzahl) || 1;
    const a = (n(o.breite_cm) * n(o.hoehe_cm)) / 10000 * anzahl;
    if (d.von_wandflaeche_abziehen !== false) wandFlaeche -= a;
    if (!o.breite_cm || !o.hoehe_cm) {
      befunde.push({ stufe: "warnung", meldung: `Öffnung "${o.typ}" ohne Maße`, raum_id: raum.id, raum_name: raum.name });
    }
  }

  if (wandFlaeche < 0) {
    befunde.push({ stufe: "blocker", meldung: "Wandfläche negativ – Öffnungen überprüfen", raum_id: raum.id, raum_name: raum.name });
    wandFlaeche = 0;
  }

  for (const r of rl ?? []) {
    const code = r.leistung_katalog?.code ?? null;
    if (!code) continue;
    const bz = r.bezeichnung || r.leistung_katalog?.bezeichnung || code;
    const einheit = r.einheit || r.leistung_katalog?.einheit || "m2";
    let menge = 0;
    let formel = "";

    switch (code) {
      case "VSPACHTEL_Q3":
      case "TIEFGRUND":
      case "DISP_KL3":
      case "SILIKAT":
        menge = wandFlaeche + deckenFlaeche;
        formel = `Wandfläche ${wandFlaeche.toFixed(2)} + Deckenfläche ${deckenFlaeche.toFixed(2)}`;
        break;
      case "GK_DECKE":
        menge = deckenFlaeche;
        formel = `Decke ${L.toFixed(2)} × ${B.toFixed(2)}`;
        break;
      case "TAPETE_ENTF":
      case "RAUHFASER":
        menge = wandFlaeche;
        formel = `Wand 2×(${L.toFixed(2)}+${B.toFixed(2)})×${H.toFixed(2)} − Öffnungen`;
        break;
      case "ABDECKVLIES":
      case "MALERFOLIE":
        menge = bodenFlaeche;
        formel = `Boden ${L.toFixed(2)} × ${B.toFixed(2)}`;
        break;
      case "HK_RIPPE_LACK": {
        const stk = (hks ?? []).filter((h: any) => (h.daten as any)?.typ === "rippe").length;
        menge = stk;
        formel = `${stk} Heizkörper (Rippe)`;
        break;
      }
      case "HK_ROHRE_LACK": {
        let m = 0;
        for (const h of hks ?? []) {
          const d = (h.daten as any) ?? {};
          if (d.typ === "rohr") for (const l of d.rohr_laengen_cm ?? []) m += n(l) / 100;
        }
        menge = m;
        formel = `Summe Rohrlängen`;
        break;
      }
      case "ACRYL": {
        let m = 0;
        for (const a of acryl ?? []) m += n(a.laenge_m);
        menge = m;
        formel = `Summe Acryl-Längen`;
        break;
      }
      default:
        menge = n(r.menge);
        formel = "manuell";
    }

    positionen.push({ code, bezeichnung: bz, einheit, menge: Math.round(menge * 100) / 100, formel });
  }

  return {
    raum: { id: raum.id, name: raum.name, L, B, H, bodenFlaeche, deckenFlaeche, wandFlaeche },
    positionen,
    befunde,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    // Raum-Modus (Wizard Schritt 6)
    if (body.raum_id) {
      const { data: raum, error } = await supabase.from("raum").select("*").eq("id", body.raum_id).single();
      if (error || !raum) throw new Error("Raum nicht gefunden");
      const result = await computeRaum(supabase, raum);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Projekt-Modus (Vorschau)
    const projektInput = body.projekt;
    const projektId = projektInput?.id ?? body.projekt_id;
    if (!projektId) throw new Error("projekt.id oder raum_id erforderlich");

    const { data: projekt, error: pErr } = await supabase
      .from("projekt").select("*").eq("id", projektId).single();
    if (pErr || !projekt) throw new Error("Projekt nicht gefunden");

    const { data: raeume } = await supabase
      .from("raum").select("*").eq("projekt_id", projektId).order("reihenfolge", { ascending: true });

    const alleBefunde: Befund[] = [];
    // gruppieren nach code
    const gruppen = new Map<string, {
      code: string;
      bezeichnung: string;
      einheit: string;
      raeume: { raum_id: string; raum_name: string; formel: string; ergebnis: number }[];
      endsumme: number;
    }>();

    for (const raum of raeume ?? []) {
      const r = await computeRaum(supabase, raum);
      alleBefunde.push(...r.befunde);
      for (const p of r.positionen) {
        let g = gruppen.get(p.code);
        if (!g) {
          g = { code: p.code, bezeichnung: p.bezeichnung, einheit: p.einheit, raeume: [], endsumme: 0 };
          gruppen.set(p.code, g);
        }
        g.raeume.push({ raum_id: raum.id, raum_name: raum.name, formel: p.formel, ergebnis: p.menge });
        g.endsumme = Math.round((g.endsumme + p.menge) * 100) / 100;
      }
    }

    const positionen = Array.from(gruppen.values()).sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, "de"));
    const blocker = alleBefunde.filter((b) => b.stufe === "blocker");
    const warnungen = alleBefunde.filter((b) => b.stufe === "warnung");

    return new Response(
      JSON.stringify({
        uebergabe: {
          projekt_id: projektId,
          projekt: { kunde: projekt.kunde, objekt_bezeichnung: projekt.objekt_bezeichnung, auftrag_nr: projekt.auftrag_nr },
          positionen,
        },
        befunde: alleBefunde,
        blocker,
        warnungen,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
