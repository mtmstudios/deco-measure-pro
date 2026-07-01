import { Link } from "@tanstack/react-router";
import { FolderKanban, Settings } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

export function SideNav() {
  return (
    <aside className="hidden md:flex md:flex-col w-[220px] shrink-0 border-r border-[var(--color-hairline)] bg-[var(--color-paper)] sticky top-0 h-screen">
      <Link to="/projekte" className="flex items-center justify-center h-16 border-b border-[var(--color-hairline)]">
        <AppLogo height={28} />
      </Link>
      <ul className="flex-1 py-6 px-3 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 px-4 h-11 text-[13px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] data-[status=active]:text-[var(--color-brand)] data-[status=active]:bg-[var(--color-sand)] rounded-[2px]"
            >
              <Icon className="size-4" strokeWidth={1.5} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
