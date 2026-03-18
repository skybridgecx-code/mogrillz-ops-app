import type { SupabaseClient } from "@supabase/supabase-js";

type AdminMembershipConfig = {
  table: string;
  userIdColumn: string;
  roleColumn: string;
  activeColumn: string;
  allowedRoles: string[];
};

function readTextEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export function readAdminMembershipConfig(): AdminMembershipConfig {
  const configuredRoles = readTextEnv("MO_GRILLZ_ADMIN_MEMBERSHIP_ALLOWED_ROLES", "owner,admin");

  return {
    table: readTextEnv("MO_GRILLZ_ADMIN_MEMBERSHIP_TABLE", "admin_memberships"),
    userIdColumn: readTextEnv("MO_GRILLZ_ADMIN_MEMBERSHIP_USER_ID_COLUMN", "user_id"),
    roleColumn: readTextEnv("MO_GRILLZ_ADMIN_MEMBERSHIP_ROLE_COLUMN", "role"),
    activeColumn: readTextEnv("MO_GRILLZ_ADMIN_MEMBERSHIP_ACTIVE_COLUMN", "is_active"),
    allowedRoles: configuredRoles
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function matchesAdminMembership(row: Record<string, unknown>, config: AdminMembershipConfig, userId: string) {
  const rowUserId = readString(row[config.userIdColumn], readString(row.user_id ?? row.userId, ""));
  const rowRole = readString(row[config.roleColumn], readString(row.role, ""));
  const rowActive = readBoolean(row[config.activeColumn], readBoolean(row.is_active ?? row.active, true));

  if (!rowUserId || rowUserId !== userId) return false;
  if (!rowActive) return false;

  if (!rowRole) return true;
  return config.allowedRoles.includes(rowRole.toLowerCase());
}

export async function userHasAdminMembership(client: SupabaseClient, userId: string) {
  const config = readAdminMembershipConfig();

  try {
    const { data, error } = await client.from(config.table).select("*").eq(config.userIdColumn, userId).maybeSingle();

    if (error || !data) return false;
    return matchesAdminMembership(data as Record<string, unknown>, config, userId);
  } catch {
    return false;
  }
}
