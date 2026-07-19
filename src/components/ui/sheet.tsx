"use client";

import { useEffect, type ReactNode } from "react";

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
      <div className="sheet-backdrop" onClick={onClose} />
      <aside aria-label={title} className="sheet" role="dialog">
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {headerExtra}
            <button aria-label="Close" className="sheet-close" onClick={onClose} type="button">
              ✕
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </aside>
    </>
  );
}
