import { ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InvitationBatchGuaranteesCard() {
  return (
    <Card className="border-foreground/10 bg-foreground text-background shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck data-icon="inline-start" />
          Batch guarantees
        </CardTitle>
        <CardDescription className="text-background/70">
          Every plaintext token is 64 random hex characters. Only its selected
          hash is used by public invite validation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="bg-background/10 rounded-lg p-3">
          Idempotency key collision is treated as a replay, not a new generation.
        </div>
        <div className="bg-background/10 rounded-lg p-3">
          Exported Excel is generated from the stored batch details, so retries
          are stable.
        </div>
      </CardContent>
    </Card>
  );
}
