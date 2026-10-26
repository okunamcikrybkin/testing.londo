"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function AccessRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
