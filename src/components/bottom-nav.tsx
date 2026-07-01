import { Link } from "@tanstack/react-router";
import { FolderKanban, Settings } from "lucide-react";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-[var(--color-paper)] border-t border-[var(--color-hairline)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="relative">
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-3 min-h-16 cursor-pointer text-[var(--color-stone-muted)] uppercase tracking-[0.12em] transition-colors data-[status=active]:text-[var(--color-brand)]"
              activeOptions={{ exact: true }}
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className="absolute top-0 left-6 right-6 h-[2px] bg-[var(--color-brand)] transition-opacity"
                    style={{ opacity: isActive ? 1 : 0 }}
                  />
                  <Icon className="size-5" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
