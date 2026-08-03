"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  itemId: string;
  itemName: string;
  currentImageUrl: string | null;
  onUploaded: (url: string) => void;
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function MenuImageUploader({ itemId, itemName, currentImageUrl, onUploaded }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setPreview(currentImageUrl);
  }, [currentImageUrl]);

  useEffect(
    () => () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    },
    [],
  );

  function clearLocalPreview() {
    if (!localPreviewRef.current) return;
    URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
  }

  async function uploadFile(file: File) {
    if (uploading) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, or AVIF files are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image must be under 5 MB.");
      return;
    }

    setError(null);
    setUploading(true);
    clearLocalPreview();

    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setPreview(localUrl);

    try {
      const form = new FormData();
      form.append("image", file);

      const response = await fetch(`/api/menu/${itemId}/image`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => null)) as { error?: string; imageUrl?: string } | null;

      if (!response.ok || !data?.imageUrl) {
        throw new Error(data?.error ?? "Upload failed.");
      }

      onUploaded(data.imageUrl);
      setPreview(data.imageUrl);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      setPreview(currentImageUrl);
    } finally {
      clearLocalPreview();
      setUploading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className="menu-image-uploader">
      <div className="menu-image-uploader__heading">
        <p>Dish image</p>
        <span>Image uploads save immediately. Other dish changes save separately.</span>
      </div>

      <div
        className={`menu-image-dropzone ${dragOver ? "is-dragover" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {preview ? (
          <Image
            alt={`${itemName} menu preview`}
            className="menu-image-preview"
            fill
            sizes="320px"
            src={preview}
            unoptimized
          />
        ) : (
          <div className="menu-image-empty" aria-hidden="true">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
            </svg>
          </div>
        )}

        <button
          className="menu-image-dropzone__action"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {uploading ? "Uploading…" : preview ? "Replace image" : "Choose image"}
        </button>
      </div>

      <p className="menu-image-uploader__help">JPEG, PNG, WebP, or AVIF. Maximum 5 MB. You can also drop a file above.</p>
      <p aria-live="polite" className="menu-image-uploader__status">
        {uploading ? `Uploading image for ${itemName}.` : ""}
      </p>
      {error ? <p className="menu-image-error" role="alert">{error}</p> : null}

      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="menu-image-input"
        disabled={uploading}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
