import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const markdownLinkClass =
  "font-medium text-teal-800 underline decoration-teal-800/35 underline-offset-2 transition hover:text-teal-900 hover:decoration-teal-900/50";

function MarkdownPre({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<"pre">) {
  return (
    <pre
      className={cn(
        "my-4 max-h-[min(28rem,55vh)] overflow-x-auto overflow-y-auto rounded-xl border border-stone-700/25 bg-stone-900/[0.92] p-4 font-mono text-[0.8125rem] leading-6 text-stone-100 shadow-inner",
        className,
      )}
      {...rest}
    >
      {children}
    </pre>
  );
}

function MarkdownCode({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"code">) {
  const isBlock = /language-[\w-]+/.test(className ?? "");

  if (isBlock) {
    return (
      <code className={cn("block whitespace-pre font-mono", className)} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <code
      className={cn(
        "rounded-md bg-stone-200/90 px-1.5 py-0.5 font-mono text-[0.85em] text-stone-800",
        className,
      )}
      {...rest}
    >
      {children}
    </code>
  );
}

const markdownComponents = {
  p({ children }: { children?: ReactNode }) {
    return <p className="mb-4 text-sm leading-7 last:mb-0">{children}</p>;
  },
  h1({ children }: { children?: ReactNode }) {
    return (
      <h1 className="mb-3 font-serif text-lg font-semibold tracking-tight text-stone-900">
        {children}
      </h1>
    );
  },
  h2({ children }: { children?: ReactNode }) {
    return (
      <h2 className="mb-2.5 mt-6 font-serif text-base font-semibold tracking-tight text-stone-900 first:mt-0">
        {children}
      </h2>
    );
  },
  h3({ children }: { children?: ReactNode }) {
    return (
      <h3 className="mb-2 mt-5 text-sm font-semibold text-stone-800 first:mt-0">
        {children}
      </h3>
    );
  },
  ul({ children }: { children?: ReactNode }) {
    return (
      <ul className="my-3 list-disc space-y-1.5 pl-5 text-sm leading-7 marker:text-stone-500">
        {children}
      </ul>
    );
  },
  ol({ children }: { children?: ReactNode }) {
    return (
      <ol className="my-3 list-decimal space-y-1.5 pl-5 text-sm leading-7 marker:text-stone-500">
        {children}
      </ol>
    );
  },
  li({ children }: { children?: ReactNode }) {
    return <li className="pl-0.5">{children}</li>;
  },
  blockquote({ children }: { children?: ReactNode }) {
    return (
      <blockquote className="my-4 border-l-2 border-teal-800/25 pl-4 text-sm italic leading-7 text-stone-600">
        {children}
      </blockquote>
    );
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    const external = href?.startsWith("http://") || href?.startsWith("https://");
    return (
      <a
        href={href}
        className={markdownLinkClass}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : undefined)}
      >
        {children}
      </a>
    );
  },
  hr() {
    return <hr className="my-6 border-0 border-t border-stone-200" />;
  },
  strong({ children }: { children?: ReactNode }) {
    return <strong className="font-semibold text-stone-900">{children}</strong>;
  },
  em({ children }: { children?: ReactNode }) {
    return <em className="italic text-stone-700">{children}</em>;
  },
  del({ children }: { children?: ReactNode }) {
    return <del className="text-stone-500 line-through">{children}</del>;
  },
  table({ children }: { children?: ReactNode }) {
    return (
      <div className="my-4 overflow-x-auto rounded-xl border border-stone-200 bg-white/60">
        <table className="w-full min-w-[16rem] border-collapse text-left text-sm text-stone-800">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }: { children?: ReactNode }) {
    return <thead className="bg-stone-100/90 text-xs font-semibold uppercase tracking-wide text-stone-600">{children}</thead>;
  },
  th({ children }: { children?: ReactNode }) {
    return (
      <th className="border-b border-stone-200 px-3 py-2.5 font-semibold">{children}</th>
    );
  },
  td({ children }: { children?: ReactNode }) {
    return <td className="border-b border-stone-100 px-3 py-2.5 align-top">{children}</td>;
  },
  tbody({ children }: { children?: ReactNode }) {
    return (
      <tbody className="[&>tr:last-child>td]:border-b-0 [&>tr:last-child>th]:border-b-0">
        {children}
      </tbody>
    );
  },
  pre: MarkdownPre,
  code: MarkdownCode,
  input(props: ComponentPropsWithoutRef<"input">) {
    if (props.type === "checkbox") {
      return (
        <input
          {...props}
          readOnly
          className="mr-2 mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-teal-800 accent-teal-800 disabled:cursor-not-allowed"
        />
      );
    }
    return <input {...props} />;
  },
};

type MarkdownProseProps = {
  markdown: string;
  className?: string;
};

export function MarkdownProse({ markdown, className }: MarkdownProseProps) {
  return (
    <div
      className={cn(
        "text-sm leading-7 text-stone-700 [&_a>code]:text-teal-900 [&_p>code]:text-stone-800",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
