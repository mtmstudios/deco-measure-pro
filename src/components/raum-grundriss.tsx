import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Schematischer 2D-Grundriss eines Raums, gezeichnet aus den Aufmaßdaten.
 * Hinweis: Die genaue Wandposition von Öffnungen wird (noch) nicht erfasst,
 * daher werden Öffnungen schematisch reihum auf die Wände verteilt.
 */

type OeffnungLite = { typ: string; breiteCm: number | null };
type HeizkoerperLite = { typ: string };

const WALLS = ["top", "right", "bottom", "left"] as const;
type Wall = (typeof WALLS)[number];

const m = (v: number) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const oeffnungStroke = (typ: string) => (typ === "fenster" ? "stroke-primary" : "stroke-warning");

export function RaumGrundriss({
  laengeCm,
  breiteCm,
  raumhoeheCm,
  oeffnungen = [],
  heizkoerper = [],
  className,
}: {
  laengeCm: number | null;
  breiteCm: number | null;
  raumhoeheCm: number | null;
  oeffnungen?: OeffnungLite[];
  heizkoerper?: HeizkoerperLite[];
  className?: string;
}) {
  const L = (laengeCm ?? 0) / 100;
  const B = (breiteCm ?? 0) / 100;
  const H = (raumhoeheCm ?? 0) / 100;

  if (!(L > 0) || !(B > 0)) {
    return (
      <div className="rounded-xl border-2 border-dashed border-input p-6 text-center text-sm text-muted-foreground">
        Länge und Breite eingeben — dann erscheint der Grundriss.
      </div>
    );
  }

  const VB_W = 320;
  const VB_H = 230;
  const padL = 30;
  const padR = 16;
  const padT = 26;
  const padB = 22;
  const innerW = VB_W - padL - padR;
  const innerH = VB_H - padT - padB;
  const scale = Math.min(innerW / L, innerH / B);
  const rw = L * scale;
  const rh = B * scale;
  const ox = padL + (innerW - rw) / 2;
  const oy = padT + (innerH - rh) / 2;

  const byWall: Record<Wall, OeffnungLite[]> = { top: [], right: [], bottom: [], left: [] };
  oeffnungen.forEach((o, i) => byWall[WALLS[i % 4]].push(o));

  const segs: { x1: number; y1: number; x2: number; y2: number; cls: string }[] = [];
  (Object.keys(byWall) as Wall[]).forEach((w) => {
    const list = byWall[w];
    const horizontal = w === "top" || w === "bottom";
    const wallLen = horizontal ? rw : rh;
    list.forEach((o, k) => {
      const frac = (k + 1) / (list.length + 1);
      const len = Math.max(10, Math.min(((o.breiteCm ?? 60) / 100) * scale, wallLen * 0.8));
      const cls = oeffnungStroke(o.typ);
      if (w === "top") {
        const cx = ox + rw * frac;
        segs.push({ x1: cx - len / 2, y1: oy, x2: cx + len / 2, y2: oy, cls });
      } else if (w === "bottom") {
        const cx = ox + rw * frac;
        segs.push({ x1: cx - len / 2, y1: oy + rh, x2: cx + len / 2, y2: oy + rh, cls });
      } else if (w === "left") {
        const cy = oy + rh * frac;
        segs.push({ x1: ox, y1: cy - len / 2, x2: ox, y2: cy + len / 2, cls });
      } else {
        const cy = oy + rh * frac;
        segs.push({ x1: ox + rw, y1: cy - len / 2, x2: ox + rw, y2: cy + len / 2, cls });
      }
    });
  });

  const rads = heizkoerper.map((_, k) => {
    const frac = (k + 1) / (heizkoerper.length + 1);
    const rwid = Math.min(28, rw * 0.22);
    return { x: ox + rw * frac - rwid / 2, y: oy + rh - 9, w: rwid, h: 5 };
  });

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Grundriss ${m(L)} mal ${m(B)} Meter`}
      >
        <rect
          x={ox}
          y={oy}
          width={rw}
          height={rh}
          rx={3}
          className="fill-muted stroke-foreground"
          strokeWidth={5}
        />

        {rads.map((r, i) => (
          <rect
            key={`r${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={1.5}
            className="fill-primary/15 stroke-primary"
            strokeWidth={1.2}
          />
        ))}

        {segs.map((s, i) => (
          <line
            key={`o${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            className={s.cls}
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}

        <line x1={ox} y1={oy - 12} x2={ox + rw} y2={oy - 12} className="stroke-muted-foreground" strokeWidth={1} />
        <line x1={ox} y1={oy - 15} x2={ox} y2={oy - 9} className="stroke-muted-foreground" strokeWidth={1} />
        <line x1={ox + rw} y1={oy - 15} x2={ox + rw} y2={oy - 9} className="stroke-muted-foreground" strokeWidth={1} />
        <text x={ox + rw / 2} y={oy - 16} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
          {m(L)} m
        </text>

        <line x1={ox - 12} y1={oy} x2={ox - 12} y2={oy + rh} className="stroke-muted-foreground" strokeWidth={1} />
        <line x1={ox - 15} y1={oy} x2={ox - 9} y2={oy} className="stroke-muted-foreground" strokeWidth={1} />
        <line x1={ox - 15} y1={oy + rh} x2={ox - 9} y2={oy + rh} className="stroke-muted-foreground" strokeWidth={1} />
        <text
          x={ox - 16}
          y={oy + rh / 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={11}
          transform={`rotate(-90 ${ox - 16} ${oy + rh / 2})`}
        >
          {m(B)} m
        </text>

        <text x={VB_W / 2} y={VB_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
          {H > 0 ? `RH ${m(H)} m · ` : ""}schematisch
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        <LegendSwatch swatch="bg-primary" label="Fenster" />
        <LegendSwatch swatch="bg-warning" label="Tür / Balkontür" />
        <LegendSwatch swatch="bg-primary/15 border border-primary" label="Heizkörper" />
      </div>
    </div>
  );
}

function LegendSwatch({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3.5 h-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

/** Lädt die Raumdaten selbst und rendert den Grundriss als Karte. */
export function RaumGrundrissCard({ raumId }: { raumId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["grundriss", raumId],
    queryFn: async () => {
      const [raumRes, oeRes, hkRes] = await Promise.all([
        supabase.from("raum").select("laenge_cm, breite_cm, raumhoehe_cm").eq("id", raumId).single(),
        supabase.from("oeffnung").select("typ, breite_cm").eq("raum_id", raumId).order("created_at"),
        supabase.from("heizkoerper").select("daten").eq("raum_id", raumId).order("created_at"),
      ]);
      return { raum: raumRes.data, oe: oeRes.data ?? [], hk: hkRes.data ?? [] };
    },
  });

  if (isLoading || !data?.raum) return null;

  return (
    <div className="rounded-xl border-2 border-input p-3 bg-card">
      <h3 className="text-sm font-bold mb-2">Grundriss</h3>
      <RaumGrundriss
        laengeCm={data.raum.laenge_cm}
        breiteCm={data.raum.breite_cm}
        raumhoeheCm={data.raum.raumhoehe_cm}
        oeffnungen={(data.oe as Array<{ typ: string; breite_cm: number | null }>).map((o) => ({
          typ: o.typ,
          breiteCm: o.breite_cm,
        }))}
        heizkoerper={(data.hk as Array<{ daten: { typ?: string } | null }>).map((h) => ({
          typ: h.daten?.typ ?? "rippe",
        }))}
      />
    </div>
  );
}
