import { Link } from "@tanstack/react-router";
import { FolderKanban, RefreshCw } from "lucide-react";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/sync", label: "Sync-Status", icon: RefreshCw },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-background border-t"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-3 min-h-16 text-muted-foreground data-[status=active]:text-primary data-[status=active]:font-semibold"
              activeOptions={{ exact: true }}
            >
              <Icon className="size-7" strokeWidth={2.25} />
              <span className="text-xs">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
