"use client";

import { cn } from "cn";
import { Pause, Play } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";

// Trimmed from the owner's showcase (part shots only, fading in and out of navy).
const SOURCES = { large: "/hero/showcase-1280.mp4", small: "/hero/showcase-854.mp4" };
// The poster is this moment of the clip, so the swap from poster to video doesn't jump.
const START = "#t=0.7";

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Reduced motion, Save-Data and 3G or slower keep the poster (CLAUDE.md section 9). */
function worthPlaying(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData) return false;
  return !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
}

/** Runs once the page has finished loading, so the clip never competes with it. */
function afterLoad(run: () => void): () => void {
  let timer = 0;
  const schedule = () => {
    timer = window.setTimeout(run, 400);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    window.removeEventListener("load", schedule);
    window.clearTimeout(timer);
  };
}

/**
 * The hero's showcase clip. The poster is what loads with the page; the clip
 * starts downloading only after the load event, plays muted while on screen,
 * and can be paused.
 */
export function HeroVideo({ poster }: { poster: StaticImageData }) {
  const ref = useRef<HTMLVideoElement>(null);
  const pausedByUser = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !worthPlaying()) return;
    video.muted = true;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!video.src || pausedByUser.current) return;
      if (visible) void video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(video);
    const cancel = afterLoad(() => {
      video.src = (window.innerWidth >= 1024 ? SOURCES.large : SOURCES.small) + START;
      // If the browser refuses to autoplay, the poster simply stays.
      if (visible) void video.play().catch(() => {});
    });
    return () => {
      cancel();
      observer.disconnect();
    };
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    pausedByUser.current = !video.paused;
    setPaused(!video.paused);
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }

  return (
    <>
      <Image src={poster} alt="" fill preload placeholder="blur" sizes="100vw" className="object-cover" />
      <video
        ref={ref}
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="none"
        aria-hidden
        tabIndex={-1}
        onPlaying={() => setPlaying(true)}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-700",
          playing ? "opacity-100" : "opacity-0",
        )}
      />
      {playing ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? "Play video" : "Pause video"}
          className="hero-edge-b hero-edge-r absolute right-0 bottom-0 z-10 m-3 grid size-10 place-items-center rounded-full bg-navy/70 text-paper backdrop-blur-sm transition-colors hover:bg-navy"
        >
          {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
        </button>
      ) : null}
    </>
  );
}
