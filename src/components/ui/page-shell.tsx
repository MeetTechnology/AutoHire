type PageShellProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-3 text-slate-700">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
