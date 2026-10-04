"use client";

import { cn } from "cn";
import { useState } from "react";

import { PartImage } from "@/components/part-image";
import type { Position } from "@/lib/catalog/types";

/** Real photos of this unit. The first image is the product image well. */
export function PartGallery({ images, alt, position }: { images: string[]; alt: string; position: Position }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div>
      <PartImage
        src={current}
        alt={images.length > 1 ? `${alt}, photo ${index + 1} of ${images.length}` : alt}
        position={position}
        sizes="(min-width: 1024px) 560px, 100vw"
        preload
        className="rounded-lg"
      />
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
                  "block overflow-hidden rounded-md border-2",
                  i === index ? "border-graphite" : "border-transparent hover:border-primer",
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
