import Image from "next/image";
import { cn } from "cn";

import type { Position } from "@/lib/catalog/types";

/**
 * Square image well on paper. Placeholder drawings in /parts are drawn as the
 * right-hand part and mirrored for left-hand positions; real photos never are.
 */
export function PartImage({
  src,
  alt,
  position,
  sizes,
  preload = false,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  position: Position;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const drawing = !src || src.startsWith("/parts/");
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
          className={cn("object-contain", drawing && "p-[14%]", flip && "-scale-x-100")}
        />
      ) : null}
    </div>
  );
}
