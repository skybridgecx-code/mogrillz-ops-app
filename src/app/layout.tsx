import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoGrillz Ops",
  description: "Overview-first operator dashboard for MoGrillz inventory, orders, analytics, and AI guidance.",
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
