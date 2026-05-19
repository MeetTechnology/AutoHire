"use client";

import { CompassIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AskAiDrawer } from "@/features/ask-ai/components/ask-ai-drawer";

export function AskAiEntry({ pageName }: { pageName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className="fixed right-4 bottom-4 z-40 h-11 rounded-full border border-white/35 bg-[#0a192f] px-3.5 text-white shadow-[0_18px_45px_rgba(10,25,47,0.24)] hover:bg-[#10233f] md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/18 text-emerald-200">
          <CompassIcon aria-hidden />
        </span>
        <span className="pr-0.5">Guidance</span>
      </Button>
      <AskAiDrawer open={open} onOpenChange={setOpen} pageName={pageName} />
    </>
  );
}
