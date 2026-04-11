"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fetchSession, postIntroConfirm } from "@/features/application/client";
import {
  resolveRouteFromStatus,
  shouldRedirectFromApply,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

type ApplyEntryClientProps = {
  token: string | null;
};

export function ApplyEntryClient({ token }: ApplyEntryClientProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const introCards = useMemo(
    () => ["项目介绍与流程说明", "简历上传与资格初判", "材料上传与最终提交"],
    [],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSnapshot = await fetchSession(token);

        if (!active) {
          return;
        }

        if (shouldRedirectFromApply(nextSnapshot)) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (!active) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "无法初始化当前申请会话。",
        );
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
  }, [router, token]);

  function handleStart() {
    if (!snapshot) {
      return;
    }

    startTransition(async () => {
      try {
        await postIntroConfirm(snapshot.applicationId);
        router.push("/apply/resume");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "无法进入简历上传页。",
        );
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="space-y-6">
          <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
            GESF / Global Talent Program
          </span>
          <div className="space-y-4">
            <h1 className="font-[family-name:var(--font-serif)] text-4xl text-slate-900">
              专家邀约入口
            </h1>
            <p className="max-w-3xl text-base leading-8 text-slate-700">
              系统会根据邀约链接或当前浏览器中的安全会话，自动恢复您的申请进度。首次进入将从项目介绍开始，后续可从上次中断的位置继续。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {introCards.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
          {isLoading ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-slate-600">
              正在检查邀约链接并恢复申请进度...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
              {error}
              <div className="mt-3 text-xs text-rose-600">
                本地调试可使用示例 token：
                <code className="ml-2 rounded bg-white px-2 py-1">
                  sample-init-token
                </code>
              </div>
            </div>
          ) : null}
          {snapshot ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="space-y-2 text-sm text-slate-700">
                <p>当前专家：{snapshot.expertId}</p>
                <p>申请状态：{snapshot.applicationStatus}</p>
              </div>
              <button
                type="button"
                onClick={handleStart}
                disabled={isPending}
                className="mt-4 rounded-full bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-60"
              >
                {snapshot.applicationStatus === "INTRO_VIEWED"
                  ? "继续申请"
                  : "开始申请"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
