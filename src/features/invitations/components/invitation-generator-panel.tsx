"use client";

import { useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InviteHashAlgorithm } from "@/lib/auth/token";
import type { InvitationGenerationBatchSummary } from "@/lib/invitations/generation";

import { InvitationBatchGuaranteesCard } from "./invitation-batch-guarantees-card";
import { InvitationBatchResultCard } from "./invitation-batch-result-card";
import { InvitationGeneratorForm } from "./invitation-generator-form";
import {
  createDefaultIdempotencyKey,
  getAlgorithmDescription,
} from "./invitation-generator-options";
import { readGenerateResponse } from "./invitation-generator-response";

export function InvitationGeneratorPanel() {
  const [algorithm, setAlgorithm] = useState<InviteHashAlgorithm>("SHA256");
  const [count, setCount] = useState("100");
  const [expiredDays, setExpiredDays] = useState("90");
  const [idempotencyKey, setIdempotencyKey] = useState(
    createDefaultIdempotencyKey,
  );
  const [batch, setBatch] = useState<InvitationGenerationBatchSummary | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const selectedDescription = useMemo(
    () => getAlgorithmDescription(algorithm),
    [algorithm],
  );
  const exportFilename = batch
    ? `invitation-tokens-${batch.id}.xlsx`
    : "invitation-tokens.xlsx";

  async function generateBatch() {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ops/invitations/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          algorithm,
          count: Number(count),
          expiredDays: Number(expiredDays),
          idempotencyKey,
        }),
      });
      const payload = await readGenerateResponse(response);

      setBatch(payload.batch);
      toast.success("Invitation tokens are ready.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Invitation generation failed.";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportBatch() {
    if (!batch) {
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch(
        `/api/ops/invitations/batches/${encodeURIComponent(batch.id)}/export`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw new Error("Excel export failed.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = exportFilename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      toast.success("Excel export downloaded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Excel export failed.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="text-foreground min-h-screen bg-[radial-gradient(circle_at_top_left,var(--muted),transparent_32rem),linear-gradient(135deg,var(--background),var(--secondary))] px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-foreground/10 bg-background/85 overflow-hidden shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <KeyRound data-icon="inline-start" />
                Invitation Token Forge
              </CardTitle>
              <CardDescription>
                Generate idempotent invitation batches for email operations. Raw
                tokens are retained only inside protected generation batches.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">ops protected</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <InvitationGeneratorForm
                algorithm={algorithm}
                count={count}
                expiredDays={expiredDays}
                idempotencyKey={idempotencyKey}
                isGenerating={isGenerating}
                selectedDescription={selectedDescription}
                onAlgorithmChange={setAlgorithm}
                onCountChange={setCount}
                onExpiredDaysChange={setExpiredDays}
                onGenerate={() => void generateBatch()}
                onIdempotencyKeyChange={setIdempotencyKey}
              />
            </CardContent>
          </Card>

          <InvitationBatchGuaranteesCard />
        </section>

        {batch ? (
          <InvitationBatchResultCard
            batch={batch}
            isExporting={isExporting}
            onExport={() => void exportBatch()}
          />
        ) : null}
      </div>
    </main>
  );
}
