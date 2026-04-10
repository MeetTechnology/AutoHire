import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
      <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
        <section className="space-y-6">
          <p className="text-sm font-semibold tracking-[0.24em] text-teal-700 uppercase">
            AutoHire Skeleton
          </p>
          <div className="space-y-4">
            <h1 className="max-w-3xl font-[family-name:var(--font-serif)] text-5xl leading-tight text-slate-900 md:text-7xl">
              专家邀约申请流程的 Next.js 项目骨架已经就位。
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-700">
              当前版本已完成 App Router、Prisma、OSS
              上传预留、简历分析适配层、API
              骨架和专家端流程路由结构，适合作为后续功能切片开发的起点。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/apply"
              className="rounded-full bg-teal-700 px-5 py-3 font-medium text-white transition hover:bg-teal-800"
            >
              查看申请入口
            </Link>
            <Link
              href="/api/health"
              className="rounded-full border border-stone-300 bg-white/70 px-5 py-3 font-medium text-slate-900 transition hover:bg-white"
            >
              API 健康检查
            </Link>
          </div>
        </section>
        <aside className="rounded-[2rem] border border-stone-200 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <h2 className="text-xl font-semibold text-slate-900">已配置内容</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>Next.js App Router + TypeScript + Tailwind CSS</li>
            <li>Bun package manager and lockfile</li>
            <li>
              Prisma schema for invitation, application, jobs, and materials
            </li>
            <li>
              API route placeholders for session, analysis, upload, and submit
            </li>
            <li>
              Environment template for PostgreSQL, OSS, and resume analysis
              service
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
