"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { BotIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Conversation } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AskAiMessageActions } from "@/features/ask-ai/components/ask-ai-message-actions";
import { AskAiSources } from "@/features/ask-ai/components/ask-ai-sources";
import type {
  AskAiFeedbackRating,
  AskAiMessage,
} from "@/features/ask-ai/lib/types";

export function AskAiDrawer({
  open,
  onOpenChange,
  pageName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageName: string;
}) {
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Record<string, AskAiFeedbackRating>>(
    {},
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AskAiMessage>({
        api: "/api/ask-ai/chat",
        body: { pageName },
        credentials: "same-origin",
      }),
    [pageName],
  );
  const { id, messages, sendMessage, regenerate, setMessages, status, error } =
    useChat<AskAiMessage>({
      transport,
    });
  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const value = input.trim();

    if (!value || busy) {
      return;
    }

    setInput("");
    await sendMessage({ text: value });
  }

  async function clear() {
    setMessages([]);
    setFeedback({});
    await fetch("/api/ask-ai/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatSessionId: id, pageName }),
    });
    toast.success("Conversation cleared");
  }

  async function submitFeedback(
    messageId: string,
    rating: AskAiFeedbackRating,
  ) {
    setFeedback((current) => ({ ...current, [messageId]: rating }));
    const response = await fetch("/api/ask-ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });

    if (!response.ok) {
      toast.error("Feedback could not be saved");
      return;
    }

    toast.success("Feedback saved");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100vw,28rem)] gap-0 p-0 sm:max-w-[28rem]"
      >
        <SheetHeader className="border-border border-b">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <BotIcon aria-hidden />
            </div>
            <div className="min-w-0">
              <SheetTitle>Ask AI</SheetTitle>
              <SheetDescription>
                Answers are grounded in the AutoHire knowledge base.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Conversation>
          {messages.length === 0 && (
            <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-4 text-sm leading-6">
              Ask about the application process, resume review, supplemental
              information, or supporting materials.
            </div>
          )}

          {messages.map((message) => {
            const text = getMessageText(message);
            const isAssistant = message.role === "assistant";

            return (
              <div key={message.id}>
                <Message from={message.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    {isAssistant ? (
                      <Response>{text || "Thinking..."}</Response>
                    ) : (
                      <p>{text}</p>
                    )}
                  </MessageContent>
                </Message>
                {isAssistant && (
                  <div className="ml-0">
                    <AskAiSources message={message} />
                    <AskAiMessageActions
                      messageId={message.id}
                      content={text}
                      feedback={feedback[message.id]}
                      onFeedback={submitFeedback}
                      onRegenerate={() => regenerate()}
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {error.message}
            </div>
          )}
        </Conversation>

        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={submit}
          disabled={busy}
          placeholder="Ask about AutoHire documents..."
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            disabled={messages.length === 0 || busy}
            aria-label="Clear conversation"
          >
            <Trash2Icon />
          </Button>
          <PromptInputSubmit disabled={!input.trim() || busy}>
            <SendIcon data-icon="inline-start" />
            Send
          </PromptInputSubmit>
        </PromptInput>
      </SheetContent>
    </Sheet>
  );
}

function getMessageText(message: AskAiMessage) {
  return message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("");
}
