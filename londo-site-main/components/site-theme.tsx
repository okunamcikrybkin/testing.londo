"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { ServerArtwork } from "@/components/server-artwork";

/** Visual shell only: children retain their server-side data and access checks. */
export function SiteTheme({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const isolatedPreview = pathname === "/design-preview" || pathname?.startsWith("/design-preview/");

  useEffect(() => {
    const content = contentRef.current;
    if (!content || isolatedPreview || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(content.querySelectorAll<HTMLElement>(
      "main > *, main article, main [class*='card'], main [class*='Card'], main [class*='panel'], main [class*='Panel']",
    )).slice(0, 80);
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = entry.target as HTMLElement;
        observer.unobserve(item);
        if (typeof item.animate !== "function") continue;
        const animation = item.animate(
          [
            { opacity: 0, transform: "translate3d(0, 14px, 0)" },
            { opacity: 1, transform: "translate3d(0, 0, 0)" },
          ],
          { duration: 560, delay: Math.min(items.indexOf(item), 8) * 45, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
        );
        animation.onfinish = () => animation.cancel();
      }
    }, { threshold: 0.04, rootMargin: "0px 0px -24px 0px" });

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [pathname, isolatedPreview]);

  if (isolatedPreview && !guest) return <>{children}</>;
  return <div className="londo-site-theme" data-guest={guest ? "true" : undefined}>
    <div className="londo-site-artwork" aria-hidden="true"><ServerArtwork /></div>
    <div className="londo-site-content" ref={contentRef}>{children}</div>
  </div>;
}
