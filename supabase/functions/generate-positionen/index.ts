// deno-lint-ignore-file no-explicit-any
// Engine: berechnet Leistungspositionen aus einem "Engine-Projekt".
// Eingabe und Ausgabe entsprechen Anhang A der Spezifikation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA_VERSION = "1.0";

type Befund = { schwere: "block" | "warnung"; code: string; raum?: string; message: string };

type EngineRaum = {
  id?: string;
  raumname: string;
  reihenfolge?: number;
  laenge_cm: number | null;
  breite_cm: number | null;
  raumhoehe_cm: number | null;
  deckentyp?: string | null;
  teilflaechen?: any[];
  oeffnungen?: any[];
  heizkoerper?: any[];
  acryl?: { laenge_cm: number }[];
  leistungen?: { leistungs_code: string }[];
};

type EngineProjekt = {
  kunde?: string | null;
  objekt_bezeichnung?: string | null;
  auftrag_nr?: string | null;
  gewerk?: string | null;
  adresse?: string | null;
  raeume: EngineRaum[];
};

type Zeile = { raum: string; formel: string; ergebnis: number };
type Position = {
  leistungs_code: string;
  name: string;
  einheit: string;
  zeilen: Zeile[];
  endsumme: number;
};

const LEISTUNGEN: Record<string, { name: string; einheit: string }> = {
  VSPACHTEL_Q3: { name: "Vollflächige Spachtelung Q3", einheit: "m2" },
  GK_DECKE: { name: "Gipskartondecke spachteln", einheit: "m2" },
  TAPETE_ENTF: { name: "Tapete entfernen", einheit: "m2" },
  RAUHFASER: { name: "Raufaser tapezieren", einheit: "m2" },
  TIEFGRUND: { name: "Tiefgrund auftragen", einheit: "m2" },
  DISP_KL3: { name: "Dispersion Klasse 3", einheit: "m2" },
  SILIKAT: { name: "Silikatfarbe", einheit: "m2" },
  ABDECKVLIES: { name: "Abdeckvlies Boden", einheit: "m2" },
  MALERFOLIE: { name: "Malerfolie", einheit: "m2" },
  HK_RIPPE_LACK: { name: "Heizkörper Rippe lackieren", einheit: "Stk" },
  HK_ROHRE_LACK: { name: "Heizungsrohre lackieren", einheit: "m" },
  ACRYL: { name: "Acryl-Fuge", einheit: "m" },
  TUEREN_LACK: { name: "Türen lackieren", einheit: "Stk" },
  TUERRAHMEN_LACK: { name: "Türrahmen lackieren", einheit: "Stk" },
  SCHIENEN_DEMO: { name: "Schienen demontieren", einheit: "m" },
  HOLZDECKE_DEMO: { name: "Holzdecke demontieren", einheit: "m2" },
  PUTZFLAECHE: { name: "Putzfläche", einheit: "m2" },
};

