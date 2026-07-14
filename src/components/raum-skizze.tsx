import { useMemo, useRef, useState } from "react";
import { Undo2, RotateCcw, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RaumGeometrie, BodenTerm } from "@/components/geometrie-editor";

/**
 * Raum-Skizze: Ecken tippen → ortho-gesnapptes Polygon → Maßkette je Wand (cm).
 * Fenster werden – wie auf dem Papier – als senkrechte Striche (Ticks) quer durch
 * die Wand markiert, mit Label Breite/Höhe. Übernahme schreibt raum.geometrie
 * (Wandabschnitte + Boden-Rechteckzerlegung) und legt Fenster als Öffnungen an.
 */

type Pt = { x: number; y: number };
type Fenster = { edge: number; t: number; breite: string; hoehe: string; saved?: boolean };

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

function nearestEdge(pt: Pt, edges: [Pt, Pt][]) {
  let best = { edge: 0, t: 0.5, d: Infinity };
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
    if (d < best.d) best = { edge: i, t, d };
  }
  return best;
}

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
  const [fenster, setFenster] = useState<Fenster[]>([]);
  const [fensterModus, setFensterModus] = useState(false);
  const [activeEdge, setActiveEdge] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const vorhanden =
    initial?.modus === "masskette" ? initial.wand_abschnitte_cm?.length ?? 0 : 0;

  const toSvg = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * VB, y: ((e.clientY - r.top) / r.height) * VB };
  };

  const edges = useMemo(() => {
    const n = points.length;
    if (n < 2) return [] as [Pt, Pt][];
    const out: [Pt, Pt][] = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) out.push([points[i], points[(i + 1) % n]]);
    return out;
  }, [points, closed]);

  const handleTap = (e: React.PointerEvent) => {
    const p = toSvg(e);
    if (closed) {
      if (!fensterModus) return;
      const ne = nearestEdge(p, edges);
      if (ne.d <= 8) setFenster((f) => [...f, { edge: ne.edge, t: ne.t, breite: "", hoehe: "" }]);
      return;
    }
    let c = p;
    if (points.length > 0) c = orthoSnap(points[points.length - 1], c);
    if (points.length >= 3 && dist(c, points[0]) <= CLOSE_DIST) {
      setClosed(true);
      setLengths(Array(points.length).fill(0));
      return;
    }
    c = { x: Math.max(4, Math.min(96, c.x)), y: Math.max(4, Math.min(96, c.y)) };
    setPoints((prev) => [...prev, c]);
  };

  const undo = () => {
    if (closed) {
      setClosed(false);
      setLengths([]);
      setFenster([]);
      setFensterModus(false);
      return;
    }
    setPoints((p) => p.slice(0, -1));
  };
  const reset = () => {
    setPoints([]);
    setClosed(false);
    setLengths([]);
    setFenster([]);
    setFensterModus(false);
    setActiveEdge(null);
  };

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
    return { umfang, flaeche_m2: Math.abs(area2) / 2 / 10000, ok: closeErr <= umfang * 0.03, terme: polygonToRects(poly) };
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
    if (error) {
      setSaving(false);
      toast.error(/geometrie/i.test(error.message) ? "DB-Spalte 'geometrie' fehlt – bitte Migration anwenden." : error.message);
      return;
    }
    const neue = fenster.filter((f) => !f.saved);
    let n = 0;
    for (const f of neue) {
      const { error: e2 } = await supabase.from("oeffnung").insert({
        raum_id: raumId,
        typ: "fenster",
        breite_cm: Number(f.breite) || null,
        hoehe_cm: Number(f.hoehe) || null,
        daten: {
          anzahl: 1,
          von_wandflaeche_abziehen: true,
          abdecken: false,
          silikon_entfernen: false,
          leibung_vorhanden: false,
          leibung_seiten: { links: true, oben: true, unten: true, rechts: false },
        },
      } as never);
      if (!e2) n++;
    }
    if (neue.length) setFenster((fs) => fs.map((f) => ({ ...f, saved: true })));
    setSaving(false);
    toast.success(n > 0 ? `Maßkette + ${n} Fenster übernommen` : "Maßkette übernommen");
  }

  const firstClosable = !closed && points.length >= 3;
  const setFensterVal = (i: number, key: "breite" | "hoehe", v: string) =>
    setFenster((fs) => fs.map((f, j) => (j === i ? { ...f, [key]: v, saved: false } : f)));

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-stone-muted)]">
        {!closed
          ? "Tippe die Ecken des Raums nacheinander an. Wände rasten waagerecht/senkrecht ein. Zum Schließen die erste Ecke antippen."
          : fensterModus
            ? "Tippe auf eine Wand, um dort ein Fenster zu markieren."
            : "Trage die Länge jeder Wand in cm ein. Fenster über den Button unten markieren."}
        {vorhanden > 0 && !closed && !points.length ? ` Bereits erfasst: ${vorhanden} Wandabschnitte.` : ""}
      </p>

      <div className="border border-[var(--color-hairline)] bg-[var(--color-paper)]">
        <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} className="w-full aspect-square touch-none select-none" onPointerDown={handleTap}>
          {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((g) => (
            <g key={g}>
              <line x1={g} y1={0} x2={g} y2={VB} stroke="var(--color-hairline)" strokeWidth={0.2} />
              <line x1={0} y1={g} x2={VB} y2={g} stroke="var(--color-hairline)" strokeWidth={0.2} />
            </g>
          ))}
          {closed && <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="var(--color-sand)" />}
          {edges.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={activeEdge === i ? "var(--color-brand)" : "var(--color-ink)"}
              strokeWidth={activeEdge === i ? 1.4 : 0.9} strokeLinecap="round" />
          ))}

          {/* Fenster: senkrechte Striche quer durch die Wand + Label B/H */}
          {closed && fenster.map((f, k) => {
            const [a, b] = edges[f.edge] ?? [{ x: 0, y: 0 }, { x: 0, y: 0 }];
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            const ux = dx / L, uy = dy / L; // entlang Wand
            const nx = -uy, ny = ux; // senkrecht
            const cx = a.x + f.t * dx, cy = a.y + f.t * dy;
            const bcm = Number(f.breite), wl = lengths[f.edge];
            const half = bcm > 0 && wl > 0 ? Math.min(0.46, bcm / 2 / wl) * L : 3;
            const tk = 2.6;
            const tick = (px: number, py: number) => (
              <line x1={px - nx * tk} y1={py - ny * tk} x2={px + nx * tk} y2={py + ny * tk} stroke="var(--color-ink)" strokeWidth={0.9} strokeLinecap="round" />
            );
            return (
              <g key={`f${k}`}>
                {tick(cx - ux * half, cy - uy * half)}
                {tick(cx + ux * half, cy + uy * half)}
                <text x={cx + nx * 6} y={cy + ny * 6} textAnchor="middle" fontSize={3.6}
                  fill="var(--color-stone-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {(f.breite || "?") + "/" + (f.hoehe || "?")}
                </text>
              </g>
            );
          })}

          {closed && edges.map(([a, b], i) => {
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={`l${i}`} onPointerDown={(e) => { e.stopPropagation(); if (!fensterModus) setActiveEdge(i); }}>
                <rect x={mx - 8} y={my - 3.4} width={16} height={6.8} rx={1.5} fill="var(--color-paper)" stroke="var(--color-hairline)" strokeWidth={0.3} />
                <text x={mx} y={my + 1.9} textAnchor="middle" fontSize={4} fill="var(--color-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {lengths[i] ? `${lengths[i]}` : "?"}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === 0 && firstClosable ? 2.4 : 1.6} fill={i === 0 && firstClosable ? "var(--color-brand)" : "var(--color-ink)"} />
          ))}
        </svg>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={undo} disabled={points.length === 0}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]">
          <Undo2 className="size-4" strokeWidth={1.75} />
          {closed ? "Öffnen" : "Ecke zurück"}
        </button>
        <button type="button" onClick={reset} disabled={points.length === 0}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]">
          <RotateCcw className="size-4" strokeWidth={1.75} />
          Zurücksetzen
        </button>
      </div>

      {closed && (
        <>
          <button type="button" onClick={() => setFensterModus((v) => !v)}
            className={`w-full min-h-[46px] border text-[14px] font-semibold uppercase tracking-[0.06em] ${
              fensterModus ? "border-[var(--color-brand)] bg-[var(--color-sand)] text-[var(--color-ink)]" : "border-[var(--color-hairline)] text-[var(--color-ink)]"
            }`}>
            {fensterModus ? "✓ Fenster markieren (aktiv) — Wand antippen" : "＋ Fenster einzeichnen"}
          </button>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Maßkette</span>
            {edges.map((_, i) => (
              <label key={i} className={`flex items-center gap-3 min-h-[52px] px-4 border bg-[var(--color-paper)] ${activeEdge === i ? "border-[var(--color-brand)]" : "border-[var(--color-hairline)]"}`}>
                <span className="text-[13px] w-16 text-[var(--color-stone-muted)]">Wand {i + 1}</span>
                <input type="number" inputMode="numeric" value={lengths[i] || ""} onFocus={() => setActiveEdge(i)}
                  onChange={(e) => setLengths((ls) => ls.map((l, j) => (j === i ? Number(e.target.value) : l)))}
                  placeholder="0" className="flex-1 bg-transparent text-[17px] tabular-nums outline-none" />
                <span className="text-[13px] text-[var(--color-stone-muted)]">cm</span>
              </label>
            ))}
          </div>

          {fenster.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Fenster (Breite × Höhe)</span>
              {fenster.map((f, i) => (
                <div key={i} className="flex items-center gap-2 min-h-[52px] px-3 border border-[var(--color-hairline)] bg-[var(--color-paper)]">
                  <span className="text-[13px] w-14 text-[var(--color-stone-muted)]">Wand {f.edge + 1}</span>
                  <input type="number" inputMode="numeric" value={f.breite} onChange={(e) => setFensterVal(i, "breite", e.target.value)}
                    placeholder="Breite" className="w-0 flex-1 bg-transparent text-[16px] tabular-nums outline-none" />
                  <span className="text-[13px] text-[var(--color-stone-muted)]">×</span>
                  <input type="number" inputMode="numeric" value={f.hoehe} onChange={(e) => setFensterVal(i, "hoehe", e.target.value)}
                    placeholder="Höhe" className="w-0 flex-1 bg-transparent text-[16px] tabular-nums outline-none" />
                  <span className="text-[13px] text-[var(--color-stone-muted)]">cm</span>
                  <button type="button" onClick={() => setFenster((fs) => fs.filter((_, j) => j !== i))} aria-label="Fenster entfernen" className="text-[var(--color-stone-muted)] hover:text-[var(--color-ink)]">
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {calc && (
        <div className="border border-[var(--color-hairline)] bg-[var(--color-sand)] p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-[15px]">Umfang (Wandabschnitte)</span>
            <span className="text-[17px] font-serif tabular-nums">{nf.format(calc.umfang / 100)} m</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[15px]">Bodenfläche</span>
            <span className="text-[20px] font-serif font-bold tabular-nums text-[var(--color-brand)]">{nf.format(calc.flaeche_m2)} m²</span>
          </div>
          {fenster.length > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-[15px]">Fenster</span>
              <span className="text-[15px] tabular-nums">{fenster.length}</span>
            </div>
          )}
          {!calc.ok && (
            <p className="text-[12px] text-[var(--color-stone-muted)] pt-1 border-t border-[var(--color-hairline)]">
              Hinweis: Die Maße schließen den Raum nicht ganz — bitte die Wandlängen prüfen.
            </p>
          )}
          <button type="button" onClick={uebernehmen} disabled={saving}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-[var(--color-ink)] text-[var(--color-paper)] text-[14px] font-semibold uppercase tracking-[0.06em] disabled:opacity-50">
            <Check className="size-4" strokeWidth={2} />
            {saving ? "Übernehme…" : "Als Maßkette übernehmen"}
          </button>
        </div>
      )}
    </div>
  );
}
