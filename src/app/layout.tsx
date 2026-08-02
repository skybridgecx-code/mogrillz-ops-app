import type { Metadata } from "next";

import "./globals.css";
import "../styles/primitives.css";
import "../styles/frontier-dashboard.css";

export const metadata: Metadata = {
  title: "Shama’s Kitchen Frontier Ops",
  description: "Exception-first operations workspace for Shama’s Kitchen orders, inventory, menu, customers, and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
