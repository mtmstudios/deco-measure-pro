import { Link } from "@tanstack/react-router";
import { FolderKanban, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/app-logo";

const items = [
  { to: "/projekte", label: "Projekte", icon: FolderKanban },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

const STORAGE_KEY = "myr.sideNav.collapsed";

export function SideNav() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <aside
      className="hidden md:flex md:flex-col shrink-0 border-r border-[var(--color-hairline)] bg-[var(--color-paper)] sticky top-0 h-screen transition-[width] duration-300 ease-out"
      style={{ width: collapsed ? 64 : 220 }}
    >
      <Link
        to="/projekte"
        aria-label="Zur Projektliste"
        className="flex items-center justify-center h-16 border-b border-[var(--color-hairline)] shrink-0"
      >
        {collapsed ? <AppLogo height={22} /> : <AppLogo height={28} />}
      </Link>

      <ul className="flex-1 py-6 px-2 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: true }}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} h-11 text-[13px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] data-[status=active]:text-[var(--color-brand)] data-[status=active]:bg-[var(--color-sand)] rounded-[2px]`}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--color-hairline)] p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Seitenleiste einblenden" : "Seitenleiste einklappen"}
          aria-pressed={collapsed}
          title={collapsed ? "Einblenden" : "Einklappen"}
          className={`w-full flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-4"} h-11 text-[12px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-sand)] rounded-[2px] transition-colors`}
        >
          {collapsed ? (
            <PanelLeft className="size-4 shrink-0" strokeWidth={1.5} />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" strokeWidth={1.5} />
              <span>Einklappen</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
