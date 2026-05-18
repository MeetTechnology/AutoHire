"use client";

import { BotIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AskAiDrawer } from "@/features/ask-ai/components/ask-ai-drawer";

export function AskAiEntry({ pageName }: { pageName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className="fixed right-4 bottom-4 z-40 h-11 rounded-full px-4 shadow-lg md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <BotIcon data-icon="inline-start" />
        Ask AI
      </Button>
      <AskAiDrawer open={open} onOpenChange={setOpen} pageName={pageName} />
    </>
  );
}
