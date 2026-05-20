"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "motion/react";
import {
  ClipboardCheckIcon,
  CompassIcon,
  FileTextIcon,
  HistoryIcon,
  ListChecksIcon,
  PaperclipIcon,
  SearchCheckIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
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
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AskAiMessageActions } from "@/features/ask-ai/components/ask-ai-message-actions";
import { AskAiSources } from "@/features/ask-ai/components/ask-ai-sources";
import { SourcePreviewDialog } from "@/features/ask-ai/components/source-preview-dialog";
import type {
  AskAiFeedbackRating,
  AskAiHistoryItem,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<AskAiHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
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
  const {
    id,
    messages,
    sendMessage,
    regenerate,
    setMessages,
    status: chatStatus,
    error,
  } = useChat<AskAiMessage>({
    transport,
    onData(dataPart) {
      if (dataPart.type === "data-ask-ai-progress") {
        setActiveProgress(dataPart.data);
      }
    },
  });
  const busy = chatStatus === "submitted" || chatStatus === "streaming";
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

  useEffect(() => {
    if (!historyOpen || historyStatus !== "loading") {
      return;
    }

    const controller = new AbortController();

    fetch("/api/ask-ai/history?limit=20", {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          items?: AskAiHistoryItem[];
        };

        if (!response.ok) {
          throw new Error("History could not be loaded");
        }

        setHistoryItems(body.items ?? []);
        setHistoryStatus("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistoryStatus("error");
        }
      });

    return () => controller.abort();
  }, [historyOpen, historyStatus]);

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
    setHistoryOpen(false);
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

  function toggleHistory() {
    if (!historyOpen) {
      setHistoryStatus("loading");
    }

    setHistoryOpen((value) => !value);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setHistoryOpen(false);
    }

    onOpenChange(nextOpen);
  }

  function restoreHistoryItem(item: AskAiHistoryItem) {
    setMessages([
      {
        id: item.userMessageId,
        role: "user",
        parts: [{ type: "text", text: item.question }],
      },
      {
        id: item.assistantMessageId,
        role: "assistant",
        parts: [
          ...item.sources.map((source) => ({
            type: "data-ask-ai-source" as const,
            id: source.sourceId,
            data: source,
          })),
          { type: "text" as const, text: item.answer },
        ],
      },
    ]);
    setHistoryOpen(false);
    setActiveProgress(undefined);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:w-full data-[side=right]:max-w-full gap-0 overflow-hidden border-l border-slate-200/80 bg-card p-0 sm:data-[side=right]:w-[30rem] sm:data-[side=right]:max-w-[30rem]"
      >
        <SheetHeader className="border-border/80 w-full shrink-0 border-b bg-card px-4 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <SheetTitle className="sr-only">Application guidance</SheetTitle>
          <div className="flex min-h-9 items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant={historyOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    aria-label="历史记录"
                    aria-pressed={historyOpen}
                    onClick={toggleHistory}
                  />
                }
              >
                <HistoryIcon aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="bottom">历史记录</TooltipContent>
            </Tooltip>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close"
                />
              }
            >
              <XIcon aria-hidden />
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <Conversation className="min-w-0">
            {messages.length === 0 && (
              <AskAiEmptyState onPrompt={sendPrompt} disabled={busy} />
            )}

            {messages.map((message) => {
              const text = getMessageText(message);
              const isAssistant = message.role === "assistant";

              return (
                <div key={message.id}>
                  <Message
                    from={message.role === "user" ? "user" : "assistant"}
                  >
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
          <AskAiHistoryOverlay
            open={historyOpen}
            status={historyStatus}
            items={historyItems}
            onSelect={restoreHistoryItem}
            onRetry={() => {
              setHistoryStatus("loading");
            }}
          />
        </div>

        <div className="shrink-0 w-full">
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
        </div>
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

function AskAiHistoryOverlay({
  open,
  status,
  items,
  onSelect,
  onRetry,
}: {
  open: boolean;
  status: "idle" | "loading" | "loaded" | "error";
  items: AskAiHistoryItem[];
  onSelect: (item: AskAiHistoryItem) => void;
  onRetry: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ask-ai-history"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute inset-0 z-20 bg-slate-950/10 p-3 backdrop-blur-[3px]"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="border-border/80 bg-card/95 flex max-h-full min-h-0 flex-col overflow-hidden rounded-lg border shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          >
            <div className="border-border/70 flex items-center justify-between gap-3 border-b px-3 py-2">
              <p className="text-foreground text-sm font-medium">历史记录</p>
              <p className="text-muted-foreground text-xs">最近 20 条</p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-1 p-2">
                {status === "loading" &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-muted/70 h-10 rounded-md"
                      aria-hidden
                    />
                  ))}
                {status === "error" && (
                  <div className="flex flex-col items-start gap-2 p-3 text-sm">
                    <p className="text-muted-foreground">历史记录加载失败。</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                    >
                      重试
                    </Button>
                  </div>
                )}
                {status === "loaded" && items.length === 0 && (
                  <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                    暂无历史记录
                  </p>
                )}
                {status === "loaded" &&
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="hover:bg-muted/80 focus-visible:ring-ring/50 grid min-h-10 grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                      onClick={() => onSelect(item)}
                    >
                      <span className="text-foreground truncate text-sm">
                        {item.question}
                      </span>
                      <span className="text-muted-foreground justify-self-end text-right text-xs whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "刚刚";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}天前`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}个月前`;
  }

  return `${Math.floor(months / 12)}年前`;
}
