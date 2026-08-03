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

function UploadIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M5 14v4.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

export function MenuImageUploader({ itemId, itemName, currentImageUrl, onUploaded }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!uploading && !objectUrlRef.current) setPreview(currentImageUrl);
  }, [currentImageUrl, uploading]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function clearObjectUrl() {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
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
    clearObjectUrl();
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreview(localUrl);

    try {
      const form = new FormData();
      form.append("image", file);

      const response = await fetch(`/api/menu/${itemId}/image`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => null)) as { error?: string; imageUrl?: string } | null;
      if (!response.ok || !data?.imageUrl) throw new Error(data?.error ?? "Upload failed.");

      clearObjectUrl();
      setPreview(data.imageUrl);
      onUploaded(data.imageUrl);
      router.refresh();
    } catch (uploadError) {
      clearObjectUrl();
      setPreview(currentImageUrl);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
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
    <section aria-labelledby={`menu-image-title-${itemId}`} className="menu-image-uploader">
      <div className="menu-image-uploader__heading">
        <div>
          <h4 id={`menu-image-title-${itemId}`}>Dish image</h4>
          <p>Image uploads save immediately. Other dish changes save separately.</p>
        </div>
      </div>

      <div
        className={`menu-image-dropzone${dragOver ? " is-dragover" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDrop={handleDrop}
      >
        <button
          aria-busy={uploading}
          className="menu-image-uploader__button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="menu-image-uploader__preview">
            {preview ? (
              <Image
                alt={`${itemName} menu preview`}
                className="menu-image-preview"
                fill
                sizes="(max-width: 44rem) 100vw, 520px"
                src={preview}
                unoptimized
              />
            ) : (
              <span className="menu-image-uploader__empty" aria-hidden="true"><UploadIcon /></span>
            )}
          </span>
          <span className="menu-image-uploader__copy">
            <strong>{preview ? "Replace image" : "Upload image"}</strong>
            <span>Choose a file or drop it here</span>
            <small>JPEG, PNG, WebP, or AVIF · maximum 5 MB</small>
          </span>
        </button>

        {uploading ? (
          <p aria-live="polite" className="menu-image-uploader__status" role="status">Uploading image…</p>
        ) : null}
      </div>

      {error ? <p className="menu-image-error" role="alert">{error}</p> : null}

      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="menu-image-input"
        onChange={handleFileChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
    </section>
  );
}
