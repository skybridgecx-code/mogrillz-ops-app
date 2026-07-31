import { createClient } from "@supabase/supabase-js";

const ALLOWED_IMAGE_TYPES = ["image/webp"];
const FILE_SIZE_LIMIT = "5MB";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.MOGRILLZ_MENU_IMAGE_BUCKET?.trim() || "menu-images";
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const existing = await client.storage.getBucket(bucket);
  if (existing.data) {
    const update = await client.storage.updateBucket(bucket, {
      public: true,
      allowedMimeTypes: ALLOWED_IMAGE_TYPES,
      fileSizeLimit: FILE_SIZE_LIMIT,
    });
    if (update.error) {
      throw new Error(`Failed to update storage bucket ${bucket}: ${update.error.message}`);
    }
  } else {
    const create = await client.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ALLOWED_IMAGE_TYPES,
      fileSizeLimit: FILE_SIZE_LIMIT,
    });
    if (create.error) {
      throw new Error(`Failed to create storage bucket ${bucket}: ${create.error.message}`);
    }
  }

  const verification = await client.storage.getBucket(bucket);
  if (verification.error || !verification.data?.public) {
    throw new Error(`Storage bucket ${bucket} could not be verified as public.`);
  }

  console.log(
    JSON.stringify({
      status: "pass",
      bucket,
      public: true,
      allowedMimeTypes: ALLOWED_IMAGE_TYPES,
      fileSizeLimit: FILE_SIZE_LIMIT,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
