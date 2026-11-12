"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Visual shell only: children retain their server-side data and access checks. */
export function SiteTheme({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const pathname = usePathname();
  const isolatedPreview = pathname === "/design-preview" || pathname?.startsWith("/design-preview/");

  if (isolatedPreview && !guest) return <>{children}</>;
  return <div className="londo-site-theme" data-guest={guest ? "true" : undefined}>
    <div className="londo-site-content">{children}</div>
  </div>;
}
