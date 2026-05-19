import type { UIMessage } from "ai";

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

type AskAiDataParts = {
  "ask-ai-progress": AskAiProgress;
};

export type AskAiMessage = UIMessage<unknown, AskAiDataParts>;

export type AskAiFeedbackRating = "UP" | "DOWN";
