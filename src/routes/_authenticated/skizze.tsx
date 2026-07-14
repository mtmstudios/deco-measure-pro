import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Undo2, RotateCcw } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/skizze")({
  head: () => ({ meta: [{ title: "Raum skizzieren · Aufmaß-App" }] }),
  component: SkizzePage,
});

type Pt = { x: number; y: number };

const VB = 100; // viewBox 0..100
const SNAP_DEG = 12; // Ortho-Snap-Toleranz
const CLOSE_DIST = 6; // Abstand zur ersten Ecke zum Schließen

const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Kandidat auf 0°/90° zur vorherigen Ecke einrasten. */
function orthoSnap(prev: Pt, c: Pt): Pt {
  const dx = c.x - prev.x;
  const dy = c.y - prev.y;
  if (dx === 0 && dy === 0) return c;
  const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
  if (angle <= SNAP_DEG) return { x: c.x, y: prev.y }; // horizontal
  if (angle >= 90 - SNAP_DEG) return { x: prev.x, y: c.y }; // vertikal
  return c;
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function SkizzePage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [closed, setClosed] = useState(false);
  const [lengths, setLengths] = useState<number[]>([]); // cm je Wand
  const [activeEdge, setActiveEdge] = useState<number | null>(null);

  const toSvg = (e: React.PointerEvent): Pt => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VB,
      y: ((e.clientY - r.top) / r.height) * VB,
    };
  };

  const handleTap = (e: React.PointerEvent) => {
    if (closed) return;
    let c = toSvg(e);
    if (points.length > 0) c = orthoSnap(points[points.length - 1], c);
    // Nahe erster Ecke → Polygon schließen
    if (points.length >= 3 && dist(c, points[0]) <= CLOSE_DIST) {
      setClosed(true);
      setLengths(Array(points.length).fill(0));
      return;
    }
    // Clamp in den Zeichenbereich
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

  // Kanten (nur bei geschlossenem Polygon vollständig, sonst offene Kette)
  const edges = useMemo(() => {
    const n = points.length;
    if (n < 2) return [] as [Pt, Pt][];
    const out: [Pt, Pt][] = [];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) out.push([points[i], points[(i + 1) % n]]);
    return out;
  }, [points, closed]);

  // Reale Koordinaten aus gezeichneten Richtungen × eingegebenen Längen → Fläche/Umfang
  const calc = useMemo(() => {
    if (!closed || lengths.length !== edges.length || lengths.some((l) => !l || l <= 0)) {
      return null;
    }
    const coords: Pt[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      let ux = dx / len;
      let uy = dy / len;
      // Nahezu waagerechte/senkrechte Wände auf die reine Achse einrasten
      // (rechtwinklige Räume ergeben so exakte Flächen).
      const ang = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      if (ang <= 15) { ux = Math.sign(dx) || 1; uy = 0; }
      else if (ang >= 75) { ux = 0; uy = Math.sign(dy) || 1; }
      const cm = lengths[i];
      coords.push({ x: coords[i].x + ux * cm, y: coords[i].y + uy * cm });
    }
    const umfang = lengths.reduce((a, b) => a + b, 0);
    // Schließfehler (letzter Punkt sollte ~ Start sein)
    const closeErr = dist(coords[coords.length - 1], coords[0]);
    // Shoelace auf die realen Koordinaten (ohne den doppelten Endpunkt)
    let area2 = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      area2 += coords[i].x * coords[i + 1].y - coords[i + 1].x * coords[i].y;
    }
    const flaeche_m2 = Math.abs(area2) / 2 / 10000;
    return { umfang, flaeche_m2, closeErr, ok: closeErr <= umfang * 0.03 };
  }, [closed, lengths, edges]);

  const firstClosable =
    !closed && points.length >= 3;

  return (
    <>
      <ScreenHeader backTo="/projekte" eyebrow="Aufmaß" title="Raum skizzieren" />
      <div className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-6 space-y-5">
        <p className="text-[13px] text-[var(--color-stone-muted)]">
          {closed
            ? "Trage unten die Länge jeder Wand in cm ein — das ist die Maßkette."
            : "Tippe die Ecken des Raums nacheinander an. Wände rasten waagerecht/senkrecht ein. Zum Schließen die erste Ecke antippen."}
        </p>

        {/* Zeichenfläche */}
        <div className="border border-[var(--color-hairline)] bg-[var(--color-paper)]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB} ${VB}`}
            className="w-full aspect-square touch-none select-none"
            onPointerDown={handleTap}
          >
            {/* Raster */}
            {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((g) => (
              <g key={g}>
                <line x1={g} y1={0} x2={g} y2={VB} stroke="var(--color-hairline)" strokeWidth={0.2} />
                <line x1={0} y1={g} x2={VB} y2={g} stroke="var(--color-hairline)" strokeWidth={0.2} />
              </g>
            ))}

            {/* Fläche */}
            {closed && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="var(--color-sand)"
                stroke="none"
              />
            )}

            {/* Wände */}
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

            {/* Maß-Labels je Wand */}
            {closed &&
              edges.map(([a, b], i) => {
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const val = lengths[i];
                return (
                  <g key={`l${i}`} onPointerDown={(e) => { e.stopPropagation(); setActiveEdge(i); }}>
                    <rect x={mx - 8} y={my - 3.4} width={16} height={6.8} rx={1.5}
                      fill="var(--color-paper)" stroke="var(--color-hairline)" strokeWidth={0.3} />
                    <text x={mx} y={my + 1.9} textAnchor="middle" fontSize={4}
                      fill="var(--color-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {val ? `${val}` : "?"}
                    </text>
                  </g>
                );
              })}

            {/* Ecken */}
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

        {/* Aktionen */}
        <div className="flex gap-3">
          <button
            onClick={undo}
            disabled={points.length === 0}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]"
          >
            <Undo2 className="size-4" strokeWidth={1.75} />
            {closed ? "Öffnen" : "Ecke zurück"}
          </button>
          <button
            onClick={reset}
            disabled={points.length === 0}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 border border-[var(--color-hairline)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink)] disabled:opacity-40 hover:border-[var(--color-brand)]"
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
            Zurücksetzen
          </button>
        </div>

        {/* Maßkette */}
        {closed && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Maßkette
            </h2>
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
                  onChange={(e) =>
                    setLengths((ls) => ls.map((l, j) => (j === i ? Number(e.target.value) : l)))
                  }
                  placeholder="0"
                  className="flex-1 bg-transparent text-[17px] tabular-nums outline-none"
                />
                <span className="text-[13px] text-[var(--color-stone-muted)]">cm</span>
              </label>
            ))}
          </section>
        )}

        {/* Zusammenfassung */}
        {calc && (
          <section className="border border-[var(--color-hairline)] bg-[var(--color-sand)] p-5 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[15px]">Umfang (Wandabschnitte)</span>
              <span className="text-[17px] font-serif tabular-nums">{nf.format(calc.umfang / 100)} m</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[15px]">Bodenfläche</span>
              <span className="text-[22px] font-serif font-bold tabular-nums text-[var(--color-brand)]">
                {nf.format(calc.flaeche_m2)} m²
              </span>
            </div>
            {!calc.ok && (
              <p className="text-[12px] text-[var(--color-stone-muted)] pt-1 border-t border-[var(--color-hairline)]">
                Hinweis: Die Maße schließen den Raum nicht ganz — bitte die Wandlängen prüfen.
              </p>
            )}
          </section>
        )}

        <p className="text-[12px] text-[var(--color-stone-muted)]">
          Die Wandlängen bilden die Maßkette; Umriss und Maße lassen sich später als Raum-Geometrie
          übernehmen (Wandabschnitte + Bodenfläche) und fließen in den Raumlevel-Export.
        </p>
      </div>
    </>
  );
}
