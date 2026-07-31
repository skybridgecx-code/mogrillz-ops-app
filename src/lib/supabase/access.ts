import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminMembershipConfig = {
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

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function matchesAdminMembership(
  row: Record<string, unknown>,
  config: AdminMembershipConfig,
  userId: string,
) {
  const rowUserId = readString(row[config.userIdColumn]);
  const rowRole = readString(row[config.roleColumn]).toLowerCase();
  const rowActive = row[config.activeColumn];

  if (!rowUserId || rowUserId !== userId) return false;
  if (rowActive !== true) return false;
  if (!rowRole || !config.allowedRoles.length) return false;

  return config.allowedRoles.includes(rowRole);
}

export async function userHasAdminMembership(client: SupabaseClient, userId: string) {
  const config = readAdminMembershipConfig();
  const selectedColumns = [...new Set([config.userIdColumn, config.roleColumn, config.activeColumn])].join(",");

  try {
    const { data, error } = await client
      .from(config.table)
      .select(selectedColumns)
      .eq(config.userIdColumn, userId)
      .maybeSingle();

    if (error || !data) return false;
    return matchesAdminMembership(data as unknown as Record<string, unknown>, config, userId);
  } catch {
    return false;
  }
}
