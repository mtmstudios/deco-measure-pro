import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLogo } from "@/components/app-logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden · Aufmaß-App" },
      { name: "description", content: "Anmeldung zur Aufmaß-App für Innenausstatter." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/projekte" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/projekte", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/projekte` },
        });
        if (error) throw error;
        toast.success("Konto erstellt. Du bist angemeldet.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-[var(--color-paper)]">
      <div className="w-full max-w-[400px] myr-rise">
        <div className="flex flex-col items-center">
          <AppLogo variant="full" className="!h-[68px] md:!h-[88px] w-auto" />
          <p className="mt-2 text-[12px] md:text-[13px] uppercase tracking-[0.14em] text-[var(--color-stone-muted)] font-medium">
            Aufmaß-App
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <Field
            id="email"
            label="E-Mail"
            type="email"
            value={email}
            inputMode="email"
            autoComplete="email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            id="password"
            label="Passwort"
            type="password"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] mt-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium px-7 transition-colors disabled:opacity-60"
          >
            {loading ? "Bitte warten…" : mode === "login" ? "Anmelden →" : "Konto erstellen →"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="link-quiet text-[14px]"
          >
            {mode === "login" ? "Noch kein Konto? Registrieren" : "Bereits ein Konto? Anmelden"}
          </button>
        </div>
      </div>
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
        {...rest}
        className="min-h-[52px] px-4 text-[17px] bg-[var(--color-paper)] border border-[var(--color-hairline)] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none transition-colors"
      />
    </div>
  );
}
