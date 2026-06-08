"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-syncs the active App Router route after browser back/forward navigation.
 * Soft history restores can leave cached client trees (including motion state)
 * out of date with the URL until a hard refresh.
 */
export function BrowserNavigationRecovery({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const router = useRouter();

  useEffect(() => {
    function handlePopState() {
      router.refresh();
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        router.refresh();
      }
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return children;
}
