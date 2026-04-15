import { ApplyEntryClient } from "@/features/application/components/apply-entry-client";
import { resolveInviteTokenFromNextSearchParams } from "@/features/application/invite-url-token";

type ApplyEntryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplyEntryPage({
  searchParams,
}: ApplyEntryPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <ApplyEntryClient
      token={resolveInviteTokenFromNextSearchParams(resolvedSearchParams)}
    />
  );
}
