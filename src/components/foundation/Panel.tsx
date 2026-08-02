import { createElement, type HTMLAttributes, type ReactNode } from "react";

type PanelElement = "article" | "aside" | "div" | "section";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  as?: PanelElement;
  children: ReactNode;
}

export function Panel({
  as = "section",
  children,
  className,
  ...props
}: PanelProps) {
  const classes = ["surface-panel", className].filter(Boolean).join(" ");

  return createElement(as, { ...props, className: classes }, children);
}
