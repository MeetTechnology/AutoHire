"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  confirmResumeUpload,
  createResumeUploadIntent,
  fetchSession,
  uploadBinary,
} from "@/features/application/client";
import { resolveRouteFromStatus } from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

export default function ResumePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          !["INIT", "INTRO_VIEWED", "CV_UPLOADED"].includes(
            nextSnapshot.applicationStatus,
          )
        ) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "无法读取当前申请。",
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

  function handleUpload() {
    if (!snapshot || !selectedFile) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const intent = await createResumeUploadIntent(
          snapshot.applicationId,
          selectedFile,
        );
        await uploadBinary(intent, selectedFile);
        await confirmResumeUpload(
          snapshot.applicationId,
          selectedFile,
          intent.objectKey,
        );
        router.push("/apply/result");
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "简历上传失败。",
        );
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">简历上传</h1>
          <p className="text-slate-700">
            上传简历后，系统会调用既有简历分析服务做资格初判，并在分析期间持续反馈处理状态。
          </p>
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-slate-600">
            支持文件格式：PDF、Word、压缩包
            <br />
            单文件最大 20MB，压缩包最大 100MB
          </div>
          {snapshot?.latestResumeFile ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700">
              上次已上传：{snapshot.latestResumeFile.fileName}
            </div>
          ) : null}
          <input
            type="file"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
            }}
            className="block w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-slate-700"
          />
          {selectedFile ? (
            <p className="text-sm text-slate-600">
              已选择：{selectedFile.name}（{Math.ceil(selectedFile.size / 1024)}{" "}
              KB）
            </p>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isPending || isLoading}
            className="rounded-full bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            {isPending ? "上传中..." : "上传并开始分析"}
          </button>
        </div>
      </section>
    </main>
  );
}
