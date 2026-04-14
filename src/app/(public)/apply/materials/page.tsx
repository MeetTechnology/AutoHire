"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  ActionButton,
  DisclosureSection,
  MetaStrip,
  MobileSupportCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
} from "@/components/ui/page-shell";
import { MaterialCategoryGuidance } from "@/features/application/components/material-category-guidance";
import { MATERIAL_CATEGORIES } from "@/features/application/constants";
import {
  confirmMaterialUpload,
  createMaterialUploadIntent,
  deleteMaterial,
  fetchMaterials,
  fetchSession,
  type MaterialsResponse,
  submitApplicationRequest,
  uploadBinary,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  getReachableFlowStep,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type {
  ApplicationSnapshot,
  MaterialCategory,
} from "@/features/application/types";

const REQUIRED_CATEGORIES: Array<{
  key: Lowercase<MaterialCategory>;
  label: string;
}> = [
  { key: "identity", label: "Identity documents" },
  { key: "education", label: "Doctoral education evidence" },
  { key: "employment", label: "Latest employment evidence" },
];
const FLOW_STEP_LINKS = [
  "/apply",
  "/apply/resume",
  "/apply/result?view=review",
  "/apply/result?view=additional",
  "/apply/materials",
] as const;

function getMailtoHref() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `mailto:?subject=${encodeURIComponent("Continue my GESF application")}&body=${encodeURIComponent(window.location.href)}`;
}

