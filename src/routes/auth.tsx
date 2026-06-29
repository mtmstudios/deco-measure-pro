import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Ruler } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – Aufmaß-App" },
      { name: "description", content: "Anmeldung zur Aufmaß-App für Handwerker." },
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
            <Ruler className="size-9" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Aufmaß-App</h1>
          <p className="text-muted-foreground mt-1">Deco & More</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base font-semibold">E-Mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base font-semibold">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-lg"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-lg font-semibold"
          >
            {loading ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full mt-6 text-base text-primary font-medium underline-offset-4 hover:underline py-3"
        >
          {mode === "login" ? "Noch kein Konto? Registrieren" : "Bereits ein Konto? Anmelden"}
        </button>
      </div>
    </div>
  );
}
