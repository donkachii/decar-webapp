/** Placeholder drawings live in /public/parts; every other image is a real photo. */
export function isDrawing(src: string | null | undefined): boolean {
  return !src || src.startsWith("/parts/");
}
