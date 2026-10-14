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
  const [username, setUsername] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUsername(data?.username ?? null);
        setRoleLabel(data ? ROLE_LABEL[data.role] ?? data.role : null);
        setDepartmentName(data?.departmentName ?? null);
      })
      .catch(() => {
        setUsername(null);
        setRoleLabel(null);
        setDepartmentName(null);
      });
  }, []);

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3.5 px-4 sticky top-0 z-30 shadow-2xs">
        <div>
          <h2 className="font-bold text-base text-gray-900">Attendance Admin</h2>
          {username && <p className="text-xs font-bold text-brand">{username}</p>}
          {roleLabel && (
            <p className="text-[11px] text-gray-500">
              {roleLabel}
              {departmentName ? ` · ${departmentName}` : ""}
            </p>
          )}
        </div>
        <button
          className="btn-secondary !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1.5"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? "✕" : "☰"}</span>
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky inset-y-0 md:inset-y-auto left-0 md:top-0 z-50 w-64 shrink-0 h-full md:h-screen md:overflow-y-auto overscroll-contain bg-white border-r border-gray-200 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] px-5 flex flex-col transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900">Attendance Admin</h2>
            {username && <p className="text-sm font-bold text-brand">{username}</p>}
            {roleLabel && (
              <p className="text-xs text-gray-500">
                {roleLabel}
                {departmentName ? ` · ${departmentName}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-lg leading-none"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const isActive =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand text-white shadow-xs"
                    : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-3 border-t border-gray-100 shrink-0">
          {children}
        </div>
      </aside>
    </>
  );
}
