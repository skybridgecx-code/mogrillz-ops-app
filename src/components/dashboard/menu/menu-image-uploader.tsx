"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Props = {
  itemId: string;
  currentImageUrl: string | null;
  onUploaded: (url: string) => void;
};

export function MenuImageUploader({ itemId, currentImageUrl, onUploaded }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, or AVIF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }

    setError(null);
    setUploading(true);

    // Optimistic preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(`/api/menu/${itemId}/image`, {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      onUploaded(data.imageUrl);
      setPreview(data.imageUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(currentImageUrl);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="menu-image-uploader">
      <p className="menu-image-label">Item Image</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`menu-image-dropzone ${dragOver ? "is-dragover" : ""}`}
        role="button"
        aria-label="Upload menu item image"
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Menu item preview"
              fill
              className="menu-image-preview"
              sizes="320px"
              unoptimized
            />
            <div className="menu-image-replace-overlay">
              <span>Click to replace</span>
            </div>
          </>
        ) : (
          <div className="menu-image-empty">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p>Drop image or click to upload</p>
            <small>JPEG, PNG, WebP - Max 5 MB</small>
          </div>
        )}

        {uploading && (
          <div className="menu-image-uploading">
            <div>
              <svg aria-hidden="true" className="menu-image-spinner" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Uploading...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="menu-image-error">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="menu-image-input"
        onChange={handleFileChange}
      />
    </div>
  );
}
