"use client";

import { useEffect, useId, type ReactNode } from "react";

export function Sheet({
  title,
  onClose,
  children,
  headerExtra,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div aria-hidden="true" className="sheet-backdrop" onClick={onClose} />
      <aside aria-labelledby={titleId} aria-modal="true" className="sheet" role="dialog">
        <div className="sheet-head">
          <h2 className="sheet-title" id={titleId}>{title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {headerExtra}
            <button aria-label="Close details" className="sheet-close" onClick={onClose} type="button">
              ×
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </aside>
    </>
  );
}
