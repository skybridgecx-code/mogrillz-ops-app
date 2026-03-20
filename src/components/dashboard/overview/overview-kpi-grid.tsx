interface OverviewKpi {
  label: string;
  value: string;
  delta: string;
  tone: "gold" | "green" | "red" | "blue";
}

interface OverviewKpiGridProps {
  kpis: OverviewKpi[];
  children?: React.ReactNode;
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
