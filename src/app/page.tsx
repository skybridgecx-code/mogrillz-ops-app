import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { getDataSourceKind, loadDashboardSnapshot } from "@/lib/data-source";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function Home() {
  await requireAdminUser();
  const snapshot = await loadDashboardSnapshot();
  const dataSource = getDataSourceKind();

  return <DashboardApp dataSource={dataSource} snapshot={snapshot} />;
}
