"use client";

import { getImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

const ZOOM = 2.5;
// Lens diameter in CSS px.
const LENS = 200;

/**
 * A magnifier over the product photo for buyers checking a unit's marks and
 * defects up close. Mouse only; the large photo loads on first use. Placed
 * inside a photo well that uses `object-contain`.
 */
export function PhotoLoupe({ src }: { src: string }) {
  const lensRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  // The 2x candidate of a 960px image: 1920px wide.
  const large = getImageProps({ src, alt: "", width: 960, height: 960 }).props.src;

  useEffect(() => {
    const lens = lensRef.current;
    const well = lens?.parentElement;
    if (!lens || !well) return;
    const allowed = window.matchMedia("(hover: hover) and (pointer: fine)");

    function move(event: PointerEvent) {
      const img = well?.querySelector("img");
      if (!allowed.matches || event.pointerType !== "mouse" || !lens || !well || !img || img.naturalWidth === 0) return;
      const box = well.getBoundingClientRect();
      // Where object-fit: contain drew the photo inside the well.
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const ox = (box.width - dw) / 2;
      const oy = (box.height - dh) / 2;
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const inside = x >= ox && x <= ox + dw && y >= oy && y <= oy + dh;
      setActive(inside);
      if (!inside) return;
      lens.style.transform = `translate(${x - LENS / 2}px, ${y - LENS / 2}px)`;
      lens.style.backgroundSize = `${dw * ZOOM}px ${dh * ZOOM}px`;
      lens.style.backgroundPosition = `${-((x - ox) * ZOOM - LENS / 2)}px ${-((y - oy) * ZOOM - LENS / 2)}px`;
    }
    function leave() {
      setActive(false);
    }

    well.addEventListener("pointermove", move);
    well.addEventListener("pointerleave", leave);
    return () => {
      well.removeEventListener("pointermove", move);
      well.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div
      ref={lensRef}
      aria-hidden
      style={{ width: LENS, height: LENS, backgroundImage: active ? `url("${large}")` : undefined }}
      className={
        active
          ? "pointer-events-none absolute top-0 left-0 z-10 rounded-full bg-paper bg-no-repeat shadow-lift ring-2 ring-navy"
          : "pointer-events-none absolute top-0 left-0 hidden"
      }
    />
  );
}
