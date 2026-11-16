"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function MotionController() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("motion-ready");
    const elements = document.querySelectorAll<HTMLElement>(".scroll-reveal:not(.is-visible)");
    const observer = new IntersectionObserver((entries) => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
