"use client";

import { cn } from "cn";
import { useState, ViewTransition } from "react";

import { PartImage } from "@/components/part-image";
import { PhotoLoupe } from "@/components/photo-loupe";
import { isDrawing } from "@/lib/catalog/images";
import type { Position } from "@/lib/catalog/types";

/** Real photos of this unit. The first image is the product image well. */
export function PartGallery({
  sku,
  images,
  alt,
  position,
}: {
  sku: string;
  images: string[];
  alt: string;
  position: Position;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <div className="relative">
        {/* The card photo on the listing travels here (PartCard). */}
        <ViewTransition name={`part-${sku}`} share="part-photo" default="none">
          <PartImage
            src={current}
            alt={images.length > 1 ? `${alt}, photo ${index + 1} of ${images.length}` : alt}
            position={position}
            sizes="(min-width: 1024px) 560px, 100vw"
            preload
            fit="contain"
            className="rounded-2xl shadow-card"
          />
        </ViewTransition>
        {current && !isDrawing(current) ? <PhotoLoupe key={current} src={current} /> : null}
      </div>
      {current && !isDrawing(current) ? (
        <p className="mt-2 hidden text-sm pointer-fine:block">Move over the photo to look closer.</p>
      ) : null}
      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "block overflow-hidden rounded-lg border-2",
                  i === index ? "border-navy" : "border-transparent hover:border-primer",
                )}
              >
                <PartImage src={src} alt="" position={position} sizes="72px" className="size-[72px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
