import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { loadDashboardDataState } from "@/lib/data-source";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function Home() {
  await requireAdminUser();
  const { snapshot, dataSource, dataIssue } = await loadDashboardDataState();

  return <DashboardApp dataIssue={dataIssue} dataSource={dataSource} snapshot={snapshot} />;
}
