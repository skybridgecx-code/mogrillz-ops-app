"use client";

import { useRef, useState } from "react";
import Image from "next/image";

type Props = {
  itemId: string;
  currentImageUrl: string | null;
  onUploaded: (url: string) => void;
};

export function MenuImageUploader({ itemId, currentImageUrl, onUploaded }: Props) {
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
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Item Image</p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden ${
          dragOver
            ? "border-amber-400 bg-amber-400/5"
            : "border-stone-700 hover:border-stone-500 bg-stone-900/60"
        }`}
        style={{ aspectRatio: "4/3" }}
        role="button"
        aria-label="Upload menu item image"
      >
        {preview ? (
          <>
            <Image
              src={preview}
              alt="Menu item preview"
              fill
              className="object-cover"
              sizes="320px"
              unoptimized={preview.startsWith("blob:")}
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <p className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-lg">
                Click to replace
              </p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p className="text-xs font-medium">Drop image or click to upload</p>
            <p className="text-[10px] text-stone-600">JPEG, PNG, WebP · Max 5 MB</p>
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="flex items-center gap-2 text-amber-400">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs font-semibold">Uploading…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
