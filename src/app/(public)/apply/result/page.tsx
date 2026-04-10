export default function ResultPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-3xl font-semibold text-slate-900">分析结果</h1>
        <p className="mt-4 text-slate-700">
          后续这里会根据 `INELIGIBLE`、`INFO_REQUIRED`、`ELIGIBLE`
          三种结果渲染不同视图，并支持动态缺失字段表单入口。
        </p>
      </section>
    </main>
  );
}
