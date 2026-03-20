import type { ReactNode } from "react";
import type { DashboardSnapshot } from "@/types/domain";

interface OverviewKpiGridProps {
  kpis: DashboardSnapshot["kpis"];
  children?: ReactNode;
}

export function OverviewKpiGrid({
  kpis,
  children,
}: OverviewKpiGridProps) {
  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => (
        <article className="card kpi-card" key={kpi.label}>
          <div className="kpi-label">{kpi.label}</div>
          <div className="kpi-value">{kpi.value}</div>
          <div className="kpi-delta">{kpi.delta}</div>
        </article>
      ))}
      {children}
    </div>
  );
}
