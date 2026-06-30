import { Link } from "@tanstack/react-router";
import { FolderKanban, RefreshCw } from "lucide-react";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/sync", label: "Sync-Status", icon: RefreshCw },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-background border-t-2 border-foreground"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-2">
        {items.map(({ to, label, icon: Icon }, i) => (
          <li key={to} className={i === 0 ? "border-r-2 border-foreground" : ""}>
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-3 min-h-16 cursor-pointer text-foreground font-bold uppercase tracking-wide data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
              activeOptions={{ exact: true }}
            >
              <Icon className="size-7" strokeWidth={2.5} />
              <span className="text-xs">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
