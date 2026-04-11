import { ApplyEntryClient } from "@/features/application/components/apply-entry-client";

type ApplyEntryPageProps = {
  searchParams: Promise<{ t?: string }>;
};

export default async function ApplyEntryPage({
  searchParams,
}: ApplyEntryPageProps) {
  const resolvedSearchParams = await searchParams;

  return <ApplyEntryClient token={resolvedSearchParams.t ?? null} />;
}
