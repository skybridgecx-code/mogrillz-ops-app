import type { Order } from "@/types/domain";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function timeAgo(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";

  const diffSeconds = Math.max(0, Math.round((now - then) / 1000));
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

export function summarizeItems(order: Order) {
  if (!order.items.length) return "No line items recorded";
  return order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");
}

export function isActiveOrder(order: Order) {
  return order.status !== "Picked Up" && order.status !== "Cancelled";
}

export type Tone = "success" | "warning" | "danger" | "info" | "ember" | "";

export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (
    s.includes("picked up") || s.includes("completed") || s.includes("healthy") ||
    s.includes("live") || s.includes("vip") || s.includes("active")
  ) {
    return "success";
  }
  if (s.includes("ready")) return "ember";
  if (s.includes("new")) return "info";
  if (s.includes("prep") || s.includes("watch") || s.includes("rising") || s.includes("open")) {
    return "warning";
  }
  if (s.includes("low") || s.includes("out") || s.includes("paused") || s.includes("cancel")) {
    return "danger";
  }
  return "";
}
