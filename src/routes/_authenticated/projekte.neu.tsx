import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projekte/neu")({
  head: () => ({ meta: [{ title: "Neuer Auftrag – Aufmaß-App" }] }),
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
    if (!form.kunde.trim() || !form.objekt_bezeichnung.trim()) {
      toast.error("Kunde und Objekt-Bezeichnung sind Pflicht");
      return;
    }
    mutation.mutate();
  }

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link
            to="/projekte"
            aria-label="Zurück"
            className="size-12 rounded-lg flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Neuer Auftrag</h1>
        </div>
      </header>

      <form onSubmit={onSubmit} className="px-5 py-5 space-y-4 pb-32">
        <Field id="kunde" label="Kunde *" value={form.kunde} onChange={set("kunde")} required />
        <Field id="adresse" label="Adresse" value={form.adresse} onChange={set("adresse")} />
        <Field
          id="objekt_bezeichnung"
          label="Objekt-Bezeichnung *"
          value={form.objekt_bezeichnung}
          onChange={set("objekt_bezeichnung")}
          required
        />
        <Field
          id="auftrag_nr"
          label="Auftrags-Nr."
          value={form.auftrag_nr}
          onChange={set("auftrag_nr")}
        />
        <Field
          id="verkaeufer"
          label="Verkäufer"
          value={form.verkaeufer}
          onChange={set("verkaeufer")}
        />
        <Field
          id="sachbearbeiter"
          label="Sachbearbeiter"
          value={form.sachbearbeiter}
          onChange={set("sachbearbeiter")}
        />

        <div className="space-y-2">
          <Label className="text-base font-semibold">Gewerk</Label>
          <div className="flex flex-wrap gap-2">
            {GEWERKE.map((g) => {
              const active = form.gewerk === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gewerk: active ? "" : g }))}
                  className={`min-h-12 px-4 rounded-xl border-2 text-base font-semibold ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="fixed left-0 right-0 bottom-16 px-5 py-3 bg-background border-t safe-bottom">
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full h-14 text-base font-bold"
          >
            {mutation.isPending ? "Speichere…" : "Auftrag speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete="off"
        className="h-14 text-base"
      />
    </div>
  );
}
