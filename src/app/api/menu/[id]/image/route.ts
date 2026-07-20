import { NextResponse } from "next/server";
import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const DEFAULT_BUCKET = "menu-images";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type MenuImageMetadata = {
  id: string;
  imagePath: string | null;
  imageBucket: string | null;
  supportsImageMetadata: boolean;
};

function isMissingImageMetadataColumn(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("image_path") ||
    message.includes("image_bucket")
  );
}

function fileExtensionForType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/avif") return "avif";
  return null;
}

async function ensureMenuImageBucket(adminClient: AdminClient, bucket: string) {
  const existing = await adminClient.storage.getBucket(bucket);

  if (!existing.error) {
    if (existing.data && !existing.data.public) {
      const update = await adminClient.storage.updateBucket(bucket, {
        public: true,
        allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
        fileSizeLimit: "5MB",
      });
      if (update.error) return update.error;
    }

    return null;
  }

  const create = await adminClient.storage.createBucket(bucket, {
    public: true,
    allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
    fileSizeLimit: "5MB",
  });

  return create.error ?? null;
}

async function loadMenuImageMetadata(adminClient: AdminClient, id: string): Promise<MenuImageMetadata | null> {
  const metadataResult = await adminClient
    .from("menu_items")
    .select("id,image_path,image_bucket")
    .eq("id", id)
    .maybeSingle();

  if (!metadataResult.error) {
    if (!metadataResult.data) return null;

    return {
      id: String(metadataResult.data.id),
      imagePath: typeof metadataResult.data.image_path === "string" ? metadataResult.data.image_path : null,
      imageBucket: typeof metadataResult.data.image_bucket === "string" ? metadataResult.data.image_bucket : null,
      supportsImageMetadata: true,
    };
  }

  if (!isMissingImageMetadataColumn(metadataResult.error)) {
    console.error("[menu-image-upload] menu lookup failed", { itemId: id, error: metadataResult.error.message });
    return null;
  }

  const basicResult = await adminClient.from("menu_items").select("id").eq("id", id).maybeSingle();
  if (basicResult.error || !basicResult.data) {
    if (basicResult.error) {
      console.error("[menu-image-upload] menu fallback lookup failed", { itemId: id, error: basicResult.error.message });
    }
    return null;
  }

  return {
    id: String(basicResult.data.id),
    imagePath: null,
    imageBucket: null,
    supportsImageMetadata: false,
  };
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured." }, { status: 500 }) };

  const claimsResult = await supabase.auth.getClaims();
  const userId = typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };

  const isAdmin = await userHasAdminMembership(supabase, userId);
  if (!isAdmin) return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return { error: NextResponse.json({ error: "Admin client not configured." }, { status: 500 }) };

  return { adminClient };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Item ID required." }, { status: 400 });

  const menuItem = await loadMenuImageMetadata(authResult.adminClient, id);
  if (!menuItem) return NextResponse.json({ error: "Menu item not found." }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("image") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "No image file provided." }, { status: 400 });

  if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or AVIF images are accepted." }, { status: 400 });
  }

  const ext = fileExtensionForType(file.type);
  if (!ext) return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });

  const bucket = process.env.MOGRILLZ_MENU_IMAGE_BUCKET?.trim() || DEFAULT_BUCKET;
  const bucketError = await ensureMenuImageBucket(authResult.adminClient, bucket);
  if (bucketError) {
    console.error("[menu-image-upload] storage bucket setup failed", { bucket, error: bucketError.message });
    return NextResponse.json({ error: `Storage bucket setup failed: ${bucketError.message}` }, { status: 500 });
  }

  const path = `items/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await authResult.adminClient.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[menu-image-upload] storage upload failed", { itemId: id, path, error: uploadError.message });
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  console.log("[menu-image-upload] uploaded", { itemId: id, path, bucket, sizeBytes: file.size });

  const { data: urlData } = authResult.adminClient.storage.from(bucket).getPublicUrl(path);
  const imageUrl = urlData.publicUrl;

  const updatePayload: Record<string, string> = {
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  };

  if (menuItem.supportsImageMetadata) {
    updatePayload.image_path = path;
    updatePayload.image_bucket = bucket;
  }

  const updateResult = await authResult.adminClient
    .from("menu_items")
    .update(updatePayload)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error && isMissingImageMetadataColumn(updateResult.error)) {
    const fallbackResult = await authResult.adminClient
      .from("menu_items")
      .update({ image_url: imageUrl, updated_at: updatePayload.updated_at })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (fallbackResult.error || !fallbackResult.data) {
      return NextResponse.json(
        { error: `DB update failed: ${fallbackResult.error?.message ?? "menu item not found"}` },
        { status: fallbackResult.error ? 500 : 404 },
      );
    }
  } else if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { error: `DB update failed: ${updateResult.error?.message ?? "menu item not found"}` },
      { status: updateResult.error ? 500 : 404 },
    );
  }

  if (menuItem.imagePath && menuItem.imagePath !== path) {
    await authResult.adminClient.storage
      .from(menuItem.imageBucket || bucket)
      .remove([menuItem.imagePath])
      .then(({ error }) => {
        if (error) {
          console.warn("[menu-image-upload] old image cleanup failed", {
            itemId: id,
            path: menuItem.imagePath,
            error: error.message,
          });
        }
      });
  }

  return NextResponse.json({ path, imageUrl }, { status: 200 });
}
