import type { CSSProperties, ReactNode } from "react";

const APPLY_FLOW_BACKDROP_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(244, 247, 251, 0.78) 38%, rgba(244, 247, 251, 0.7) 100%), url("/apply/entry-background.png")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

export default function ApplyLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="relative isolate min-h-screen w-full">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={APPLY_FLOW_BACKDROP_STYLE}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
