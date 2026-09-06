import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attendance & Deductions",
  description: "Employee attendance tracking and deductions dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