const num = (v: any) => {
  const x = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(x) ? Number(x) : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;
const de2 = (v: number) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function computeRaum(raum: EngineRaum) {
  const befunde: Befund[] = [];
  const name = raum.raumname || "Raum";

  const L = num(raum.laenge_cm) / 100;
  const B = num(raum.breite_cm) / 100;
  const H = num(raum.raumhoehe_cm) / 100;

  if (!L || !B || !H) {
    befunde.push({
      schwere: "block",
      code: "RAUM_MASSE_FEHLEN",
      raum: name,
      message: "Raummaße unvollständig (Länge/Breite/Höhe)",
    });
  }
  if (H > 0 && H < 2.0)
    befunde.push({ schwere: "warnung", code: "HOEHE_GERING", raum: name, message: `Raumhöhe ungewöhnlich gering: ${de2(H)} m` });
  if (H > 4.0)
    befunde.push({ schwere: "warnung", code: "HOEHE_HOCH", raum: name, message: `Raumhöhe ungewöhnlich hoch: ${de2(H)} m` });

  const bodenFlaeche = L * B;
  let deckenFlaeche = bodenFlaeche;
  let wandFlaeche = 2 * (L + B) * H;
  let wandAbzug = 0;

  for (const t of raum.teilflaechen ?? []) {
    const a = (num(t.laenge_cm) * num(t.breite_cm)) / 10000;
    const sign = t.typ === "abzug" ? -1 : 1;
    if (t.wirkt_auf === "decke") deckenFlaeche += sign * a;
    if (t.wirkt_auf === "wand") wandFlaeche += sign * a;
  }

  for (const o of raum.oeffnungen ?? []) {
    const anzahl = num(o.anzahl) || 1;
    const a = (num(o.breite_cm) * num(o.hoehe_cm) * anzahl) / 10000;
    if (o.von_wandflaeche_abziehen !== false) {
      wandFlaeche -= a;
      wandAbzug += a;
    }
    if (!o.breite_cm || !o.hoehe_cm) {
      befunde.push({
        schwere: "warnung",
        code: "OEFFNUNG_OHNE_MASS",
        raum: name,
        message: `Öffnung "${o.typ ?? "?"}" ohne Maße`,
      });
    }
  }

  if (wandFlaeche < 0) {
    befunde.push({
      schwere: "block",
      code: "WAND_NEGATIV",
      raum: name,
      message: "Wandfläche negativ – Öffnungen überprüfen",
    });
    wandFlaeche = 0;
  }

  const positionen: { code: string; menge: number; formel: string }[] = [];
  const codes = (raum.leistungen ?? []).map((l) => l.leistungs_code).filter(Boolean);

  for (const code of codes) {
    let menge = 0;
    let formel = "";
    switch (code) {
      case "VSPACHTEL_Q3":
      case "TIEFGRUND":
      case "DISP_KL3":
      case "SILIKAT":
        menge = wandFlaeche + deckenFlaeche;
        formel = `Wandfläche ${de2(wandFlaeche)} + Deckenfläche ${de2(deckenFlaeche)}`;
        break;
      case "GK_DECKE":
        menge = deckenFlaeche;
        formel = `Decke ${de2(L)} × ${de2(B)}`;
        break;
      case "TAPETE_ENTF":
      case "RAUHFASER":
        menge = wandFlaeche;
        formel =
          wandAbzug > 0
            ? `2×(${de2(L)}+${de2(B)})×${de2(H)} − Öffnungen ${de2(wandAbzug)}`
            : `2×(${de2(L)}+${de2(B)})×${de2(H)}`;
        break;
      case "ABDECKVLIES":
      case "MALERFOLIE":
        menge = bodenFlaeche;
        formel = `Boden ${de2(L)} × ${de2(B)}`;
        break;
      case "HK_RIPPE_LACK": {
        const stk = (raum.heizkoerper ?? []).filter((h: any) => h.typ === "rippe" && h.lackieren !== false).length;
        menge = stk;
        formel = `${stk} Heizkörper (Rippe)`;
        break;
      }
      case "HK_ROHRE_LACK": {
        let m = 0;
        const parts: string[] = [];
        for (const h of raum.heizkoerper ?? []) {
          if (h.typ !== "rohr" || h.lackieren === false) continue;
          for (const l of h.rohr_laengen_cm ?? []) {
            m += num(l) / 100;
            parts.push(de2(num(l) / 100));
          }
        }
        menge = m;
        formel = parts.length ? parts.join(" + ") : "Summe Rohrlängen";
        break;
      }
      case "ACRYL": {
        let m = 0;
        const parts: string[] = [];
        for (const a of raum.acryl ?? []) {
          const v = num(a.laenge_cm) / 100;
          m += v;
          parts.push(de2(v));
        }
        menge = m;
        formel = parts.length ? parts.join(" + ") : "Summe Acryl-Längen";
        break;
      }
      case "TUEREN_LACK":
      case "TUERRAHMEN_LACK": {
        const stk = (raum.oeffnungen ?? []).filter((o: any) => o.typ === "tuer" || o.typ === "tuerelement").length;
        menge = stk;
        formel = `${stk} Tür(en)`;
        break;
      }
      default:
        menge = 0;
        formel = "manuell";
    }
    positionen.push({ code, menge: round2(menge), formel });
  }

  return {
    name,
    kennzahlen: {
      L: round2(L),
      B: round2(B),
      H: round2(H),
      boden_m2: round2(bodenFlaeche),
      decke_m2: round2(deckenFlaeche),
      wand_m2: round2(wandFlaeche),
    },
    positionen,
    befunde,
  };
}

function computeProjekt(projekt: EngineProjekt) {
  const gruppen = new Map<string, Position>();
  const alleBefunde: Befund[] = [];
  const kennzahlen: any[] = [];

  for (const raum of projekt.raeume ?? []) {
    const r = computeRaum(raum);
    alleBefunde.push(...r.befunde);
    kennzahlen.push({ raum: r.name, ...r.kennzahlen });
    for (const p of r.positionen) {
      const meta = LEISTUNGEN[p.code] ?? { name: p.code, einheit: "" };
      let g = gruppen.get(p.code);
      if (!g) {
        g = { leistungs_code: p.code, name: meta.name, einheit: meta.einheit, zeilen: [], endsumme: 0 };
        gruppen.set(p.code, g);
      }
      g.zeilen.push({ raum: r.name, formel: p.formel, ergebnis: p.menge });
      g.endsumme = round2(g.endsumme + p.menge);
    }
  }

  const positionen = Array.from(gruppen.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );

  const blocker = alleBefunde.some((b) => b.schwere === "block");

  return {
    uebergabe: {
      schema_version: SCHEMA_VERSION,
      projekt: {
        kunde: projekt.kunde ?? null,
        objekt_bezeichnung: projekt.objekt_bezeichnung ?? null,
        auftrag_nr: projekt.auftrag_nr ?? null,
        gewerk: projekt.gewerk ?? null,
      },
      positionen,
      kennzahlen,
    },
    befunde: alleBefunde,
    blocker,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const projekt: EngineProjekt | undefined = body?.projekt;
    if (!projekt || !Array.isArray(projekt.raeume)) {
      throw new Error("projekt.raeume erforderlich (Engine-Form)");
    }
    const result = computeProjekt(projekt);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
