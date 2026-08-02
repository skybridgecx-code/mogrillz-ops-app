import type { SVGProps } from "react";

import type { ViewKey } from "@/lib/dashboard/navigation";

export interface FrontierNavIconProps extends SVGProps<SVGSVGElement> {
  view: ViewKey;
}

export function FrontierNavIcon({ view, ...props }: FrontierNavIconProps) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    height: 20,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 20,
    ...props,
  };

  if (view === "today") {
    return (
      <svg {...common}>
        <path d="M4 13.5h6.5V20H4zM13.5 4H20v6.5h-6.5zM13.5 13.5H20V20h-6.5zM4 4h6.5v6.5H4z" />
      </svg>
    );
  }

  if (view === "orders") {
    return (
      <svg {...common}>
        <path d="M7 3.75h10a2 2 0 0 1 2 2v14.5l-3-1.75-4 1.75-4-1.75-3 1.75V5.75a2 2 0 0 1 2-2Z" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </svg>
    );
  }

  if (view === "inventory") {
    return (
      <svg {...common}>
        <path d="m4 7.5 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7.5v9l8 4 8-4v-9M12 11.5v9" />
      </svg>
    );
  }

  if (view === "menu") {
    return (
      <svg {...common}>
        <path d="M5 4v7M8 4v7M5 8h3M6.5 11v9M15 4c2.2 1.9 3.3 4 3.3 6.4 0 1.7-.9 2.8-2.3 2.8h-1V20" />
      </svg>
    );
  }

  if (view === "customers") {
    return (
      <svg {...common}>
        <path d="M16.5 20v-1.4a4.1 4.1 0 0 0-4.1-4.1H7.6a4.1 4.1 0 0 0-4.1 4.1V20" />
        <circle cx="10" cy="7.5" r="3.5" />
        <path d="M17 11.5a3 3 0 0 0 0-6M18.5 14.8a4 4 0 0 1 2 3.5V20" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      <path d="M2 19h20" />
    </svg>
  );
}
