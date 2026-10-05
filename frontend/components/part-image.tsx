import Image from "next/image";
import { cn } from "cn";

import { isDrawing } from "@/lib/catalog/images";
import type { Position } from "@/lib/catalog/types";

/**
 * Square image well on paper. Photos fill the well (`cover`) on cards and
 * thumbnails; the product page shows the whole part (`contain`). Placeholder
 * drawings are drawn as the right-hand part and mirrored for left-hand
 * positions; real photos never are.
 */
export function PartImage({
  src,
  alt,
  position,
  sizes,
  preload = false,
  fit = "cover",
  className,
}: {
  src: string | null | undefined;
  alt: string;
  position: Position;
  sizes: string;
  preload?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const drawing = isDrawing(src);
  const flip = drawing && position.endsWith("left");

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-paper", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          unoptimized={drawing}
          className={cn(
            drawing ? "object-contain p-[14%]" : fit === "cover" ? "object-cover" : "object-contain",
            flip && "-scale-x-100",
          )}
        />
      ) : null}
    </div>
  );
}
