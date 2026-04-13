"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ActionButton,
  DetailCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
} from "@/components/ui/page-shell";
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
import { APPLICATION_FLOW_STEPS } from "@/features/application/constants";
import { resolveRouteFromStatus } from "@/features/application/route";
import type {
  ApplicationSnapshot,
  MaterialCategory,
} from "@/features/application/types";

export default function MaterialsPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [materials, setMaterials] = useState<MaterialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

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

  return (
    <PageFrame>
      <PageShell
        eyebrow="Supporting Materials"
        title="Complete the application package with the supporting evidence you wish to provide."
        description="Upload supporting materials by category, review what is already included, and confirm the final package when it is ready."
        steps={APPLICATION_FLOW_STEPS}
        currentStep={snapshot?.applicationStatus === "SUBMITTED" ? 4 : 3}
        headerSlot={
          <SectionCard
            title="Submission rhythm"
            description="This stage is intentionally flexible. Upload category by category, review what has already been stored, and confirm only when you are ready."
            className="bg-white/90"
          >
            <div className="space-y-3">
              <DetailCard
                eyebrow="Flexibility"
                title="Upload only the evidence you want to include"
                description="Each category accepts multiple files, so the package can be assembled in a clear and organized way."
              />
              <DetailCard
                eyebrow="Confirmation"
                title="Submission is an explicit final step"
                description="The application stays editable until you confirm the final submission."
              />
            </div>
          </SectionCard>
        }
      >
        <div className="space-y-6">
          {snapshot?.applicationStatus === "SUBMITTED" || notice ? (
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

          <SectionCard
            title="Upload by category"
            description="Multiple files are supported in every category. Uploaded files remain available across sessions until final submission."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MATERIAL_CATEGORIES.map((category) => {
                const records = materials?.[category.key.toLowerCase()] ?? [];

                return (
                  <div
                    key={category.key}
                    className="rounded-[1.6rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,236,0.88))] p-5 shadow-[0_14px_32px_rgba(28,25,23,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-stone-950">
                          {category.label}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          Multiple files supported. This category may be left
                          empty.
                        </p>
                      </div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-stone-300 bg-stone-50 px-2 text-xs font-semibold text-stone-700">
                        {records.length}
                      </span>
                    </div>

                    <label className="mt-4 block">
                      <input
                        type="file"
                        multiple
                        disabled={
                          snapshot?.applicationStatus === "SUBMITTED" ||
                          isPending
                        }
                        onChange={(event) =>
                          handleUpload(category.key, event.target.files)
                        }
                        className="sr-only"
                      />
                      <div className="rounded-[1.4rem] border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-center transition hover:border-stone-400 hover:bg-white">
                        <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-stone-500 uppercase">
                          Add Files
                        </p>
                        <p className="mt-2 text-sm font-medium text-stone-900">
                          Select one or more files
                        </p>
                      </div>
                    </label>

                    <div className="mt-4 space-y-2">
                      {records.map((record) => (
                        <div
                          key={record.id}
                          className="rounded-[1.1rem] border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate">{record.fileName}</span>
                            {snapshot?.applicationStatus !== "SUBMITTED" ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(record.id)}
                                className="text-xs font-medium text-rose-700 transition hover:text-rose-900"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {records.length === 0 ? (
                        <p className="rounded-[1.1rem] border border-dashed border-stone-200 bg-white/70 px-3 py-4 text-xs tracking-[0.16em] text-stone-500 uppercase">
                          No files uploaded yet
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Final submission"
            description="Use the final confirmation only when you are satisfied with the uploaded package. Once submitted, the application is treated as complete."
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="max-w-2xl text-sm leading-7 text-stone-600">
                You may leave categories empty, upload additional evidence in
                stages, and revisit this page before final confirmation.
              </p>
              <ActionButton
                onClick={handleSubmit}
                disabled={
                  snapshot?.applicationStatus === "SUBMITTED" ||
                  isPending ||
                  isLoading
                }
                className="w-full sm:w-auto"
              >
                {snapshot?.applicationStatus === "SUBMITTED"
                  ? "Submitted"
                  : "Confirm Submission"}
              </ActionButton>
            </div>
          </SectionCard>
        </div>
      </PageShell>
    </PageFrame>
  );
}
