"use client";

import { FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Response } from "@/components/ai-elements/response";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type SourcePreviewState =
  | { status: "loaded"; token: string; title: string; markdown: string }
  | {
      status: "error";
      token: string;
      title: string;
      markdown: "";
      message: string;
    };

export function SourcePreviewDialog({
  preview,
  onOpenChange,
}: {
  preview?: { token: string; title?: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<SourcePreviewState | null>(null);
  const open = Boolean(preview);
  const activeState = preview && state?.token === preview.token ? state : null;
  const title = activeState?.title ?? preview?.title ?? "Source preview";
  const status = preview && activeState ? activeState.status : "loading";

  useEffect(() => {
    if (!preview) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/ask-ai/source-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: preview.token }),
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          title?: string;
          markdown?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error ?? "Source preview could not be loaded.");
        }

        setState({
          status: "loaded",
          token: preview.token,
          title: body.title ?? preview.title ?? "Source preview",
          markdown: body.markdown ?? "",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          token: preview.token,
          title: preview.title ?? "Source preview",
          markdown: "",
          message:
            error instanceof Error
              ? error.message
              : "Source preview could not be loaded.",
        });
      });

    return () => controller.abort();
  }, [preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
              <FileTextIcon aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{title}</DialogTitle>
              <DialogDescription>Internal source preview</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="h-full min-h-0 flex-1 px-5 pb-5">
          <div className="border-border bg-background min-h-48 rounded-lg border p-4">
            {status === "loading" && (
              <div
                className="text-muted-foreground flex items-center gap-2 text-sm"
                role="status"
              >
                <LoaderCircleIcon className="animate-spin" aria-hidden />
                Loading source preview...
              </div>
            )}
            {status === "error" && activeState?.status === "error" && (
              <p className="text-destructive text-sm">{activeState.message}</p>
            )}
            {status === "loaded" &&
              activeState?.status === "loaded" &&
              (activeState.markdown ? (
                <Response>{activeState.markdown}</Response>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No preview content is available.
                </p>
              ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
