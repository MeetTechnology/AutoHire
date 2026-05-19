"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  ClipboardCheckIcon,
  CompassIcon,
  FileTextIcon,
  ListChecksIcon,
  PaperclipIcon,
  SearchCheckIcon,
  SendIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AskAiMessageActions } from "@/features/ask-ai/components/ask-ai-message-actions";
import { AskAiSources } from "@/features/ask-ai/components/ask-ai-sources";
import { SourcePreviewDialog } from "@/features/ask-ai/components/source-preview-dialog";
import type {
  AskAiFeedbackRating,
  AskAiMessage,
  AskAiProgress,
} from "@/features/ask-ai/lib/types";

const STARTER_PROMPTS = [
  {
    label: "Application Steps",
    prompt:
      "Walk me through the full AutoHire application process and what I should prepare for each step.",
    icon: ListChecksIcon,
  },
  {
    label: "Resume Review",
    prompt:
      "What does the resume review stage usually focus on, and how can I strengthen my materials?",
    icon: ClipboardCheckIcon,
  },
  {
    label: "Supplemental Materials",
    prompt:
      "What should I submit during the supplemental materials step, and what is easy to miss?",
    icon: PaperclipIcon,
  },
  {
    label: "Supporting Files",
    prompt:
      "Which supporting files should I upload, and what should I consider for naming and content?",
    icon: FileTextIcon,
  },
  {
    label: "Status Check",
    prompt:
      "After submission, how can I understand my current application status and likely next steps?",
    icon: SearchCheckIcon,
  },
] as const;

const FALLBACK_PROGRESS: AskAiProgress[] = [
  {
    stage: "received",
    label: "Question received",
    source: "system",
  },
  {
    stage: "retrieving",
    label: "Reviewing relevant guidance",
    source: "system",
  },
  {
    stage: "reasoning",
    label: "Assessing your application context",
    source: "system",
  },
  {
    stage: "finalizing",
    label: "Preparing references",
    source: "system",
  },
];

const PROGRESS_LABELS: Record<AskAiProgress["stage"], string> = {
  received: "Question received",
  retrieving: "Reviewing relevant guidance",
  reasoning: "Assessing your application context",
  generating: "Drafting the response",
  finalizing: "Preparing references",
};

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
  const [activeProgress, setActiveProgress] = useState<AskAiProgress>();
  const [sourcePreview, setSourcePreview] = useState<{
    token: string;
    title?: string;
  } | null>(null);
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
      onData(dataPart) {
        if (dataPart.type === "data-ask-ai-progress") {
          setActiveProgress(dataPart.data);
        }
      },
    });
  const busy = status === "submitted" || status === "streaming";
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const latestAssistantText = latestAssistant
    ? getMessageText(latestAssistant)
    : "";
  const shouldShowProgress = busy && latestAssistantText.length === 0;

  useEffect(() => {
    if (!shouldShowProgress) {
      return;
    }

    const timers = FALLBACK_PROGRESS.slice(1).map((progress, index) =>
      window.setTimeout(
        () => {
          setActiveProgress((current) =>
            current?.source === "aliyun" ? current : progress,
          );
        },
        600 + index * 1600,
      ),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [shouldShowProgress]);

  async function sendPrompt(prompt: string) {
    const value = prompt.trim();

    if (!value || busy) {
      return;
    }

    setInput("");
    setActiveProgress(FALLBACK_PROGRESS[0]);
    await sendMessage({ text: value });
  }

  async function submit() {
    await sendPrompt(input);
  }

  async function clear() {
    setMessages([]);
    setFeedback({});
    setActiveProgress(undefined);
    const response = await fetch("/api/ask-ai/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatSessionId: id, pageName }),
    });

    if (!response.ok) {
      toast.error("Conversation could not be cleared");
      return;
    }

    toast.success("Conversation cleared");
  }

  async function submitFeedback(
    messageId: string,
    rating: AskAiFeedbackRating,
  ) {
    const previousRating = feedback[messageId];
    setFeedback((current) => ({ ...current, [messageId]: rating }));
    const response = await fetch("/api/ask-ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });

    if (!response.ok) {
      setFeedback((current) => {
        const next = { ...current };

        if (previousRating) {
          next[messageId] = previousRating;
        } else {
          delete next[messageId];
        }

        return next;
      });
      toast.error("Feedback could not be saved");
      return;
    }

    toast.success("Feedback saved");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100vw,30rem)] gap-0 overflow-hidden border-l border-slate-200/80 bg-[#f7f9fc] p-0 sm:max-w-[30rem]"
      >
        <SheetHeader className="border-border/80 bg-card/95 border-b px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0a192f] text-white shadow-[0_8px_20px_rgba(10,25,47,0.18)]">
              <CompassIcon aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">
                Application Guidance
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <Conversation>
          {messages.length === 0 && (
            <AskAiEmptyState onPrompt={sendPrompt} disabled={busy} />
          )}

          {messages.map((message) => {
            const text = getMessageText(message);
            const isAssistant = message.role === "assistant";

            return (
              <div key={message.id}>
                <Message from={message.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    {isAssistant ? (
                      text ? (
                        <Response
                          onPreviewSource={(token, title) =>
                            setSourcePreview({ token, title })
                          }
                        >
                          {text}
                        </Response>
                      ) : (
                        <AskAiProgressStatus
                          progress={
                            getMessageProgress(message) ??
                            activeProgress ??
                            FALLBACK_PROGRESS[0]
                          }
                        />
                      )
                    ) : (
                      <p>{text}</p>
                    )}
                  </MessageContent>
                </Message>
                {isAssistant && (
                  <div className="ml-0">
                    <AskAiSources
                      message={message}
                      onPreviewSource={(token, title) =>
                        setSourcePreview({ token, title })
                      }
                    />
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
          placeholder="Ask about applications, materials, or review steps..."
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
        <SourcePreviewDialog
          preview={sourcePreview}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSourcePreview(null);
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function AskAiEmptyState({
  onPrompt,
  disabled,
}: {
  onPrompt: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0a192f] via-emerald-600 to-sky-500"
          aria-hidden
        />
        <div className="flex items-start gap-3 pt-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
            <CompassIcon aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold">
              Start with a common scenario
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              Choose a prompt below or ask a question about your application.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((starterPrompt) => (
          <PromptChip
            key={starterPrompt.label}
            label={starterPrompt.label}
            icon={starterPrompt.icon}
            onClick={() => onPrompt(starterPrompt.prompt)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function PromptChip({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-auto min-h-11 justify-start gap-2 rounded-lg border-slate-200 bg-white px-3 py-2 text-left whitespace-normal text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover/button:bg-emerald-100 group-hover/button:text-emerald-800">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 leading-4">{label}</span>
    </Button>
  );
}

export function AskAiProgressStatus({ progress }: { progress: AskAiProgress }) {
  return (
    <div
      className="text-muted-foreground flex items-center gap-2 text-sm leading-6"
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/35" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
      </span>
      <span>{PROGRESS_LABELS[progress.stage] ?? progress.label}</span>
    </div>
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

function getMessageProgress(message: AskAiMessage) {
  return message.parts
    .map((part) => {
      if (part.type === "data-ask-ai-progress") {
        return part.data;
      }

      return null;
    })
    .filter((progress): progress is AskAiProgress => Boolean(progress))
    .at(-1);
}
