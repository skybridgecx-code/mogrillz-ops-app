import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  requireAdminRouteContext,
  type AdminRouteContext,
} from "@/lib/supabase/admin-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_OUTPUT_DIMENSION = 1600;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const DEFAULT_BUCKET = "menu-images";

type StorageAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type DatabaseClient = AdminRouteContext["supabase"];
type MenuImageMetadata = {
  id: string;
  imagePath: string | null;
  imageBucket: string | null;
};

async function loadMenuImageMetadata(
  databaseClient: DatabaseClient,
  id: string,
): Promise<MenuImageMetadata | null> {
  const result = await databaseClient
    .from("menu_items")
    .select("id,image_path,image_bucket")
    .eq("id", id)
    .maybeSingle();

  if (result.error) {
    console.error("[menu-image-upload] menu lookup failed", {
      itemId: id,
      code: result.error.code,
      message: result.error.message,
    });
    return null;
  }

  if (!result.data) return null;

  return {
    id: String(result.data.id),
    imagePath: typeof result.data.image_path === "string" ? result.data.image_path : null,
    imageBucket: typeof result.data.image_bucket === "string" ? result.data.image_bucket : null,
  };
}

async function verifyProvisionedBucket(storageClient: StorageAdminClient, bucket: string) {
  const result = await storageClient.storage.getBucket(bucket);
  if (result.error || !result.data?.public) {
    console.error("[menu-image-upload] storage bucket is not provisioned", {
      bucket,
      code: result.error?.name,
      message: result.error?.message,
    });
    return false;
  }
  return true;
}

async function normalizeImage(file: File) {
  const input = Buffer.from(await file.arrayBuffer());

  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Image dimensions are unavailable.");
    }

    const output = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    if (!output.length || output.length > MAX_IMAGE_SIZE) {
      throw new Error("Normalized image exceeds the storage limit.");
    }

    return output;
  } catch (error) {
    console.warn("[menu-image-upload] image decode failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  const authResult = await requireAdminRouteContext({ requireServiceRole: true });
  if (!authResult.ok) return authResult.response;

  const storageClient = authResult.context.adminClient;
  const databaseClient = authResult.context.supabase;
  if (!storageClient) {
    return NextResponse.json(
      { error: "Privileged image operations are not configured.", requestId },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Item ID required.", requestId }, { status: 400 });
  }

  const menuItem = await loadMenuImageMetadata(databaseClient, id);
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

  const normalizedImage = await normalizeImage(file);
  if (!normalizedImage) {
    return NextResponse.json(
      { error: "The uploaded file is not a valid supported image.", requestId },
      { status: 400 },
    );
  }

  const bucket = process.env.MOGRILLZ_MENU_IMAGE_BUCKET?.trim() || DEFAULT_BUCKET;
  if (!(await verifyProvisionedBucket(storageClient, bucket))) {
    return NextResponse.json(
      {
        error: "Image storage is not provisioned. Run the storage provisioning preflight.",
        requestId,
      },
      { status: 503 },
    );
  }

  const path = `items/${id}/${Date.now()}-${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await storageClient.storage
    .from(bucket)
    .upload(path, normalizedImage, { contentType: "image/webp", upsert: false });

  if (uploadError) {
    console.error("[menu-image-upload] storage upload failed", {
      itemId: id,
      path,
      requestId,
      message: uploadError.message,
    });
    return NextResponse.json({ error: "Image upload failed.", requestId }, { status: 500 });
  }

  const { data: urlData } = storageClient.storage.from(bucket).getPublicUrl(path);
  const imageUrl = urlData.publicUrl;
  const updateResult = await databaseClient
    .from("menu_items")
    .update({
      image_url: imageUrl,
      image_path: path,
      image_bucket: bucket,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    console.error("[menu-image-upload] database update failed", {
      itemId: id,
      path,
      requestId,
      code: updateResult.error?.code,
      message: updateResult.error?.message,
    });

    const rollback = await storageClient.storage.from(bucket).remove([path]);
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
    const cleanup = await storageClient.storage
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
