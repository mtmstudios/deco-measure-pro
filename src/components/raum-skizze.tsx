import { useMemo, useRef, useState } from "react";
import { Undo2, RotateCcw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RaumGeometrie, BodenTerm } from "@/components/geometrie-editor";

/**
 * Raum-Skizze: Ecken tippen → ortho-gesnapptes Polygon → Maßkette je Wand (cm).
 * Übernahme schreibt raum.geometrie (modus "masskette"): Wandabschnitte =
 * Kantenlängen, Bodenfläche = Rechteck-Zerlegung des Polygons. Speist damit
 * denselben Raumlevel-Export wie der Maßketten-Editor.
 */

type Pt = { x: number; y: number };

const VB = 100;
const SNAP_DEG = 12;
const CLOSE_DIST = 6;
const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

function orthoSnap(prev: Pt, c: Pt): Pt {
  const dx = c.x - prev.x;
  const dy = c.y - prev.y;
  if (dx === 0 && dy === 0) return c;
  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  if (angle <= SNAP_DEG) return { x: c.x, y: prev.y };
  if (angle >= 90 - SNAP_DEG) return { x: prev.x, y: c.y };
  return c;
}
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Rechtwinkliges Polygon → Rechtecke (Scanline), Summe = exakte Fläche. */
function polygonToRects(coords: Pt[]): BodenTerm[] {
  const ys = [...new Set(coords.map((p) => Math.round(p.y * 10) / 10))].sort((a, b) => a - b);
  const terme: BodenTerm[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const ymid = (ys[i] + ys[i + 1]) / 2;
    const h = ys[i + 1] - ys[i];
    if (h <= 0.5) continue;
    const xs: number[] = [];
    for (let e = 0; e < coords.length; e++) {
      const a = coords[e];
      const b = coords[(e + 1) % coords.length];
      if ((a.y <= ymid && b.y > ymid) || (b.y <= ymid && a.y > ymid)) {
        const t = (ymid - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const w = xs[k + 1] - xs[k];
      if (w > 0.5) terme.push({ laenge_cm: Math.round(w), breite_cm: Math.round(h) });
    }
  }
  return terme;
}

export function RaumSkizze({ raumId, initial }: { raumId: string; initial: RaumGeometrie | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [closed, setClosed] = useState(false);
  const [lengths, setLengths] = useState<number[]>([]);
  const [activeEdge, setActiveEdge] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const vorhanden =
    initial?.modus === "masskette" && (initial.wand_abschnitte_cm?.length ?? 0) > 0
      ? initial.wand_abschnitte_cm!.length
      : 0;

  const toSvg = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VB, y: ((e.clientY - r.top) / r.height) * VB };
  };

  const handleTap = (e: React.PointerEvent) => {
    if (closed) return;
    let c = toSvg(e);
    if (points.length > 0) c = orthoSnap(points[points.length - 1], c);
    if (points.length >= 3 && dist(c, points[0]) <= CLOSE_DIST) {
      setClosed(true);
      setLengths(Array(points.length).fill(0));
      return;
    }
    c = { x: Math.max(4, Math.min(96, c.x)), y: Math.max(4, Math.min(96, c.y)) };
    setPoints((p) => [...p, c]);
  };

  const undo = () => {
    if (closed) {
      setClosed(false);
      setLengths([]);
      return;
    }
    setPoints((p) => p.slice(0, -1));
  };
  const reset = () => {
    setPoints([]);
    setClosed(false);
    setLengths([]);
    setActiveEdge(null);
  };

  const edges = useMemo(() => {
    const n = points.length;
    if (n < 2) return [] as [Pt, Pt][];
    const out: [Pt, Pt][] = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) out.push([points[i], points[(i + 1) % n]]);
    return out;
  }, [points, closed]);

  const calc = useMemo(() => {
    if (!closed || lengths.length !== edges.length || lengths.some((l) => !l || l <= 0)) return null;
    const coords: Pt[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len;
      let uy = dy / len;
      const ang = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      if (ang <= 15) { ux = Math.sign(dx) || 1; uy = 0; }
      else if (ang >= 75) { ux = 0; uy = Math.sign(dy) || 1; }
      coords.push({ x: coords[i].x + ux * lengths[i], y: coords[i].y + uy * lengths[i] });
    }
    const poly = coords.slice(0, edges.length);
    const umfang = lengths.reduce((a, b) => a + b, 0);
    const closeErr = dist(coords[coords.length - 1], coords[0]);
    let area2 = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area2 += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return {
      umfang,
      flaeche_m2: Math.abs(area2) / 2 / 10000,
      ok: closeErr <= umfang * 0.03,
      terme: polygonToRects(poly),
    };
  }, [closed, lengths, edges]);

  async function uebernehmen() {
    if (!calc) return;
    setSaving(true);
    const geo: RaumGeometrie = {
      modus: "masskette",
      wand_abschnitte_cm: lengths.map((n) => Math.round(n)),
      boden_terme: calc.terme,
    };
    const { error } = await supabase.from("raum").update({ geometrie: geo } as never).eq("id", raumId);
    setSaving(false);
    if (error) {
      toast.error(
        /geometrie/i.test(error.message)
          ? "DB-Spalte 'geometrie' fehlt – bitte Migration anwenden."
          : error.message,
      );
      return;
    }
    toast.success("Maßkette übernommen");
  }

  const firstClosable = !closed && points.length >= 3;

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-stone-muted)]">
        {closed
          ? "Trage die Länge jeder Wand in cm ein und übernimm die Maßkette."
          : "Tippe die Ecken des Raums nacheinander an. Wände rasten waagerecht/senkrecht ein. Zum Schließen die erste Ecke antippen."}
        {vorhanden > 0 && !closed && !points.length ? ` Bereits erfasst: ${vorhanden} Wandabschnitte.` : ""}
      </p>

      <div className="border border-[var(--color-hairline)] bg-[var(--color-paper)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB} ${VB}`}
          className="w-full aspect-square touch-none select-none"
          onPointerDown={handleTap}
        >
          {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((g) => (
            <g key={g}>
              <line x1={g} y1={0} x2={g} y2={VB} stroke="var(--color-hairline)" strokeWidth={0.2} />
              <line x1={0} y1={g} x2={VB} y2={g} stroke="var(--color-hairline)" strokeWidth={0.2} />
            </g>
          ))}
          {closed && (
            <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="var(--color-sand)" />
          )}
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={activeEdge === i ? "var(--color-brand)" : "var(--color-ink)"}
              strokeWidth={activeEdge === i ? 1.4 : 0.9}
              strokeLinecap="round"
            />
          ))}
          {closed &&
            edges.map(([a, b], i) => {
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              return (
                <g key={`l${i}`} onPointerDown={(e) => { e.stopPropagation(); setActiveEdge(i); }}>
                  <rect x={mx - 8} y={my - 3.4} width={16} height={6.8} rx={1.5}
                    fill="var(--color-paper)" stroke="var(--color-hairline)" strokeWidth={0.3} />
                  <text x={mx} y={my + 1.9} textAnchor="middle" fontSize={4}
                    fill="var(--color-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {lengths[i] ? `${lengths[i]}` : "?"}
                  </text>
                </g>
              );
            })}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === 0 && firstClosable ? 2.4 : 1.6}
              fill={i === 0 && firstClosable ? "var(--color-brand)" : "var(--color-ink)"}
            />
          ))}
        </svg>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={undo}
          disabled={points.length === 0}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]"
        >
          <Undo2 className="size-4" strokeWidth={1.75} />
          {closed ? "Öffnen" : "Ecke zurück"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={points.length === 0}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
          Zurücksetzen
        </button>
      </div>

      {closed && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Maßkette</span>
          {edges.map((_, i) => (
            <label
              key={i}
              className={`flex items-center gap-3 min-h-[52px] px-4 border bg-[var(--color-paper)] ${
                activeEdge === i ? "border-[var(--color-brand)]" : "border-[var(--color-hairline)]"
              }`}
            >
              <span className="text-[13px] w-16 text-[var(--color-stone-muted)]">Wand {i + 1}</span>
              <input
                type="number"
                inputMode="numeric"
                value={lengths[i] || ""}
                onFocus={() => setActiveEdge(i)}
                onChange={(e) => setLengths((ls) => ls.map((l, j) => (j === i ? Number(e.target.value) : l)))}
                placeholder="0"
                className="flex-1 bg-transparent text-[17px] tabular-nums outline-none"
              />
              <span className="text-[13px] text-[var(--color-stone-muted)]">cm</span>
            </label>
          ))}
        </div>
      )}

      {calc && (
        <div className="border border-[var(--color-hairline)] bg-[var(--color-sand)] p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[15px]">Umfang (Wandabschnitte)</span>
            <span className="text-[17px] font-serif tabular-nums">{nf.format(calc.umfang / 100)} m</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[15px]">Bodenfläche</span>
            <span className="text-[20px] font-serif font-bold tabular-nums text-[var(--color-brand)]">
              {nf.format(calc.flaeche_m2)} m²
            </span>
          </div>
          {!calc.ok && (
            <p className="text-[12px] text-[var(--color-stone-muted)] pt-1 border-t border-[var(--color-hairline)]">
              Hinweis: Die Maße schließen den Raum nicht ganz — bitte die Wandlängen prüfen.
            </p>
          )}
          <button
            type="button"
            onClick={uebernehmen}
            disabled={saving}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-[var(--color-ink)] text-[var(--color-paper)] text-[14px] font-semibold uppercase tracking-[0.06em] disabled:opacity-50"
          >
            <Check className="size-4" strokeWidth={2} />
            {saving ? "Übernehme…" : "Als Maßkette übernehmen"}
          </button>
        </div>
      )}
    </div>
  );
}
