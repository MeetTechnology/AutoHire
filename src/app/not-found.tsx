"use client";

import { useRouter } from "next/navigation";
import { Home } from "lucide-react";

import { PageFrame, ActionButton } from "@/components/ui/page-shell";
import { Badge } from "@/components/ui/badge";

export default function NotFound() {
  const router = useRouter();

  return (
    <PageFrame maxWidth="4xl">
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 py-20 text-center">
        <div className="space-y-6">
          <Badge variant="outline" className="text-xs">
            Error 404
          </Badge>
          <h1 className="text-[5rem] font-bold leading-none tracking-[-0.04em] text-[color:var(--primary)] sm:text-[7rem]">
            404
          </h1>
        </div>

        <div className="max-w-md space-y-3">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
            Page Not Found
          </h2>
          <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
            The page you are looking for does not exist or has been moved.
            Please check the URL or return to the application entry.
          </p>
        </div>

        <ActionButton onClick={() => router.push("/apply")}>
          <Home className="h-4 w-4" aria-hidden />
          <span>Back to Application</span>
        </ActionButton>
      </div>
    </PageFrame>
  );
}
