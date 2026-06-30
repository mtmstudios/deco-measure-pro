import { Link } from "@tanstack/react-router";
import { FolderKanban, RefreshCw } from "lucide-react";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/sync", label: "Sync-Status", icon: RefreshCw },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-3 min-h-16 cursor-pointer text-muted-foreground uppercase tracking-[0.08em] transition-colors data-[status=active]:text-foreground data-[status=active]:font-semibold"
              activeOptions={{ exact: true }}
            >
              <Icon className="size-6" strokeWidth={1.75} />
              <span className="text-[11px]">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
