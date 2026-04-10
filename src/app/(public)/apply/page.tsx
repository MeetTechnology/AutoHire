import Link from "next/link";

export default function ApplyEntryPage() {
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
              这里是专家邀约申请流程的入口页骨架。后续会在这里接入 token
              校验、项目介绍、当前申请状态恢复与正式进入流程的逻辑。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "项目介绍与流程说明",
              "简历上传与资格初判",
              "材料上传与最终提交",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/apply/resume"
              className="rounded-full bg-teal-700 px-5 py-3 font-medium text-white"
            >
              进入简历上传页
            </Link>
            <Link
              href="/apply/materials"
              className="rounded-full border border-stone-300 px-5 py-3 font-medium text-slate-900"
            >
              查看材料上传页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
