const categories = [
  "身份证明",
  "工作证明",
  "学历证明",
  "荣誉证明",
  "专利证明",
  "项目证明",
];

export default function MaterialsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              证明材料上传
            </h1>
            <p className="mt-3 text-slate-700">
              这里预留了 6
              个材料分类的上传位，后续会接入分类批量上传、回显、删除和最终提交。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <h2 className="font-medium text-slate-900">{category}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  支持批量上传，可留空，后续支持进度恢复。
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
