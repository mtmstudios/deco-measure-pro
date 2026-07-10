import { Link } from "@tanstack/react-router";
import { FolderKanban, Settings, PanelLeftClose, PanelLeft, Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLogo } from "@/components/app-logo";

type NavItem = { to: string; label: string; icon: typeof FolderKanban };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Aufmaß",
    items: [{ to: "/projekte", label: "Projekte", icon: FolderKanban }],
  },
  {
    label: "Angebot",
    items: [{ to: "/konfigurator", label: "Konfigurator", icon: Calculator }],
  },
];

const bottomItems: NavItem[] = [
  { to: "/einstellungen", label: "Einstellungen", icon: Settings },
];

const STORAGE_KEY = "myr.sideNav.collapsed";

export function SideNav() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      root.style.setProperty(
        "--side-nav-width",
        isDesktop ? (collapsed ? "64px" : "220px") : "0px",
      );
    };
    apply();
    const mql = window.matchMedia("(min-width: 768px)");
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [collapsed]);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  const renderItem = ({ to, label, icon: Icon }: NavItem) => (
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
  );

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

      <nav className="flex-1 overflow-y-auto py-6 px-2 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <div className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-stone-muted)]">
                {group.label}
              </div>
            ) : (
              <div
                aria-hidden
                className="mx-3 mb-2 h-px bg-[var(--color-hairline)]"
              />
            )}
            <ul className="space-y-1">{group.items.map(renderItem)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-hairline)] px-2 py-2 space-y-1">
        <ul className="space-y-1">{bottomItems.map(renderItem)}</ul>
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

// Suppress unused-import lint for Ruler if ever needed later.
export const _Ruler = Ruler;
