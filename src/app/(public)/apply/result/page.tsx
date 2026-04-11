"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import {
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchSession,
  submitSupplementalFields,
} from "@/features/application/client";
import type { ApplicationSnapshot } from "@/features/application/types";

type SupplementalFormValues = Record<string, string>;

export default function ResultPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [statusText, setStatusText] = useState("正在准备分析结果...");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, reset } = useForm<SupplementalFormValues>();

  async function syncAnalysisProgress(applicationId: string) {
    const status = await fetchAnalysisStatus(applicationId);
    setStatusText(status.progressMessage);

    const refreshedSession = await fetchSession();
    setSnapshot(refreshedSession);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (
          nextSnapshot.applicationStatus === "INIT" ||
          nextSnapshot.applicationStatus === "INTRO_VIEWED"
        ) {
          router.replace("/apply/resume");
          return;
        }

        if (
          nextSnapshot.applicationStatus === "MATERIALS_IN_PROGRESS" ||
          nextSnapshot.applicationStatus === "SUBMITTED"
        ) {
          router.replace("/apply/materials");
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "无法读取分析状态。",
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
    if (!snapshot) {
      return;
    }

    if (
      snapshot.applicationStatus === "CV_ANALYZING" ||
      snapshot.applicationStatus === "REANALYZING"
    ) {
      let active = true;
      const timer = window.setInterval(async () => {
        try {
          const status = await fetchAnalysisStatus(snapshot.applicationId);

          if (!active) {
            return;
          }

          setStatusText(status.progressMessage);

          if (status.jobStatus === "COMPLETED") {
            const refreshedSession = await fetchSession();
            if (!active) {
              return;
            }
            setSnapshot(refreshedSession);
          }
        } catch (nextError) {
          if (active) {
            setError(
              nextError instanceof Error
                ? nextError.message
                : "分析状态获取失败。",
            );
          }
        }
      }, 2000);

      return () => {
        active = false;
        window.clearInterval(timer);
      };
    }
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot?.applicationId) {
      return;
    }

    void fetchAnalysisResult(snapshot.applicationId)
      .then((result) => {
        if (result.missingFields.length > 0) {
          const defaults = Object.fromEntries(
            result.missingFields.map((field) => [
              field.fieldKey,
              field.defaultValue ?? "",
            ]),
          );
          reset(defaults);
        }
      })
      .catch(() => undefined);
  }, [reset, snapshot?.applicationId]);

  function onSubmit(values: SupplementalFormValues) {
    if (!snapshot) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await submitSupplementalFields(snapshot.applicationId, values);
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus: "REANALYZING",
              }
            : current,
        );
        setStatusText("系统正在根据补充信息重新分析...");
        await syncAnalysisProgress(snapshot.applicationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "补充信息提交失败。",
        );
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-3xl font-semibold text-slate-900">分析结果</h1>
        {isLoading ? (
          <p className="mt-4 text-slate-700">正在加载分析结果...</p>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {snapshot ? (
          <div className="mt-6 space-y-6">
            {(snapshot.applicationStatus === "CV_ANALYZING" ||
              snapshot.applicationStatus === "REANALYZING") && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-medium">系统正在分析您的简历信息</p>
                <p className="mt-2">{statusText}</p>
              </div>
            )}
            {snapshot.applicationStatus === "INELIGIBLE" && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                <p className="font-medium">当前暂不符合申报资格</p>
                <p className="mt-2">{snapshot.latestResult?.displaySummary}</p>
                <p className="mt-2 text-rose-700">
                  {snapshot.latestResult?.reasonText}
                </p>
              </div>
            )}
            {snapshot.applicationStatus === "ELIGIBLE" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
                <p className="font-medium">已通过初步资格判断</p>
                <p className="mt-2">{snapshot.latestResult?.displaySummary}</p>
                <button
                  type="button"
                  onClick={() => router.push("/apply/materials")}
                  className="mt-4 rounded-full bg-emerald-700 px-5 py-3 font-medium text-white"
                >
                  继续上传证明材料
                </button>
              </div>
            )}
            {snapshot.applicationStatus === "INFO_REQUIRED" && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-medium text-slate-900">
                  还缺少部分关键信息
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {snapshot.latestResult?.displaySummary ??
                    "请补充以下字段后重新分析。"}
                </p>
                <form
                  className="mt-5 space-y-4"
                  onSubmit={handleSubmit(onSubmit)}
                >
                  {snapshot.latestResult?.missingFields.map((field) => (
                    <label
                      key={field.fieldKey}
                      className="block text-sm text-slate-700"
                    >
                      <span className="mb-2 block font-medium text-slate-900">
                        {field.label}
                      </span>
                      {field.type === "select" ? (
                        <select
                          {...register(field.fieldKey, {
                            required: field.required,
                          })}
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3"
                        >
                          <option value="">请选择</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          {...register(field.fieldKey, {
                            required: field.required,
                          })}
                          className="min-h-28 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3"
                        />
                      ) : (
                        <input
                          {...register(field.fieldKey, {
                            required: field.required,
                          })}
                          type="text"
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3"
                        />
                      )}
                      {field.helpText ? (
                        <span className="mt-2 block text-xs text-slate-500">
                          {field.helpText}
                        </span>
                      ) : null}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-full bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-60"
                  >
                    {isPending ? "重新分析中..." : "确认并重新分析"}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
