import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";
import MobileSidebar from "./MobileSidebar";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/attendance", label: "Mark Attendance" },
  { href: "/admin/month-summary", label: "Month Summary" },
  { href: "/admin/infractions", label: "Infractions" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/deductions", label: "Deductions" },
  { href: "/admin/settings", label: "Venue & Settings" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/check-in", label: "📱 Self Check-In" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:flex">
      <MobileSidebar nav={NAV}>
        <LogoutButton />
      </MobileSidebar>
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}

