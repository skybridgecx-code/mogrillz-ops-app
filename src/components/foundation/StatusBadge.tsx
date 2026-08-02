import type { HTMLAttributes, ReactNode } from "react";

export type StatusBadgeStatus = "ready" | "review" | "blocked" | "neutral";

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  children: ReactNode;
  status?: StatusBadgeStatus;
}

export function StatusBadge({
  children,
  className,
  status = "neutral",
  ...props
}: StatusBadgeProps) {
  const classes = ["status-badge", `status-badge--${status}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} data-status={status} {...props}>
      {children}
    </span>
  );
}
