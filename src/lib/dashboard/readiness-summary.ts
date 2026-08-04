import type { DashboardSnapshot } from "@/types/domain";

export type ApplicationDataSource = "mock" | "supabase";
export type ApplicationAvailabilityTone = "ready" | "review" | "neutral";

export interface ApplicationAvailabilityItem {
  id: "data-source" | "snapshot" | "subscribers" | "activity";
  label: string;
  value: string;
  detail: string;
  tone: ApplicationAvailabilityTone;
}

export interface ApplicationAvailabilitySummary {
  statusLabel: string;
  statusTone: ApplicationAvailabilityTone;
  unavailableOptionalSourceCount: number;
  disclosure: string;
  items: ApplicationAvailabilityItem[];
}

const APPLICATION_AVAILABILITY_DISCLOSURE =
  "This panel reflects application data availability only. It is not a complete infrastructure, security, backup, or deployment certification.";

function formatSnapshotTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(parsed);
}

export function buildReadinessSummary({
  dataSource,
  generatedAt,
  optionalSources,
}: {
  dataSource: ApplicationDataSource;
  generatedAt: string;
  optionalSources: DashboardSnapshot["optionalSources"];
}): ApplicationAvailabilitySummary {
  const snapshotTime = formatSnapshotTime(generatedAt);

  const subscribersLoaded =
    optionalSources.subscribers.status === "loaded";
  const activityLoaded =
    optionalSources.activity.status === "loaded";

  const unavailableOptionalSourceCount = [
    subscribersLoaded,
    activityLoaded,
  ].filter((loaded) => !loaded).length;

  const reviewItemCount =
    unavailableOptionalSourceCount + (snapshotTime ? 0 : 1);

  const statusLabel =
    dataSource === "mock"
      ? "Explicit demo mode"
      : reviewItemCount
        ? `${reviewItemCount} availability item${
            reviewItemCount === 1 ? "" : "s"
          } need review`
        : "All app sources loaded";

  const statusTone: ApplicationAvailabilityTone =
    dataSource === "mock"
      ? "neutral"
      : reviewItemCount
        ? "review"
        : "ready";

  return {
    statusLabel,
    statusTone,
    unavailableOptionalSourceCount,
    disclosure: APPLICATION_AVAILABILITY_DISCLOSURE,
    items: [
      {
        id: "data-source",
        label: "Primary data source",
        value:
          dataSource === "mock"
            ? "Explicit demo data"
            : "Live Supabase",
        detail:
          dataSource === "mock"
            ? "Mock data was explicitly enabled. Values are not live operations data."
            : "The dashboard is reading Supabase-backed application data.",
        tone: dataSource === "mock" ? "neutral" : "ready",
      },
      {
        id: "snapshot",
        label: "Loaded snapshot",
        value: snapshotTime ? "Loaded" : "Unavailable",
        detail: snapshotTime
          ? `Generated ${snapshotTime} Eastern time.`
          : "The snapshot generation time could not be verified.",
        tone: snapshotTime ? "ready" : "review",
      },
      {
        id: "subscribers",
        label: "Subscriber source",
        value: subscribersLoaded ? "Loaded" : "Unavailable",
        detail: subscribersLoaded
          ? "Subscriber records are included in this snapshot."
          : "Subscriber records were not available when this snapshot loaded.",
        tone: subscribersLoaded ? "ready" : "review",
      },
      {
        id: "activity",
        label: "Activity source",
        value: activityLoaded ? "Loaded" : "Unavailable",
        detail: activityLoaded
          ? "Recorded order-status activity is included in this snapshot."
          : "Recorded order-status activity was not available when this snapshot loaded.",
        tone: activityLoaded ? "ready" : "review",
      },
    ],
  };
}
