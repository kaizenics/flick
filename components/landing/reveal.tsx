"use client";

import { useEffect } from "react";

// Rises each [data-reveal] once as it enters; content stays visible without JS or with reduced motion.
export function Reveal() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.opacity = "1";
          el.style.transform = "none";
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    for (const el of els) {
      const section = el.closest("section, footer") ?? document.body;
      const i = Array.from(section.querySelectorAll("[data-reveal]")).indexOf(el);
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
      el.style.transition = `opacity 700ms cubic-bezier(.2,.7,.2,1) ${i * 80}ms, transform 900ms cubic-bezier(.2,.7,.2,1) ${i * 80}ms`;
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
