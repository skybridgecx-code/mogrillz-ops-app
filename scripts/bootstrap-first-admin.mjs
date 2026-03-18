#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

function sanitizeEnvValue(value) {
  if (typeof value !== "string") return value;
  return value.replace(/[^\x20-\x7E]/g, "");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8").replace(/[\u2028\u2029]/g, "\n");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const equalsIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = sanitizeEnvValue(trimmed.slice(equalsIndex + 1).trim());

    if (!key || process.env[key]) continue;

    const quoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"));
    process.env[key] = sanitizeEnvValue(quoted ? rawValue.slice(1, -1) : rawValue);
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

function parseArgs(argv) {
  const args = {};

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const [flag, inlineValue] = token.split("=", 2);
    const key = flag.slice(2);

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
      continue;
    }

    args[key] = true;
  }

  return args;
}

function requireValue(value, label) {
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required ${label}.`);
  }

  return value.trim();
}

function parseBoolean(value, defaultValue = false) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value !== "string") return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

function readSupabaseConfig() {
  const url = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim());
  const serviceRoleKey = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  if (!url) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL before running the bootstrap script.");
  }

  if (!serviceRoleKey) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY before running the bootstrap script.");
  }

  return { url, serviceRoleKey };
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  loadLocalEnv();

  const args = parseArgs(process.argv);
  const email = requireValue(args.email, "--email");
  const displayName = typeof args.name === "string" ? args.name.trim() : null;
  const role = typeof args.role === "string" ? args.role.trim() : "owner";
  const mode = typeof args.mode === "string" ? args.mode.trim() : "create";
  const password = typeof args.password === "string" ? args.password : null;
  const confirmEmail = parseBoolean(args["confirm-email"], true);

  if (!["owner", "admin"].includes(role)) {
    throw new Error(`Invalid --role "${role}". Use owner or admin.`);
  }

  if (!["create", "invite"].includes(mode)) {
    throw new Error(`Invalid --mode "${mode}". Use create or invite.`);
  }

  const { url, serviceRoleKey } = readSupabaseConfig();
  const adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  let user = await findUserByEmail(adminClient, email);
  let action = "linked existing auth user";

  if (!user) {
    if (mode === "invite" && !password) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          name: displayName ?? email,
        },
      });

      if (error) throw error;
      user = data.user;
      action = "invited auth user";
    } else {
      if (!password) {
        throw new Error("Provide --password when using --mode create.");
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: confirmEmail,
        user_metadata: {
          name: displayName ?? email,
        },
      });

      if (error) throw error;
      user = data.user;
      action = "created auth user";
    }
  } else if (password && mode === "create") {
    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: confirmEmail,
      user_metadata: {
        name: displayName ?? user.user_metadata?.name ?? email,
      },
    });

    if (error) throw error;
    action = "updated existing auth user";
  }

  if (!user?.id) {
    throw new Error("Could not determine the auth user id.");
  }

  const { error: membershipError } = await adminClient.from("admin_memberships").upsert(
    {
      user_id: user.id,
      email,
      display_name: displayName ?? user.user_metadata?.name ?? email,
      role,
      is_active: true,
      approved_at: new Date().toISOString(),
      created_by: null,
    },
    { onConflict: "user_id" },
  );

  if (membershipError) throw membershipError;

  console.log("MoGrillz admin bootstrap complete.");
  console.log(`Action: ${action}`);
  console.log(`User: ${email} (${user.id})`);
  console.log(`Role: ${role}`);
  console.log("Membership: admin_memberships upserted");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Bootstrap failed: ${message}`);
  process.exit(1);
});
