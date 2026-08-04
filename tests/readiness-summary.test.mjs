import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReadinessSummary,
} from "../src/lib/dashboard/readiness-summary.ts";

const loadedSources = {
  subscribers: {
    status: "loaded",
    issue: null,
  },
  activity: {
    status: "loaded",
    issue: null,
  },
};

test("summarizes a fully loaded Supabase application snapshot", () => {
  const summary = buildReadinessSummary({
    dataSource: "supabase",
    generatedAt: "2026-08-04T03:31:54.000Z",
    optionalSources: loadedSources,
  });

  assert.equal(summary.statusLabel, "All app sources loaded");
  assert.equal(summary.statusTone, "ready");
  assert.equal(summary.unavailableOptionalSourceCount, 0);

  assert.deepEqual(
    summary.items.map((item) => [item.id, item.value, item.tone]),
    [
      ["data-source", "Live Supabase", "ready"],
      ["snapshot", "Loaded", "ready"],
      ["subscribers", "Loaded", "ready"],
      ["activity", "Loaded", "ready"],
    ],
  );

  assert.match(
    summary.items[1].detail,
    /Aug 3, 2026.*11:31 PM.*Eastern time/,
  );
});

test("reports unavailable optional sources without exposing provider errors", () => {
  const summary = buildReadinessSummary({
    dataSource: "supabase",
    generatedAt: "2026-08-04T03:31:54.000Z",
    optionalSources: {
      subscribers: {
        status: "unavailable",
        issue: "relation private_subscribers does not exist",
      },
      activity: {
        status: "unavailable",
        issue: "permission denied for private_activity",
      },
    },
  });

  assert.equal(
    summary.statusLabel,
    "2 availability items need review",
  );
  assert.equal(summary.statusTone, "review");
  assert.equal(summary.unavailableOptionalSourceCount, 2);

  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /private_subscribers/);
  assert.doesNotMatch(serialized, /permission denied/);
});

test("labels explicit demo mode without presenting it as live readiness", () => {
  const summary = buildReadinessSummary({
    dataSource: "mock",
    generatedAt: "invalid",
    optionalSources: loadedSources,
  });

  assert.equal(summary.statusLabel, "Explicit demo mode");
  assert.equal(summary.statusTone, "neutral");
  assert.equal(summary.items[0].value, "Explicit demo data");
  assert.equal(summary.items[1].value, "Unavailable");
  assert.match(
    summary.disclosure,
    /not a complete infrastructure, security, backup, or deployment certification/,
  );
});
