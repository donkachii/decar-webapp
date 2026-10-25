"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export type PhotoResult = { ok: true } | { error: string };

// The API stores photos at most 2000 px on the longest side. Phone photos are
// twice that and several MB, so shrink them here first: quicker on mobile data,
// and under Vercel's 4.5 MB request limit (next.config.ts allows 4 MB).
const MAX_SIDE = 2000;
const MAX_SEND_BYTES = 4 * 1024 * 1024 - 32 * 1024; // room for the form's own bytes

async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency: cut-outs go on paper white, like the image wells.
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]*$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    // A format this browser can't draw (HEIC outside Safari): send it as it is.
    return file;
  }
}

/**
 * "Add photos" button for /admin. Opens the camera or gallery, then uploads
 * the chosen photos one at a time through `action`, which revalidates the page.
 */
export function PhotoUpload({
  action,
  label,
  multiple = false,
  variant = "default",
}: {
  action: (form: FormData) => Promise<PhotoResult>;
  label: string;
  multiple?: boolean;
  variant?: "default" | "outline";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function upload(files: File[]) {
    if (files.length === 0) return;
    setError("");
    startTransition(async () => {
      for (const [i, file] of files.entries()) {
        setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
        const photo = await shrink(file);
        if (photo.size > MAX_SEND_BYTES) {
          setError(`${file.name} is too large to send. Choose a JPEG copy, or take it again with the camera.`);
          break;
        }
        const form = new FormData();
        form.append("photo", photo);
        let result: PhotoResult;
        try {
          result = await action(form);
        } catch {
          result = { error: "It didn't upload. Check the connection and try again." };
        }
        if ("error" in result) {
          setError(`${file.name}: ${result.error}`);
          break;
        }
      }
      setProgress("");
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => upload([...(e.currentTarget.files ?? [])])}
      />
      <Button type="button" variant={variant} disabled={pending} onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden />
        {pending ? progress || "Uploading…" : label}
      </Button>
      <p role="status" className="sr-only">
        {progress}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
