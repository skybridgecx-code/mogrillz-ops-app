import type { Metadata } from "next";

import "./globals.css";
import "../styles/accessibility.css";
import "../styles/primitives.css";
import "../styles/frontier-dashboard.css";
import "../styles/frontier-orders.css";

export const metadata: Metadata = {
  title: "Shama’s Kitchen Frontier Ops",
  description: "Exception-first operations workspace for Shama’s Kitchen orders, inventory, menu, customers, and reporting.",
};

const legacyViewCompatibilityStyles = `
.frontier-view:not(.frontier-view--today) {
  --bg: var(--fo-color-canvas);
  --bg-raised: var(--fo-color-surface-muted);
  --surface: var(--fo-color-surface);
  --surface-2: var(--fo-color-surface-raised);
  --surface-3: var(--fo-color-surface-muted);
  --line: var(--fo-color-border);
  --line-strong: var(--fo-color-border-strong);
  --ink: var(--fo-color-ink);
  --ink-soft: var(--fo-color-ink-muted);
  --ink-faint: var(--fo-color-ink-subtle);
  --gold: var(--fo-color-primary);
  --gold-soft: var(--fo-color-primary-soft);
  --ember: var(--fo-color-primary-hover);
  --ember-soft: #f8dfd5;
  --green: var(--fo-status-ready);
  --green-soft: var(--fo-status-ready-soft);
  --red: var(--fo-status-blocked);
  --red-soft: var(--fo-status-blocked-soft);
  --blue: #356f9f;
  --blue-soft: #e8f1f8;
  --radius-lg: var(--fo-radius-lg);
  --radius-md: var(--fo-radius-md);
  --radius-sm: var(--fo-radius-sm);
  --shadow-1: var(--fo-shadow-xs);
  --shadow-2: var(--fo-shadow-md);
}

.frontier-view:not(.frontier-view--today) .board-col {
  background: var(--fo-color-surface-muted);
}

.frontier-view:not(.frontier-view--today) .stock-bar,
.frontier-view:not(.frontier-view--today) .bar-track {
  background: var(--fo-color-divider);
}

.frontier-view:not(.frontier-view--today) .input,
.frontier-view:not(.frontier-view--today) .textarea,
.frontier-view:not(.frontier-view--today) .selectbox,
.frontier-view:not(.frontier-view--today) .menu-image-dropzone {
  background: var(--fo-color-surface-raised);
}

.frontier-view:not(.frontier-view--today) .menu-image-dropzone {
  border-color: var(--fo-color-border-strong);
}

.frontier-view:not(.frontier-view--today) .menu-image-empty small {
  color: var(--fo-color-ink-subtle);
}

.frontier-view:not(.frontier-view--today) .btn-primary {
  border-color: var(--fo-color-primary);
  background: var(--fo-color-primary);
  color: var(--fo-color-primary-ink);
}

.frontier-view:not(.frontier-view--today) .btn-primary:hover {
  border-color: var(--fo-color-primary-hover);
  background: var(--fo-color-primary-hover);
}

.frontier-view:not(.frontier-view--today) .btn-ghost:hover {
  background: var(--fo-color-surface-muted);
}

.command-insight .section-header {
  align-items: flex-start;
  flex-direction: column;
  gap: var(--fo-space-3);
}

.command-insight .section-header__content {
  width: 100%;
  max-width: 100%;
}

.command-insight .section-header__action {
  align-self: flex-start;
}

.command-insight .section-header__title {
  overflow-wrap: anywhere;
}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style data-frontier-legacy-compat>{legacyViewCompatibilityStyles}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
