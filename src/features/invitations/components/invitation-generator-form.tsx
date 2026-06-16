import { RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { InviteHashAlgorithm } from "@/lib/auth/token";

import {
  ALGORITHM_OPTIONS,
  createDefaultIdempotencyKey,
  isInviteHashAlgorithm,
} from "./invitation-generator-options";

type InvitationGeneratorFormProps = {
  readonly algorithm: InviteHashAlgorithm;
  readonly count: string;
  readonly expiredDays: string;
  readonly idempotencyKey: string;
  readonly isGenerating: boolean;
  readonly selectedDescription: string;
  readonly onAlgorithmChange: (algorithm: InviteHashAlgorithm) => void;
  readonly onCountChange: (count: string) => void;
  readonly onExpiredDaysChange: (expiredDays: string) => void;
  readonly onIdempotencyKeyChange: (idempotencyKey: string) => void;
  readonly onGenerate: () => void;
};

export function InvitationGeneratorForm({
  algorithm,
  count,
  expiredDays,
  idempotencyKey,
  isGenerating,
  selectedDescription,
  onAlgorithmChange,
  onCountChange,
  onExpiredDaysChange,
  onIdempotencyKeyChange,
  onGenerate,
}: InvitationGeneratorFormProps) {
  return (
    <form
      className="grid gap-4 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Hash algorithm</span>
        <Select
          value={algorithm}
          onValueChange={(value) => {
            if (typeof value === "string" && isInviteHashAlgorithm(value)) {
              onAlgorithmChange(value);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ALGORITHM_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">
          {selectedDescription}
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Count</span>
        <Input
          min={1}
          max={1000}
          type="number"
          value={count}
          onChange={(event) => onCountChange(event.target.value)}
        />
        <span className="text-muted-foreground text-xs">
          Maximum 1000 per batch.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Expiry days</span>
        <Input
          min={1}
          max={3650}
          type="number"
          value={expiredDays}
          onChange={(event) => onExpiredDaysChange(event.target.value)}
        />
        <span className="text-muted-foreground text-xs">Default 90 days.</span>
      </label>

      <div className="flex items-end gap-2">
        <Button className="w-full" disabled={isGenerating} type="submit">
          {isGenerating ? <Spinner data-icon="inline-start" /> : null}
          Generate
        </Button>
      </div>

      <label className="flex flex-col gap-2 lg:col-span-3">
        <span className="text-sm font-medium">Idempotency key</span>
        <Input
          value={idempotencyKey}
          onChange={(event) => onIdempotencyKeyChange(event.target.value)}
        />
        <span className="text-muted-foreground text-xs">
          Reusing this key returns the same batch instead of creating new tokens.
        </span>
      </label>

      <div className="flex items-end">
        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={() => onIdempotencyKeyChange(createDefaultIdempotencyKey())}
        >
          <RefreshCcw data-icon="inline-start" />
          New key
        </Button>
      </div>
    </form>
  );
}
