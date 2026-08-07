import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { loadDashboardDataState } from "@/lib/data-source";
import { requireAdminUser } from "@/lib/supabase/auth";

export default async function Home() {
  await requireAdminUser();
  const { snapshot, dataSource, dataIssue } = await loadDashboardDataState();
  // This server-owned value is serialized into the first client render.
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();

  return <DashboardApp dataIssue={dataIssue} dataSource={dataSource} initialNow={initialNow} snapshot={snapshot} />;
}
