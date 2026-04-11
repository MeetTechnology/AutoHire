"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
          !["ELIGIBLE", "MATERIALS_IN_PROGRESS", "SUBMITTED"].includes(
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
              : "无法读取材料信息。",
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
          nextError instanceof Error ? nextError.message : "材料上传失败。",
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
          nextError instanceof Error ? nextError.message : "删除材料失败。",
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
        setError(nextError instanceof Error ? nextError.message : "提交失败。");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              证明材料上传
            </h1>
            <p className="mt-3 text-slate-700">
              请按分类上传证明材料。每类支持批量上传，可留空。系统会自动保存上传进度。
            </p>
          </div>
          {snapshot?.applicationStatus === "SUBMITTED" || notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              {notice ?? "已收到材料信息，将在 1-3 个工作日内答复。"}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-sm text-slate-600">正在读取已上传材料...</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MATERIAL_CATEGORIES.map((category) => {
              const records = materials?.[category.key.toLowerCase()] ?? [];

              return (
                <div
                  key={category.key}
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
                >
                  <h2 className="font-medium text-slate-900">
                    {category.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    支持批量上传，可留空。
                  </p>
                  <input
                    type="file"
                    multiple
                    disabled={
                      snapshot?.applicationStatus === "SUBMITTED" || isPending
                    }
                    onChange={(event) =>
                      handleUpload(category.key, event.target.files)
                    }
                    className="mt-4 block w-full text-sm text-slate-600"
                  />
                  <div className="mt-4 space-y-2">
                    {records.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{record.fileName}</span>
                          {snapshot?.applicationStatus !== "SUBMITTED" ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(record.id)}
                              className="text-xs text-rose-600"
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {records.length === 0 ? (
                      <p className="text-xs text-slate-500">暂无已上传文件</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              snapshot?.applicationStatus === "SUBMITTED" ||
              isPending ||
              isLoading
            }
            className="rounded-full bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            {snapshot?.applicationStatus === "SUBMITTED"
              ? "已提交"
              : "确认提交"}
          </button>
        </div>
      </section>
    </main>
  );
}
