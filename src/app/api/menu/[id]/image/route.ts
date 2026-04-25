import { NextResponse } from "next/server";
import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("image") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "No image file provided." }, { status: 400 });

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or AVIF images are accepted." }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const bucket = process.env.MOGRILLZ_MENU_IMAGE_BUCKET ?? "menu-images";
  const path = `items/${id}/cover.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await authResult.adminClient.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[menu-image-upload] storage upload failed", { itemId: id, path, error: uploadError.message });
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  console.log("[menu-image-upload] uploaded", { itemId: id, path, bucket, sizeBytes: file.size });

  // Get a long-lived public URL (1 year signed)
  const { data: urlData } = await authResult.adminClient.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  const imageUrl = urlData?.signedUrl ?? null;

  // Update menu_items row with the new image path + url
  const { error: updateError } = await authResult.adminClient
    .from("menu_items")
    .update({
      image_path: path,
      image_bucket: bucket,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ path, imageUrl }, { status: 200 });
}
