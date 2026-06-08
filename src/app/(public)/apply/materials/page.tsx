"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ActionButton,
  DisclosureSection,
  MobileSupportCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
} from "@/components/ui/page-shell";
import { MaterialCategoryGuidance } from "@/features/application/components/material-category-guidance";
import { MaterialFileRow } from "@/features/application/components/material-file-row";
import { MATERIAL_CATEGORIES } from "@/features/application/constants";
import {
  deleteMaterial,
  enterMaterialsStage,
  fetchMaterials,
  fetchSession,
  type MaterialsResponse,
} from "@/features/application/client";
import { submitApplicationAction } from "@/features/application/actions";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  getConfirmedMaterialRecords,
  useMaterialUpload,
} from "@/features/application/hooks/use-material-upload";
import {
  buildApplyFlowStepLinks,
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type {
  ApplicationSnapshot,
  MaterialCategory,
} from "@/features/application/types";
import {
  trackClick,
  trackPageView,
  getOrCreateTrackingSessionId,
} from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";

const REQUIRED_CATEGORIES: Array<{
  key: Lowercase<MaterialCategory>;
  label: string;
}> = [
  { key: "identity", label: "Identity documents" },
  { key: "education", label: "Doctoral education evidence" },
  { key: "employment", label: "Latest employment evidence" },
];

function getMailtoHref() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `mailto:?subject=${encodeURIComponent("Continue my GESF application")}&body=${encodeURIComponent(window.location.href)}`;
}

function MaterialsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [materials, setMaterials] = useState<MaterialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);
  const hasTrackedPageView = useRef(false);
  const requestedView = searchParams.get("view");
  const isReviewRequest = requestedView === "review";

  usePageDurationTracking({
    pageName: "apply_materials",
    stepName: "materials",
    applicationId: snapshot?.applicationId,
  });

  const isFlowReadOnlyReview = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 2)
    : false;
  const canEditSubmittedReview = Boolean(
    snapshot?.applicationStatus === "SUBMITTED" && isReviewRequest,
  );
  const isReadOnlyReview = isFlowReadOnlyReview && !canEditSubmittedReview;

  const {
    optimisticMaterials,
    uploadFiles,
    uploadErrors,
    uploadStages,
    hasActiveUploads,
    isCategoryUploading,
    clearUploadErrors,
  } = useMaterialUpload({
    applicationId: snapshot?.applicationId ?? null,
    materials,
    setMaterials,
    disabled: isReadOnlyReview,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        let nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (
          nextSnapshot.applicationStatus === "ELIGIBLE" ||
          nextSnapshot.applicationStatus === "SECONDARY_REVIEW"
        ) {
          await enterMaterialsStage(nextSnapshot.applicationId);
          nextSnapshot = await fetchSession();

          if (!active) {
            return;
          }
        }

        if (
          nextSnapshot.applicationStatus === "SUBMITTED" &&
          !isReviewRequest
        ) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        if (
          nextSnapshot.applicationStatus !== "MATERIALS_IN_PROGRESS" &&
          nextSnapshot.applicationStatus !== "SUBMITTED"
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
  }, [isReviewRequest, pathname, router]);

  useEffect(() => {
    setMailtoHref(getMailtoHref());
  }, []);

  useEffect(() => {
    if (!snapshot || hasTrackedPageView.current) {
      return;
    }

    hasTrackedPageView.current = true;
    void trackPageView({
      pageName: "apply_materials",
      stepName: "materials",
      applicationId: snapshot.applicationId,
    });
  }, [snapshot]);

  function handleDelete(fileId: string) {
    if (!snapshot || isReadOnlyReview) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        clearUploadErrors();
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
    if (!snapshot || isReadOnlyReview) {
      return;
    }

    startTransition(async () => {
      try {
        void trackClick({
          eventType: "submit_clicked",
          pageName: "apply_materials",
          stepName: "submit",
          applicationId: snapshot.applicationId,
        });
        await submitApplicationAction(
          snapshot.applicationId,
          getOrCreateTrackingSessionId(),
        );
        router.push("/apply/submission-complete");
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Submission failed.",
        );
      }
    });
  }

  const missingRequiredCategories = REQUIRED_CATEGORIES.filter((category) => {
    const records = optimisticMaterials?.[category.key] ?? [];
    return getConfirmedMaterialRecords(records).length < 1;
  });
  const minimumRequirementsMet = missingRequiredCategories.length === 0;
  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus),
    [snapshot?.applicationStatus],
  );
  const uploadErrorMessage =
    uploadErrors.length > 0
      ? uploadErrors
          .map((item) => `${item.fileName}: ${item.message}`)
          .join(" ")
      : null;
  const bannerError = error ?? uploadErrorMessage;

  return (
    <PageFrame>
      <PageShell
        title="Required Documents"
        description="Please upload the required supporting documents by category. Ensure that all uploaded documents meet the requirements before submitting."
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={2}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 2
        }
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <MobileSupportCard href={mailtoHref} />

          {bannerError ? (
            <StatusBanner
              tone="danger"
              title="A materials action could not be completed"
              description={bannerError}
            />
          ) : null}

          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading uploaded materials"
              description="Restoring the saved file summary for each category."
            />
          ) : null}

          <SectionCard
            title="Upload by category"
            description={
              isReadOnlyReview
                ? "The submitted package remains grouped by category for reference."
                : "Please upload files by category. Categories marked with an asterisk (*) are mandatory."
            }
          >
            <div className="flex flex-col gap-3">
              {MATERIAL_CATEGORIES.map((category) => {
                const categoryKey =
                  category.key.toLowerCase() as Lowercase<MaterialCategory>;
                const records = optimisticMaterials?.[categoryKey] ?? [];
                const confirmedRecords = getConfirmedMaterialRecords(records);
                const pendingCount = records.length - confirmedRecords.length;
                const isRequiredCategory = REQUIRED_CATEGORIES.some(
                  (item) => item.key === categoryKey,
                );
                const requirementMet = confirmedRecords.length > 0;
                const fileCountLabel =
                  confirmedRecords.length === 1
                    ? "1 File Uploaded"
                    : `${confirmedRecords.length} Files Uploaded`;
                const metaLabel = requirementMet
                  ? pendingCount > 0
                    ? `${fileCountLabel} (${pendingCount} uploading)`
                    : fileCountLabel
                  : pendingCount > 0
                    ? `${pendingCount} uploading`
                    : "⚠ Missing";

                return (
                  <DisclosureSection
                    key={category.key}
                    title={
                      isRequiredCategory
                        ? `${category.label} *`
                        : category.label
                    }
                    summary={
                      isReadOnlyReview
                        ? "Submitted files are available for review."
                        : "Expand to review guidance and manage uploaded files."
                    }
                    defaultOpen={
                      isRequiredCategory && !requirementMet && !isReadOnlyReview
                    }
                    meta={
                      <div className="flex items-center">
                        <span
                          className={
                            requirementMet || pendingCount > 0
                              ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.06em] text-emerald-700"
                              : "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.06em] text-amber-700"
                          }
                        >
                          {metaLabel}
                        </span>
                      </div>
                    }
                  >
                    <div className="flex flex-col gap-4">
                      <div className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                        <MaterialCategoryGuidance category={category.key} />
                      </div>

                      {isRequiredCategory &&
                      !requirementMet &&
                      !isReadOnlyReview ? (
                        <div className="rounded-xl border border-[color:var(--border-strong)] bg-white px-4 py-3 text-sm text-[color:var(--foreground-soft)]">
                          Upload at least one file in this category to unlock
                          final confirmation.
                        </div>
                      ) : null}

                      {!isReadOnlyReview ? (
                        <label className="block">
                          <input
                            type="file"
                            multiple
                            disabled={isCategoryUploading(category.key)}
                            onChange={(event) => {
                              setError(null);
                              clearUploadErrors();
                              uploadFiles(category.key, event.target.files);
                              event.target.value = "";
                            }}
                            className="sr-only"
                          />
                          <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-white px-4 py-4 text-center transition hover:border-[color:var(--primary)] hover:bg-slate-50">
                            <p className="text-sm font-medium text-[color:var(--primary)]">
                              {records.length > 0 ? (
                                <>
                                  <span
                                    className="mr-1 font-semibold"
                                    aria-hidden
                                  >
                                    +
                                  </span>
                                  Click to add file(s)
                                </>
                              ) : (
                                <>
                                  <span
                                    className="mr-1 font-semibold"
                                    aria-hidden
                                  >
                                    +
                                  </span>
                                  Click to upload file(s)
                                </>
                              )}
                            </p>
                          </div>
                        </label>
                      ) : null}

                      <div className="flex flex-col gap-2">
                        {records.map((record) => {
                          const uploadError = uploadErrors.find(
                            (item) => item.clientId === record.id,
                          );

                          return (
                            <MaterialFileRow
                              key={record.id}
                              record={record}
                              isReadOnly={isReadOnlyReview}
                              uploadProgress={uploadStages[record.id] ?? null}
                              errorMessage={uploadError?.message ?? null}
                              onDelete={handleDelete}
                            />
                          );
                        })}
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

          {!isReadOnlyReview && snapshot?.applicationStatus !== "SUBMITTED" ? (
            <SectionCard
              title="Final submission"
              description="Confirm only when the evidence package is complete enough for review."
            >
              <div className="flex flex-col gap-4">
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
                <div className="flex justify-center">
                  <ActionButton
                    onClick={handleSubmit}
                    disabled={
                      isPending ||
                      isLoading ||
                      hasActiveUploads ||
                      !minimumRequirementsMet
                    }
                    className="min-w-[12rem]"
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

export default function MaterialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
          Loading uploaded materials...
        </div>
      }
    >
      <MaterialsPageContent />
    </Suspense>
  );
}
