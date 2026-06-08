"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import {
  confirmMaterialUpload,
  createMaterialUploadIntent,
  type MaterialsResponse,
  uploadBinary,
} from "@/features/application/client";
import { runWithConcurrency } from "@/features/application/lib/upload-concurrency";
import type { MaterialCategory } from "@/features/application/types";
import { createUploadId } from "@/lib/tracking/client";

const UPLOAD_CONCURRENCY_LIMIT = 3;

export type MaterialFileItem = {
  id: string;
  fileName: string;
  fileType?: string;
  pending?: boolean;
};

export type MaterialUploadError = {
  clientId: string;
  fileName: string;
  message: string;
};

type OptimisticMaterialsAction =
  | {
      type: "add";
      category: Lowercase<MaterialCategory>;
      fileName: string;
      clientId: string;
    }
  | {
      type: "remove";
      category: Lowercase<MaterialCategory>;
      clientId: string;
    };

function reduceOptimisticMaterials(
  state: MaterialsResponse | null,
  action: OptimisticMaterialsAction,
): MaterialsResponse | null {
  if (!state) {
    return state;
  }

  const records = state[action.category] ?? [];

  if (action.type === "add") {
    return {
      ...state,
      [action.category]: [
        ...records,
        {
          id: action.clientId,
          fileName: action.fileName,
          pending: true,
        },
      ],
    };
  }

  return {
    ...state,
    [action.category]: records.filter((record) => record.id !== action.clientId),
  };
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useMaterialUpload({
  applicationId,
  materials,
  setMaterials,
  disabled = false,
}: {
  applicationId: string | null;
  materials: MaterialsResponse | null;
  setMaterials: (materials: MaterialsResponse) => void;
  disabled?: boolean;
}) {
  const [uploadErrors, setUploadErrors] = useState<MaterialUploadError[]>([]);
  const [uploadStages, setUploadStages] = useState<Record<string, number>>({});
  const [activeUploadsByCategory, setActiveUploadsByCategory] = useState<
    Record<string, number>
  >({});
  const [isUploading, startUploadTransition] = useTransition();

  const [optimisticMaterials, dispatchOptimistic] = useOptimistic(
    materials,
    reduceOptimisticMaterials,
  );

  const beginCategoryUpload = useCallback((category: MaterialCategory) => {
    setActiveUploadsByCategory((current) => ({
      ...current,
      [category]: (current[category] ?? 0) + 1,
    }));
  }, []);

  const endCategoryUpload = useCallback((category: MaterialCategory) => {
    setActiveUploadsByCategory((current) => {
      const nextCount = Math.max(0, (current[category] ?? 0) - 1);

      if (nextCount === 0) {
        const next = { ...current };
        delete next[category];
        return next;
      }

      return {
        ...current,
        [category]: nextCount,
      };
    });
  }, []);

  const setUploadStage = useCallback((clientId: string, stage: number) => {
    setUploadStages((current) => ({
      ...current,
      [clientId]: stage,
    }));
  }, []);

  const clearUploadStage = useCallback((clientId: string) => {
    setUploadStages((current) => {
      const next = { ...current };
      delete next[clientId];
      return next;
    });
  }, []);

  const hasActiveUploads = useMemo(
    () => Object.values(activeUploadsByCategory).some((count) => count > 0),
    [activeUploadsByCategory],
  );

  const isCategoryUploading = useCallback(
    (category: MaterialCategory) => (activeUploadsByCategory[category] ?? 0) > 0,
    [activeUploadsByCategory],
  );

  const clearUploadErrors = useCallback(() => {
    setUploadErrors([]);
  }, []);

  const uploadFiles = useCallback(
    (category: MaterialCategory, files: FileList | null) => {
      if (!applicationId || disabled || !files?.length) {
        return;
      }

      const nextFiles = Array.from(files);
      const categoryKey = category.toLowerCase() as Lowercase<MaterialCategory>;

      startUploadTransition(async () => {
        setUploadErrors([]);

        await runWithConcurrency(nextFiles, UPLOAD_CONCURRENCY_LIMIT, async (file) => {
          const clientId = createClientId();

          dispatchOptimistic({
            type: "add",
            category: categoryKey,
            fileName: file.name,
            clientId,
          });
          beginCategoryUpload(category);
          setUploadStage(clientId, 10);

          try {
            const uploadId = createUploadId();
            const intent = await createMaterialUploadIntent(
              applicationId,
              category,
              file,
              uploadId,
            );
            setUploadStage(clientId, 33);

            await uploadBinary(intent, file, {
              applicationId,
              uploadId,
              kind: "material",
              category,
            });
            setUploadStage(clientId, 66);

            const updatedMaterials = await confirmMaterialUpload(
              applicationId,
              category,
              file,
              intent.objectKey,
              uploadId,
            );
            setUploadStage(clientId, 100);
            setMaterials(updatedMaterials);
            dispatchOptimistic({
              type: "remove",
              category: categoryKey,
              clientId,
            });
          } catch (error) {
            dispatchOptimistic({
              type: "remove",
              category: categoryKey,
              clientId,
            });
            setUploadErrors((current) => [
              ...current,
              {
                clientId,
                fileName: file.name,
                message:
                  error instanceof Error
                    ? error.message
                    : "Material upload failed.",
              },
            ]);
          } finally {
            endCategoryUpload(category);
            clearUploadStage(clientId);
          }
        });
      });
    },
    [
      applicationId,
      beginCategoryUpload,
      clearUploadStage,
      disabled,
      dispatchOptimistic,
      endCategoryUpload,
      setMaterials,
      setUploadStage,
    ],
  );

  return {
    optimisticMaterials,
    uploadFiles,
    uploadErrors,
    uploadStages,
    hasActiveUploads,
    isCategoryUploading,
    isUploading,
    clearUploadErrors,
  };
}

export function getConfirmedMaterialRecords(records: MaterialFileItem[]) {
  return records.filter((record) => !record.pending);
}
