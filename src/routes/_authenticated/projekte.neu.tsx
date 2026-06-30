import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/projekte/neu")({
  head: () => ({ meta: [{ title: "Neuer Auftrag · Aufmaß-App" }] }),
  component: NeuerAuftrag,
});

const GEWERKE = ["Bodenleger", "Maler", "Tapezierer", "Sonnenschutz", "Polsterei"];

function NeuerAuftrag() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    kunde: "",
    adresse: "",
    objekt_bezeichnung: "",
    auftrag_nr: "",
    verkaeufer: "",
    sachbearbeiter: "",
    gewerk: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validForm = form.kunde.trim() && form.objekt_bezeichnung.trim();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Nicht angemeldet");
      const { data: profile, error: pErr } = await supabase
        .from("benutzer" as never)
        .select("betrieb_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (pErr) throw pErr;
      const betrieb_id = (profile as { betrieb_id?: string } | null)?.betrieb_id;
      if (!betrieb_id) throw new Error("Kein Betrieb für diesen Nutzer gefunden");

      const { data, error } = await supabase
        .from("projekt" as never)
        .insert({
          betrieb_id,
          kunde: form.kunde.trim(),
          adresse: form.adresse.trim() || null,
          objekt_bezeichnung: form.objekt_bezeichnung.trim(),
          auftrag_nr: form.auftrag_nr.trim() || null,
          verkaeufer: form.verkaeufer.trim() || null,
          sachbearbeiter: form.sachbearbeiter.trim() || null,
          gewerk: form.gewerk.trim() || null,
          status: "erfassung",
          created_by: u.user.id,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projekte"] });
      toast.success("Projekt angelegt");
      navigate({ to: "/projekt/$id", params: { id: p.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validForm) {
      toast.error("Kunde und Objekt-Bezeichnung sind Pflicht");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="myr-rise">
      <ScreenHeader
        backTo="/projekte"
        title="Neuer Auftrag"
        eyebrow="Auftragsdaten"
        right={
          <button
            form="auftrag-form"
            type="submit"
            disabled={!validForm || mutation.isPending}
            className="hidden md:inline-flex items-center gap-2 h-11 px-5 bg-[var(--color-brand)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[12px] font-medium disabled:opacity-50 hover:bg-[var(--color-brand-hover)]"
          >
            {mutation.isPending ? "Speichere…" : "Speichern →"}
          </button>
        }
      />

      <form id="auftrag-form" onSubmit={onSubmit} className="mx-auto max-w-[560px] px-4 md:px-6 pt-2 pb-36 space-y-5">
        <Field id="kunde" label="Kunde *" value={form.kunde} onChange={set("kunde")} required />
        <Field id="adresse" label="Adresse" value={form.adresse} onChange={set("adresse")} />
        <Field
          id="objekt_bezeichnung"
          label="Objekt-Bezeichnung *"
          value={form.objekt_bezeichnung}
          onChange={set("objekt_bezeichnung")}
          required
        />
        <Field id="auftrag_nr" label="Auftrags-Nr." value={form.auftrag_nr} onChange={set("auftrag_nr")} />
        <Field id="verkaeufer" label="Verkäufer" value={form.verkaeufer} onChange={set("verkaeufer")} />
        <Field id="sachbearbeiter" label="Sachbearbeiter" value={form.sachbearbeiter} onChange={set("sachbearbeiter")} />

        <div className="pt-2">
          <p className="text-[13px] font-medium text-[var(--color-stone-muted)] mb-2">Gewerk</p>
          <div className="flex flex-wrap gap-2">
            {GEWERKE.map((g) => {
              const active = form.gewerk === g;
              return (
                <button
                  key={g}
                  type="button"
                  data-active={active}
                  onClick={() => setForm((f) => ({ ...f, gewerk: active ? "" : g }))}
                  className="pill"
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="md:hidden fixed left-0 right-0 bottom-16 px-4 py-3 bg-[var(--color-paper)] border-t border-[var(--color-hairline)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="submit"
            disabled={!validForm || mutation.isPending}
            className="w-full min-h-[52px] bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "Speichere…" : "Auftrag speichern →"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--color-stone-muted)]">
        {label}
      </label>
      <input
        id={id}
        autoComplete="off"
        {...rest}
        className="min-h-[52px] px-4 text-[17px] bg-[var(--color-paper)] border border-[var(--color-hairline)] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
      />
    </div>
  );
}
