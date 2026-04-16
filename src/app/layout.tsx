import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shama’s Kitchen Ops",
  description: "Overview-first operator dashboard for Shama’s Kitchen inventory, orders, analytics, and AI guidance.",
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
