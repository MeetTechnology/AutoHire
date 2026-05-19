import type { UIMessage } from "ai";

export type AskAiMode = "mock" | "live";

export type AskAiFeedbackRating = "UP" | "DOWN";

export type AskAiSource = {
  sourceId: string;
  title: string;
  url?: string | null;
  previewToken?: string | null;
  sectionTitle?: string | null;
  chunkText?: string | null;
  score?: number | null;
  rank?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type AskAiProgressStage =
  | "received"
  | "retrieving"
  | "reasoning"
  | "generating"
  | "finalizing";

export type AskAiProgress = {
  stage: AskAiProgressStage;
  label: string;
  source: "aliyun" | "mock" | "system";
};

export type AskAiStreamEvent =
  | {
      type: "source";
      source: AskAiSource;
    }
  | {
      type: "progress";
      progress: AskAiProgress;
    }
  | {
      type: "text-delta";
      text: string;
    }
  | {
      type: "finish";
      aliyunSessionId?: string | null;
      aliyunRequestId?: string | null;
      usage?: Record<string, unknown> | null;
      rawResponse?: Record<string, unknown> | null;
    };

export type AskAiChatRequest = {
  chatSessionId: string;
  messages: UIMessage[];
  question: string;
  aliyunSessionId?: string | null;
  applicationId?: string | null;
  pageName?: string | null;
  locale: string;
  signal?: AbortSignal;
};

export type AskAiTraceContext = {
  chatSessionId: string;
  applicationId?: string | null;
  pageName?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
};

export type AskAiPersistAnswerInput = AskAiTraceContext & {
  userMessageId: string;
  assistantMessageId: string;
  question: string;
  answer: string;
  sources: AskAiSource[];
  aliyunSessionId?: string | null;
  aliyunRequestId?: string | null;
  latencyMs?: number | null;
  tokenUsage?: Record<string, unknown> | null;
  rawResponse?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};
