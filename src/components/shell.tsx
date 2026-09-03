"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Actor } from "@/lib/types";
import type { NavItem } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/types";
import { logoutAction } from "@/app/actions";

import { TenantSwitcher } from "./org-ui";

export function AppShell({
  actor,
  nav,
  tenants,
  children,
}: {
  actor: Actor;
  nav: NavItem[];
  tenants?: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = [...new Set(nav.map((n) => n.group))];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside
        className={`${open ? "block" : "hidden"} lg:block fixed lg:static z-30 inset-y-0 left-0 w-[272px] bg-[var(--kampus-950)] text-white overflow-y-auto`}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70">Kampüs OS</div>
          <div className="text-lg font-semibold mt-1 tracking-tight">KampüsTakip</div>
          <p className="text-[11px] text-white/45 mt-1">K12NET’ten daha tam, daha sade</p>
        </div>
        <nav className="px-3 py-4 space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="px-2 pb-1 text-[11px] uppercase tracking-wider text-white/35">{g}</div>
              <div className="space-y-0.5">
                {nav
                  .filter((n) => n.group === g)
                  .map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block rounded-xl px-3 py-2 text-sm ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3">
          <button className="lg:hidden btn btn-ghost" onClick={() => setOpen((v) => !v)} type="button">
            Menü
          </button>
          <div className="text-sm text-slate-600 truncate">
            {actor.name} · {ROLE_LABELS[actor.role]}
          </div>
          {actor.role === "PLATFORM_SUPER_ADMIN" && tenants ? (
            <TenantSwitcher tenants={tenants} currentId={actor.tenantId} />
          ) : null}
          <form action={logoutAction}>
            <button className="btn btn-ghost" type="submit">
              Çıkış
            </button>
          </form>
        </header>
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-slate-600 mt-1 text-sm max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
