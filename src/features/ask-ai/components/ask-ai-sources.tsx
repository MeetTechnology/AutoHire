import { Sources, type SourceItem } from "@/components/ai-elements/sources";
import type { AskAiMessage } from "@/features/ask-ai/lib/types";

export function AskAiSources({
  message,
  onPreviewSource,
}: {
  message: AskAiMessage;
  onPreviewSource: (token: string, title?: string) => void;
}) {
  const sources = extractSources(message);

  return <Sources sources={sources} onPreviewSource={onPreviewSource} />;
}

export function extractSources(message: AskAiMessage): SourceItem[] {
  return message.parts
    .map((part): SourceItem | null => {
      if (part.type !== "data-ask-ai-source") {
        return null;
      }

      return {
        id: part.data.sourceId,
        title: part.data.title,
        previewToken: part.data.previewToken,
      };
    })
    .filter((source): source is SourceItem => Boolean(source));
}
