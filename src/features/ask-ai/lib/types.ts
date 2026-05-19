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

export type AskAiSourcePart = {
  sourceId: string;
  title: string;
  previewToken: string;
};

type AskAiDataParts = {
  "ask-ai-progress": AskAiProgress;
  "ask-ai-source": AskAiSourcePart;
};

export type AskAiMessage = UIMessage<unknown, AskAiDataParts>;

export type AskAiFeedbackRating = "UP" | "DOWN";
