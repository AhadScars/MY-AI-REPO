"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./ui";
import { cn, initials } from "@/lib/utils";
import { api } from "@/lib/api-client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/interview/new", label: "New interview" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Progress" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-background">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-white p-5 md:flex md:flex-col">
          <Logo />
          <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium",
                    active ? "bg-slate-100 text-navy" : "text-slate-600 hover:bg-slate-50 hover:text-navy",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-white px-4 py-3 md:hidden">
            <Logo />
            <button
              className="rounded-lg border border-border px-3 py-1.5 text-sm"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Open menu"
            >
              Menu
            </button>
          </header>
          {open ? (
            <div className="border-b border-border bg-white px-4 py-3 md:hidden">
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-lg px-2 py-2 text-sm" onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <button onClick={logout} className="rounded-lg px-2 py-2 text-left text-sm text-slate-600">
                  Log out
                </button>
              </nav>
            </div>
          ) : null}
          <main id="main" className="flex-1 px-4 py-6 sm:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
