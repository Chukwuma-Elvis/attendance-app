"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Manager",
  ASSISTANT: "Assistant",
};

export default function MobileSidebar({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRoleLabel(data ? ROLE_LABEL[data.role] ?? data.role : null))
      .catch(() => setRoleLabel(null));
  }, []);

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div>
          <h2 className="font-bold text-lg">Attendance Admin</h2>
          {roleLabel && <p className="text-xs text-gray-500">Logged in as {roleLabel}</p>}
        </div>
        <button
          className="btn-secondary"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-60 shrink-0 bg-white border-r border-gray-200 p-5 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 hidden md:block">
          <h2 className="font-bold text-lg">Attendance Admin</h2>
          {roleLabel && <p className="text-xs text-gray-500">Logged in as {roleLabel}</p>}
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => {
            const isActive =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  isActive ? "bg-brand text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </aside>
    </>
  );
}
