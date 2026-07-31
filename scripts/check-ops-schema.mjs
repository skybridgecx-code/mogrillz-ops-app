import { createClient } from "@supabase/supabase-js";

const REQUIRED_SCHEMA_VERSION = 2026073001;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the operations schema preflight.`);
  }
  return value;
}

async function main() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.rpc("ops_schema_version");
  if (error) {
    throw new Error(
      `Operations schema preflight failed: ops_schema_version() is unavailable (${error.code ?? "unknown"}). Apply all Supabase migrations before deployment.`,
    );
  }

  const actualVersion = Number(data);
  if (!Number.isSafeInteger(actualVersion)) {
    throw new Error(`Operations schema preflight returned an invalid version: ${String(data)}`);
  }

  if (actualVersion < REQUIRED_SCHEMA_VERSION) {
    throw new Error(
      `Operations schema ${actualVersion} is older than required version ${REQUIRED_SCHEMA_VERSION}.`,
    );
  }

  console.log(
    JSON.stringify({
      status: "pass",
      requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
      actualSchemaVersion: actualVersion,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
