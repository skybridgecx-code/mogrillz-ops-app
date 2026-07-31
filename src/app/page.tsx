import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { loadDashboardDataState } from "@/lib/data-source";
import { loadAuthoritativeDashboardKpis } from "@/lib/dashboard/authoritative-kpis";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function Home() {
  await requireAdminUser();
  const state = await loadDashboardDataState();

  if (state.dataSource === "supabase" && state.snapshot) {
    const kpis = await loadAuthoritativeDashboardKpis();
    if (!kpis) {
      return (
        <DashboardApp
          dataIssue="Authoritative operations metrics are unavailable. Verify schema version 2026073002 before using the live dashboard."
          dataSource="supabase"
          snapshot={null}
        />
      );
    }

    return (
      <DashboardApp
        dataIssue={state.dataIssue}
        dataSource={state.dataSource}
        snapshot={{ ...state.snapshot, kpis }}
      />
    );
  }

  return (
    <DashboardApp
      dataIssue={state.dataIssue}
      dataSource={state.dataSource}
      snapshot={state.snapshot}
    />
  );
}
