import type { UIMessage } from "ai";

import { Sources, type SourceItem } from "@/components/ai-elements/sources";

export function AskAiSources({ message }: { message: UIMessage }) {
  const sources = extractSources(message);

  return <Sources sources={sources} />;
}

export function extractSources(message: UIMessage): SourceItem[] {
  return message.parts
    .map((part): SourceItem | null => {
      if (part.type !== "source-url") {
        return null;
      }

      return {
        id: part.sourceId,
        title: part.title ?? part.url,
        url: part.url,
      };
    })
    .filter((source): source is SourceItem => Boolean(source));
}
