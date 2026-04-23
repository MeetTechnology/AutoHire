"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import { MATERIAL_CATEGORIES } from "@/features/application/constants";
import {
  confirmMaterialUpload,
  createMaterialUploadIntent,
  deleteMaterial,
  enterMaterialsStage,
  fetchMaterials,
  fetchSession,
  type MaterialsResponse,
  saveProductInnovationDescription,
  submitApplicationRequest,
  uploadBinary,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
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
  createUploadId,
  trackClick,
  trackPageView,
} from "@/lib/tracking/client";

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
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [materials, setMaterials] = useState<MaterialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);
  const [productDescriptionDraft, setProductDescriptionDraft] = useState("");
  const [productDescriptionError, setProductDescriptionError] = useState<
    string | null
  >(null);
  const [productDescriptionSavedHint, setProductDescriptionSavedHint] =
    useState<string | null>(null);
  const productDescriptionServerKey = useRef<string>("");
  const hasTrackedPageView = useRef(false);
  const snapshotApplicationId = snapshot?.applicationId;
  const serverProductDescription = snapshot?.productInnovationDescription ?? "";
  const requestedView = searchParams.get("view");
  const isReviewRequest = requestedView === "review";

  useEffect(() => {
    let active = true;

    async function load() {
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
          router.replace(resolveRouteFromStatus(nextSnapshot.applicationStatus));
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
  }, [isReviewRequest, router]);

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

  useEffect(() => {
    if (!snapshotApplicationId) {
      return;
    }

    const key = `${snapshotApplicationId}:${serverProductDescription}`;
    if (productDescriptionServerKey.current === key) {
      return;
    }

    productDescriptionServerKey.current = key;
    setProductDescriptionDraft(serverProductDescription);
  }, [snapshotApplicationId, serverProductDescription]);

  const isReadOnlyReview = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 2)
    : false;

  function handleSaveProductDescription() {
    if (!snapshot || isReadOnlyReview) {
      return;
    }

    startTransition(async () => {
      try {
        setProductDescriptionError(null);
        setProductDescriptionSavedHint(null);
        await saveProductInnovationDescription(
          snapshot.applicationId,
          productDescriptionDraft,
        );
        setProductDescriptionSavedHint("Saved.");
        setSnapshot(await fetchSession());
      } catch (nextError) {
        setProductDescriptionError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to save the product description.",
        );
      }
    });
  }

  function handleUpload(category: MaterialCategory, files: FileList | null) {
    if (!snapshot || isReadOnlyReview || !files?.length) {
      return;
    }

    const nextFiles = Array.from(files);

    startTransition(async () => {
      try {
        setError(null);

        for (const file of nextFiles) {
          const uploadId = createUploadId();
          const intent = await createMaterialUploadIntent(
            snapshot.applicationId,
            category,
            file,
            uploadId,
          );
          await uploadBinary(intent, file, {
            applicationId: snapshot.applicationId,
            uploadId,
            kind: "material",
            category,
          });
          await confirmMaterialUpload(
            snapshot.applicationId,
            category,
            file,
            intent.objectKey,
            uploadId,
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
    if (!snapshot || isReadOnlyReview) {
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
        await submitApplicationRequest(snapshot.applicationId);
        router.push("/apply/submission-complete");
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
  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus),
    [snapshot?.applicationStatus],
  );

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
        <div className="mx-auto max-w-4xl space-y-4">
          <MobileSupportCard href={mailtoHref} />

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

          {isReadOnlyReview ? (
            <StatusBanner
              tone="review"
              title="Review Mode"
              description="This step is complete. You may review the uploaded materials here, but no further action is required."
            />
          ) : null}

          <SectionCard
            title="Upload by category"
            description={
              isReadOnlyReview
                ? "The submitted package remains grouped by category for reference."
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
                      isReadOnlyReview
                        ? "Read-only uploaded evidence for this category."
                        : "Expand to review guidance, upload files, and manage the current list."
                    }
                    defaultOpen={
                      isRequiredCategory && !requirementMet && !isReadOnlyReview
                    }
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
                      {category.key === "PRODUCT" ? (
                        <div className="space-y-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                          <p>
                            If you have an innovative product, please briefly
                            describe the product name, innovation aspects, and
                            the actual economic benefits generated.
                          </p>
                          {isReadOnlyReview ? (
                            <p className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm whitespace-pre-wrap text-[color:var(--foreground)]">
                              {snapshot?.productInnovationDescription?.trim()
                                ? snapshot.productInnovationDescription
                                : "No product description was provided."}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <textarea
                                value={productDescriptionDraft}
                                onChange={(event) => {
                                  setProductDescriptionDraft(
                                    event.target.value,
                                  );
                                  setProductDescriptionSavedHint(null);
                                }}
                                disabled={isPending}
                                rows={5}
                                className="w-full rounded-xl border border-[color:var(--border-strong)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] ring-[color:var(--accent)] outline-none focus-visible:ring-2"
                              />
                              {productDescriptionError ? (
                                <p className="text-xs font-medium text-red-600">
                                  {productDescriptionError}
                                </p>
                              ) : null}
                              {productDescriptionSavedHint ? (
                                <p className="text-xs font-medium text-emerald-700">
                                  {productDescriptionSavedHint}
                                </p>
                              ) : null}
                              <div className="flex justify-end">
                                <ActionButton
                                  type="button"
                                  onClick={handleSaveProductDescription}
                                  disabled={isPending}
                                  className="w-full sm:w-auto"
                                >
                                  Save description
                                </ActionButton>
                              </div>
                            </div>
                          )}
                          <p className="pt-1 font-medium text-[color:var(--foreground)]">
                            Please upload your Product Introduction Documents
                          </p>
                          <p className="text-xs tracking-[0.06em] text-slate-600">
                            The size of a single image or file cannot exceed
                            300M
                          </p>
                        </div>
                      ) : null}
                      <div className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                        <MaterialCategoryGuidance category={category.key} />
                      </div>

                      {isRequiredCategory && !requirementMet && !isReadOnlyReview ? (
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
                              <span className="truncate">
                                {record.fileName}
                              </span>
                              {!isReadOnlyReview ? (
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

          {!isReadOnlyReview ? (
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
                <div className="flex justify-center">
                  <ActionButton
                    onClick={handleSubmit}
                    disabled={isPending || isLoading || !minimumRequirementsMet}
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
