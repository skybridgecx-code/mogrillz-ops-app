import assert from "node:assert/strict";
import test from "node:test";

import { matchesAdminMembership } from "../src/lib/supabase/access.ts";

const config = {
  table: "admin_memberships",
  userIdColumn: "user_id",
  roleColumn: "role",
  activeColumn: "is_active",
  allowedRoles: ["owner", "admin"],
};

const userId = "11111111-1111-4111-8111-111111111111";

test("accepts only an active matching user with an allowed role", () => {
  assert.equal(
    matchesAdminMembership(
      { user_id: userId, role: "OWNER", is_active: true },
      config,
      userId,
    ),
    true,
  );
});

test("fails closed when active state is absent or not strictly true", () => {
  assert.equal(
    matchesAdminMembership({ user_id: userId, role: "owner" }, config, userId),
    false,
  );
  assert.equal(
    matchesAdminMembership(
      { user_id: userId, role: "owner", is_active: "true" },
      config,
      userId,
    ),
    false,
  );
  assert.equal(
    matchesAdminMembership(
      { user_id: userId, role: "owner", is_active: false },
      config,
      userId,
    ),
    false,
  );
});

test("fails closed when role is absent or disallowed", () => {
  assert.equal(
    matchesAdminMembership({ user_id: userId, is_active: true }, config, userId),
    false,
  );
  assert.equal(
    matchesAdminMembership(
      { user_id: userId, role: "viewer", is_active: true },
      config,
      userId,
    ),
    false,
  );
});

test("rejects another user's otherwise valid membership", () => {
  assert.equal(
    matchesAdminMembership(
      { user_id: "22222222-2222-4222-8222-222222222222", role: "owner", is_active: true },
      config,
      userId,
    ),
    false,
  );
});
