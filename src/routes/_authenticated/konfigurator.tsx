import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { NumberInput } from "@/components/number-input";
import { berechnePreis } from "@/lib/preis-engine";
import { MHZ_PRODUKTE } from "@/lib/preis-data";

export const Route = createFileRoute("/_authenticated/konfigurator")({
  head: () => ({ meta: [{ title: "Sonnenschutz-Konfigurator · Aufmaß-App" }] }),
  component: KonfiguratorPage,
});

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function KonfiguratorPage() {
  const [produktIdx, setProduktIdx] = useState(0);
  const produkt = MHZ_PRODUKTE[produktIdx];
  const [preisgruppe, setPreisgruppe] = useState(MHZ_PRODUKTE[0].preisgruppen[0].code);
  const [breite, setBreite] = useState<number>(100);
  const [hoehe, setHoehe] = useState<number>(140);
  const [zuschlaege, setZuschlaege] = useState<string[]>([]);

  // Beim Produktwechsel Preisgruppe + Zuschläge zurücksetzen
  // (Plissee-Codes wie "PGA" existieren bei Duette nicht).
  const wechsleProdukt = (idx: number) => {
    setProduktIdx(idx);
    setPreisgruppe(MHZ_PRODUKTE[idx].preisgruppen[0].code);
    setZuschlaege([]);
  };

  const ergebnis = useMemo(() => {
    try {
      return berechnePreis(produkt, {
        preisgruppe,
        breite_cm: Number.isFinite(breite) ? breite : 0,
        hoehe_cm: Number.isFinite(hoehe) ? hoehe : 0,
        zuschlaege,
      });
    } catch {
      return null;
    }
  }, [produkt, preisgruppe, breite, hoehe, zuschlaege]);

  const toggleZuschlag = (code: string) => {
    setZuschlaege((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  return (
    <>
      <ScreenHeader
        backTo="/projekte"
        eyebrow="Preis-Engine"
        title="Sonnenschutz-Konfigurator"
      />
      <div className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <section>
          <p className="text-[13px] text-[var(--color-stone-muted)]">
            {produkt.hersteller} {produkt.modell} · {produkt.preisbasis}
          </p>
        </section>

        <section className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Produkt
            </span>
            <select
              value={produktIdx}
              onChange={(e) => wechsleProdukt(Number(e.target.value))}
              className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
            >
              {MHZ_PRODUKTE.map((p, i) => (
                <option key={i} value={i}>
                  {p.produkt} · {p.modell}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Stoffgruppe
            </span>
            <select
              value={preisgruppe}
              onChange={(e) => setPreisgruppe(e.target.value)}
              className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
            >
              {produkt.preisgruppen.map((pg) => (
                <option key={pg.code} value={pg.code}>
                  {pg.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Breite"
              suffix="cm"
              value={Number.isFinite(breite) ? breite : ""}
              onChange={(e) => setBreite(Number(e.target.value.replace(",", ".")))}
            />
            <NumberInput
              label="Höhe"
              suffix="cm"
              value={Number.isFinite(hoehe) ? hoehe : ""}
              onChange={(e) => setHoehe(Number(e.target.value.replace(",", ".")))}
            />
          </div>

          {produkt.zuschlaege && produkt.zuschlaege.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                Zuschläge
              </legend>
              <div className="space-y-2">
                {produkt.zuschlaege.map((z) => {
                  const checked = zuschlaege.includes(z.code);
                  return (
                    <label
                      key={z.code}
                      className="flex items-center gap-3 min-h-[52px] px-4 border border-[var(--color-hairline)] bg-[var(--color-paper)] cursor-pointer hover:border-[var(--color-brand)]"
                    >
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--color-brand)]"
                        checked={checked}
                        onChange={() => toggleZuschlag(z.code)}
                      />
                      <span className="flex-1 text-[15px]">{z.name}</span>
                      <span className="text-[13px] tabular-nums text-[var(--color-stone-muted)]">
                        {z.typ === "fix"
                          ? eur.format(z.wert)
                          : z.typ === "prozent"
                            ? `${z.wert} %`
                            : `${eur.format(z.wert)}/m²`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </section>

        {ergebnis && (
          <section className="border border-[var(--color-hairline)] bg-[var(--color-sand)] p-5 space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] text-[var(--color-stone-muted)]">
                Verwendetes Raster
              </span>
              <span className="text-[15px] font-serif tabular-nums">
                {ergebnis.raster.breite_cm} × {ergebnis.raster.hoehe_cm} cm
              </span>
            </div>

            {ergebnis.lieferbar ? (
              <>
                <div className="flex justify-between items-baseline">
                  <span className="text-[15px]">Grundpreis</span>
                  <span className="text-[17px] font-serif tabular-nums">
                    {eur.format(ergebnis.grundpreis)}
                  </span>
                </div>

                {ergebnis.zuschlaege.map((z, i) => (
                  <div key={i} className="flex justify-between items-baseline">
                    <span className="text-[15px]">{z.name}</span>
                    <span className="text-[15px] tabular-nums">
                      + {eur.format(z.betrag)}
                    </span>
                  </div>
                ))}

                <div className="pt-3 border-t border-[var(--color-hairline)] flex justify-between items-baseline">
                  <span className="text-[17px] font-bold">Gesamt</span>
                  <span className="text-[26px] font-serif font-bold tabular-nums text-[var(--color-brand)]">
                    {eur.format(ergebnis.gesamt)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 p-4 border border-[var(--color-hairline)] bg-[var(--color-paper)]">
                <AlertTriangle
                  className="size-5 shrink-0 text-[var(--color-ink)] mt-0.5"
                  strokeWidth={1.75}
                />
                <div>
                  <div className="text-[17px] font-bold">Nicht lieferbar</div>
                  {ergebnis.hinweise.length > 0 && (
                    <div className="text-[13px] text-[var(--color-stone-muted)] mt-1">
                      {ergebnis.hinweise.join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {ergebnis.lieferbar && ergebnis.hinweise.length > 0 && (
              <div className="flex items-start gap-2 pt-2 text-[13px] text-[var(--color-stone-muted)]">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>{ergebnis.hinweise.join(" · ")}</div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