export default function MaterialsPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [materials, setMaterials] = useState<MaterialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (
          !["MATERIALS_IN_PROGRESS", "SUBMITTED"].includes(
            nextSnapshot.applicationStatus,
          )
        ) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
        setMaterials(await fetchMaterials(nextSnapshot.applicationId));
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the uploaded materials.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    setMailtoHref(getMailtoHref());
  }, []);

  function handleUpload(category: MaterialCategory, files: FileList | null) {
    if (!snapshot || !files?.length) {
      return;
    }

    const nextFiles = Array.from(files);

    startTransition(async () => {
      try {
        setError(null);
        setNotice(null);

        for (const file of nextFiles) {
          const intent = await createMaterialUploadIntent(
            snapshot.applicationId,
            category,
            file,
          );
          await uploadBinary(intent, file);
          await confirmMaterialUpload(
            snapshot.applicationId,
            category,
            file,
            intent.objectKey,
          );
        }

        setMaterials(await fetchMaterials(snapshot.applicationId));
        setSnapshot(await fetchSession());
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Material upload failed.",
        );
      }
    });
  }

  function handleDelete(fileId: string) {
    if (!snapshot) {
      return;
    }

    startTransition(async () => {
      try {
        setMaterials(await deleteMaterial(snapshot.applicationId, fileId));
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to delete the material.",
        );
      }
    });
  }

  function handleSubmit() {
    if (!snapshot) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await submitApplicationRequest(snapshot.applicationId);
        setSnapshot(await fetchSession());
        setNotice(response.message);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Submission failed.",
        );
      }
    });
  }

  const missingRequiredCategories = REQUIRED_CATEGORIES.filter(
    (category) => (materials?.[category.key]?.length ?? 0) < 1,
  );
  const minimumRequirementsMet = missingRequiredCategories.length === 0;
  const isSubmitted = snapshot?.applicationStatus === "SUBMITTED";
  const uploadedCount = useMemo(
    () =>
      materials
        ? Object.values(materials).reduce(
            (count, records) => count + records.length,
            0,
          )
        : 0,
    [materials],
  );

  return (
    <PageFrame>
      <PageShell
        eyebrow="Step 5"
        title={
          isSubmitted
            ? "Your application package has been received."
            : "Complete the final package and confirm submission."
        }
        description={
          isSubmitted
            ? "The final page now acts as a compact tracking dashboard with your application number, expected review timing, and uploaded evidence summary."
            : "Upload the remaining supporting materials, satisfy the minimum categories, and then convert the application into a completed review package."
        }
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={4}
        stepIndexing="zero"
        stepLinks={FLOW_STEP_LINKS}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 4
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {snapshot ? (
            <MetaStrip
              items={[
                {
                  label: "Application number",
                  value: snapshot.applicationId,
                },
                {
                  label: "Estimated review time",
                  value: "1-3 business days",
                },
              ]}
            />
          ) : null}

          {!isSubmitted ? <MobileSupportCard href={mailtoHref} /> : null}

          {notice || isSubmitted ? (
            <StatusBanner
              tone="success"
              title="Your materials have been received"
              description={
                notice ??
                "We have received your materials and will respond within 1 to 3 business days."
              }
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="A materials action could not be completed"
              description={error}
            />
          ) : null}

          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading uploaded materials"
              description="Restoring the saved file summary for each category."
            />
          ) : null}

          {isSubmitted ? (
            <SectionCard
              title="Application complete"
              description="The flow has reached its final state. Uploaded evidence remains visible below for tracking and reference."
            >
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2
                  className="h-10 w-10 text-[color:var(--accent)]"
                  aria-hidden
                />
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
                    Congratulations on completing your application
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    Your application has entered the asynchronous review stage.
                    Keep this page for reference if you need the application
                    number or a snapshot of the submitted evidence package.
                  </p>
                </div>
                <MetaStrip
                  items={[
                    {
                      label: "Application Number",
                      value: snapshot?.applicationId ?? "Unavailable",
                    },
                    {
                      label: "Estimated Review Time",
                      value: "1-3 business days",
                    },
                    {
                      label: "Evidence Summary",
                      value: `${uploadedCount} uploaded files`,
                    },
                  ]}
                />
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Upload by category"
            description={
              isSubmitted
                ? "The submitted package remains grouped by category for easy review."
                : "Attach one or more files per category. Identity documents, doctoral education evidence, and latest employment evidence are mandatory before final confirmation."
            }
          >
            <div className="space-y-3">
              {MATERIAL_CATEGORIES.map((category) => {
                const categoryKey =
                  category.key.toLowerCase() as Lowercase<MaterialCategory>;
                const records = materials?.[categoryKey] ?? [];
                const isRequiredCategory = REQUIRED_CATEGORIES.some(
                  (item) => item.key === categoryKey,
                );
                const requirementMet = records.length > 0;

                return (
                  <DisclosureSection
                    key={category.key}
                    title={category.label}
                    summary={
                      isSubmitted
                        ? "Read-only uploaded evidence for this category."
                        : "Expand to review guidance, upload files, and manage the current list."
                    }
                    defaultOpen={isRequiredCategory && !requirementMet && !isSubmitted}
                    meta={
                      <div className="flex flex-wrap items-center gap-2">
                        {isRequiredCategory ? (
                          <span className="inline-flex rounded-full border border-[color:var(--accent)] bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-[color:var(--accent)] uppercase">
                            Required
                          </span>
                        ) : null}
                        <span className="inline-flex rounded-full border border-[color:var(--border)] bg-white px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-[color:var(--primary)] uppercase">
                          {records.length} file{records.length === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex rounded-full border border-[color:var(--border)] bg-white px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-slate-600 uppercase">
                          {requirementMet ? "Ready" : "Pending"}
                        </span>
                      </div>
                    }
                  >
                    <div className="space-y-4">
                      <div className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                        <MaterialCategoryGuidance category={category.key} />
                      </div>

                      {isRequiredCategory && !requirementMet && !isSubmitted ? (
                        <div className="rounded-xl border border-[color:var(--border-strong)] bg-white px-4 py-3 text-sm text-[color:var(--foreground-soft)]">
                          Upload at least one file in this category to unlock
                          final confirmation.
                        </div>
                      ) : null}

                      {!isSubmitted ? (
                        <label className="block">
                          <input
                            type="file"
                            multiple
                            disabled={isPending}
                            onChange={(event) =>
                              handleUpload(category.key, event.target.files)
                            }
                            className="sr-only"
                          />
                          <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-white px-4 py-4 text-center transition hover:border-[color:var(--primary)] hover:bg-slate-50">
                            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                              Add files
                            </p>
                            <p className="mt-1 text-sm font-medium text-[color:var(--primary)]">
                              Select one or more files
                            </p>
                          </div>
                        </label>
                      ) : null}

                      <div className="space-y-2">
                        {records.map((record) => (
                          <div
                            key={record.id}
                            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate">{record.fileName}</span>
                              {!isSubmitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(record.id)}
                                  className="text-xs font-medium text-[color:var(--accent)] transition hover:text-[#14532d]"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {records.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-3 text-xs tracking-[0.12em] text-slate-500 uppercase">
                            No files uploaded yet
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </DisclosureSection>
                );
              })}
            </div>
          </SectionCard>

          {!isSubmitted ? (
            <SectionCard
              title="Final submission"
              description="Confirm only when the evidence package is complete enough for review."
            >
              <div className="space-y-4">
                <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                  You may upload evidence in multiple rounds before final
                  confirmation. Once submitted, the page becomes a tracking
                  dashboard and further edits are disabled.
                </p>
                {!minimumRequirementsMet ? (
                  <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--muted)] px-4 py-3 text-sm text-[color:var(--foreground)]">
                    <p className="font-medium">
                      Final submission is locked until the minimum files are
                      uploaded.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--foreground-soft)]">
                      Missing:{" "}
                      {missingRequiredCategories
                        .map((category) => category.label)
                        .join(", ")}
                    </p>
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <ActionButton
                    onClick={handleSubmit}
                    disabled={isPending || isLoading || !minimumRequirementsMet}
                    className="w-full sm:w-auto"
                  >
                    Confirm Submission
                  </ActionButton>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
