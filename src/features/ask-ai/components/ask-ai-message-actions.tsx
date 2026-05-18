"use client";

import {
  CopyIcon,
  RotateCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ActionButton, Actions } from "@/components/ai-elements/actions";
import type { AskAiFeedbackRating } from "@/features/ask-ai/lib/types";

export function AskAiMessageActions({
  messageId,
  content,
  feedback,
  onFeedback,
  onRegenerate,
  disabled,
}: {
  messageId: string;
  content: string;
  feedback?: AskAiFeedbackRating;
  onFeedback: (messageId: string, rating: AskAiFeedbackRating) => void;
  onRegenerate: () => void;
  disabled?: boolean;
}) {
  async function copy() {
    await navigator.clipboard.writeText(content);
    toast.success("Copied");
  }

  return (
    <Actions>
      <ActionButton label="Copy answer" onClick={copy} disabled={!content}>
        <CopyIcon />
      </ActionButton>
      <ActionButton
        label="Regenerate answer"
        onClick={onRegenerate}
        disabled={disabled}
      >
        <RotateCcwIcon />
      </ActionButton>
      <ActionButton
        label="Helpful"
        onClick={() => onFeedback(messageId, "UP")}
        pressed={feedback === "UP"}
      >
        <ThumbsUpIcon />
      </ActionButton>
      <ActionButton
        label="Not helpful"
        onClick={() => onFeedback(messageId, "DOWN")}
        pressed={feedback === "DOWN"}
      >
        <ThumbsDownIcon />
      </ActionButton>
    </Actions>
  );
}
