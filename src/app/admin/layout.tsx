import LogoutButton from "./LogoutButton";
import MobileSidebar from "./MobileSidebar";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/attendance", label: "Mark Attendance" },
  { href: "/admin/infractions", label: "Infractions" },   // <-- add this line
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/deductions", label: "Deductions" },
  { href: "/admin/settings", label: "Penalty Settings" },
  { href: "/admin/approvals", label: "Approvals" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <MobileSidebar nav={NAV}>
        <LogoutButton />
      </MobileSidebar>
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}

