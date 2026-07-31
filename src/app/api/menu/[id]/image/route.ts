import { NextResponse } from "next/server";

import { requireAdminRouteContext } from "@/lib/supabase/admin-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

async function loadMenuImageMetadata(
  adminClient: AdminClient,
  id: string,
): Promise<MenuImageMetadata | null> {
  const metadataResult = await adminClient
    .from("menu_items")
    .select("id,image_path,image_bucket")
    .eq("id", id)
    .maybeSingle();

  if (!metadataResult.error) {
    if (!metadataResult.data) return null;

    return {
      id: String(metadataResult.data.id),
      imagePath:
        typeof metadataResult.data.image_path === "string" ? metadataResult.data.image_path : null,
      imageBucket:
        typeof metadataResult.data.image_bucket === "string"
          ? metadataResult.data.image_bucket
          : null,
      supportsImageMetadata: true,
    };
  }

  if (!isMissingImageMetadataColumn(metadataResult.error)) {
    console.error("[menu-image-upload] menu lookup failed", {
      itemId: id,
      code: metadataResult.error.code,
      message: metadataResult.error.message,
    });
    return null;
  }

  const basicResult = await adminClient.from("menu_items").select("id").eq("id", id).maybeSingle();
  if (basicResult.error || !basicResult.data) {
    if (basicResult.error) {
      console.error("[menu-image-upload] menu fallback lookup failed", {
        itemId: id,
        code: basicResult.error.code,
        message: basicResult.error.message,
      });
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  const authResult = await requireAdminRouteContext({ requireServiceRole: true });
  if (!authResult.ok) return authResult.response;

  const adminClient = authResult.context.adminClient;
  if (!adminClient) {
    return NextResponse.json(
      { error: "Privileged image operations are not configured.", requestId },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Item ID required.", requestId }, { status: 400 });
  }

  const menuItem = await loadMenuImageMetadata(adminClient, id);
  if (!menuItem) {
    return NextResponse.json({ error: "Menu item not found.", requestId }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data.", requestId }, { status: 400 });
  }

  const file = formData.get("image") as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: "No image file provided.", requestId }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Image must be under 5 MB.", requestId }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or AVIF images are accepted.", requestId },
      { status: 400 },
    );
  }

  const ext = fileExtensionForType(file.type);
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type.", requestId }, { status: 400 });
  }

  const bucket = process.env.MOGRILLZ_MENU_IMAGE_BUCKET?.trim() || DEFAULT_BUCKET;
  const bucketError = await ensureMenuImageBucket(adminClient, bucket);
  if (bucketError) {
    console.error("[menu-image-upload] storage bucket setup failed", {
      bucket,
      requestId,
      message: bucketError.message,
    });
    return NextResponse.json(
      { error: "Storage is not ready for image uploads.", requestId },
      { status: 500 },
    );
  }

  const path = `items/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[menu-image-upload] storage upload failed", {
      itemId: id,
      path,
      requestId,
      message: uploadError.message,
    });
    return NextResponse.json({ error: "Image upload failed.", requestId }, { status: 500 });
  }

  const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(path);
  const imageUrl = urlData.publicUrl;
  const updatedAt = new Date().toISOString();
  const updatePayload: Record<string, string> = {
    image_url: imageUrl,
    updated_at: updatedAt,
  };

  if (menuItem.supportsImageMetadata) {
    updatePayload.image_path = path;
    updatePayload.image_bucket = bucket;
  }

  const updateResult = await adminClient
    .from("menu_items")
    .update(updatePayload)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  let databaseUpdated = !updateResult.error && Boolean(updateResult.data);

  if (updateResult.error && isMissingImageMetadataColumn(updateResult.error)) {
    const fallbackResult = await adminClient
      .from("menu_items")
      .update({ image_url: imageUrl, updated_at: updatedAt })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    databaseUpdated = !fallbackResult.error && Boolean(fallbackResult.data);
    if (fallbackResult.error) {
      console.error("[menu-image-upload] fallback database update failed", {
        itemId: id,
        path,
        requestId,
        code: fallbackResult.error.code,
        message: fallbackResult.error.message,
      });
    }
  } else if (updateResult.error) {
    console.error("[menu-image-upload] database update failed", {
      itemId: id,
      path,
      requestId,
      code: updateResult.error.code,
      message: updateResult.error.message,
    });
  }

  if (!databaseUpdated) {
    const rollback = await adminClient.storage.from(bucket).remove([path]);
    if (rollback.error) {
      console.error("[menu-image-upload] rollback cleanup failed", {
        itemId: id,
        path,
        requestId,
        message: rollback.error.message,
      });
    }

    return NextResponse.json(
      { error: "Image metadata could not be saved; the upload was rolled back.", requestId },
      { status: 500 },
    );
  }

  if (menuItem.imagePath && menuItem.imagePath !== path) {
    const cleanup = await adminClient.storage
      .from(menuItem.imageBucket || bucket)
      .remove([menuItem.imagePath]);

    if (cleanup.error) {
      console.warn("[menu-image-upload] old image cleanup failed", {
        itemId: id,
        path: menuItem.imagePath,
        requestId,
        message: cleanup.error.message,
      });
    }
  }

  return NextResponse.json({ path, imageUrl, requestId }, { status: 200 });
}
