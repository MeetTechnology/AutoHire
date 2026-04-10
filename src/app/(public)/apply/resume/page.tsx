export default function ResumePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">简历上传</h1>
          <p className="text-slate-700">
            当前为骨架页。后续将接入 OSS
            预签名直传、文件校验、分析任务创建与处理中状态跳转。
          </p>
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-slate-600">
            支持文件格式：PDF、Word、压缩包
            <br />
            单文件最大 20MB，压缩包最大 100MB
          </div>
        </div>
      </section>
    </main>
  );
}
