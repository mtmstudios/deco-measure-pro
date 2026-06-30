import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <SideNav />
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
