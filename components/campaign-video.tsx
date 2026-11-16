"use client";

import { useEffect, useRef, useState } from "react";

type CampaignVideoProps = {
  src: string;
  poster?: string;
  fallback: React.ReactNode;
  label: string;
  eager?: boolean;
  className?: string;
};

/** One campaign clip at a time: load only in view and keep a static fallback for reduced motion or playback errors. */
export function CampaignVideo({ src, poster, fallback, label, eager = false, className = "" }: CampaignVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [inView, setInView] = useState(eager);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setMotionAllowed(!preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!("IntersectionObserver" in window)) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [eager]);

  const shouldPlay = Boolean(src && motionAllowed && inView && !failed);

  return <div ref={frameRef} className={`campaign-media ${className}`} role="img" aria-label={label}>
    <div className="campaign-media__fallback" aria-hidden="true">{fallback}</div>
    {shouldPlay && <video
      className="campaign-video"
      data-campaign-video="true"
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      aria-hidden="true"
      onPlay={(event) => {
        document.querySelectorAll<HTMLVideoElement>("video[data-campaign-video='true']").forEach((video) => {
          if (video !== event.currentTarget) video.pause();
        });
      }}
      onError={() => setFailed(true)}
    />}
  </div>;
}
