"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AskAiDrawer } from "@/features/ask-ai/components/ask-ai-drawer";

export function AskAiEntry({ pageName }: { pageName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="Application guidance"
        className="fixed right-4 bottom-4 z-40 size-16 overflow-visible rounded-full border border-white/70 bg-white/82 p-0 text-slate-950 shadow-[0_22px_55px_rgba(15,23,42,0.20),0_8px_22px_rgba(14,165,233,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl hover:border-cyan-100 hover:bg-white/92 hover:shadow-[0_26px_65px_rgba(15,23,42,0.23),0_10px_30px_rgba(14,165,233,0.18),inset_0_1px_0_rgba(255,255,255,1)] focus-visible:ring-cyan-500/30 md:right-6 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <span
          className="pointer-events-none absolute inset-[-3px] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.22),rgba(14,165,233,0)_68%)] motion-safe:animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        <AnimatedEnterpriseRagAssistantIcon />
      </Button>
      <AskAiDrawer open={open} onOpenChange={setOpen} pageName={pageName} />
    </>
  );
}

function AnimatedEnterpriseRagAssistantIcon() {
  return (
    <svg
      className="relative size-10 drop-shadow-[0_8px_12px_rgba(14,116,144,0.18)]"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <style>
        {`
          .rag-orbit-flow {
            stroke-dasharray: 34 18;
            animation: rag-orbit-flow 4.2s ease-in-out infinite;
          }

          .rag-orbit-flow-subtle {
            stroke-dasharray: 22 24;
            animation: rag-orbit-flow 5.4s ease-in-out infinite reverse;
          }

          .rag-node-pulse {
            animation: rag-node-pulse 2.6s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          .rag-node-delay-medium {
            animation-delay: 0.28s;
          }

          .rag-node-delay-long {
            animation-delay: 0.56s;
          }

          .rag-core-float {
            animation: rag-core-float 3.4s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          .rag-core-shine {
            animation: rag-core-shine 3.4s ease-in-out infinite;
          }

          .rag-spark-pulse {
            animation: rag-spark-pulse 2.2s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          @keyframes rag-orbit-flow {
            0% {
              stroke-dashoffset: 34;
              opacity: 0.58;
            }
            45% {
              opacity: 1;
            }
            100% {
              stroke-dashoffset: -34;
              opacity: 0.66;
            }
          }

          @keyframes rag-node-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.86;
            }
            45% {
              transform: scale(1.12);
              opacity: 1;
            }
          }

          @keyframes rag-core-float {
            0%, 100% {
              transform: translateY(0) scale(1);
            }
            50% {
              transform: translateY(-1.2px) scale(1.025);
            }
          }

          @keyframes rag-core-shine {
            0% {
              opacity: 0.2;
              transform: translateX(-8px);
            }
            50% {
              opacity: 0.62;
            }
            100% {
              opacity: 0.16;
              transform: translateX(8px);
            }
          }

          @keyframes rag-spark-pulse {
            0%, 100% {
              transform: scale(0.9) rotate(0deg);
              opacity: 0.78;
            }
            50% {
              transform: scale(1.18) rotate(8deg);
              opacity: 1;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .rag-orbit-flow,
            .rag-orbit-flow-subtle,
            .rag-node-pulse,
            .rag-core-float,
            .rag-core-shine,
            .rag-spark-pulse {
              animation: none;
            }
          }
        `}
      </style>
      <defs>
        <linearGradient
          id="rag-assistant-primary"
          x1="17"
          y1="13"
          x2="47"
          y2="51"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#243c8f" />
          <stop offset="0.48" stopColor="#1769d2" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient
          id="rag-assistant-orbit"
          x1="10"
          y1="23"
          x2="54"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient
          id="rag-assistant-core"
          x1="22"
          y1="19"
          x2="42"
          y2="43"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#f8fbff" />
          <stop offset="1" stopColor="#dff7ff" />
        </linearGradient>
        <linearGradient
          id="rag-assistant-shine"
          x1="24"
          y1="19"
          x2="40"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.92" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <radialGradient
          id="rag-assistant-glow"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(32 30) rotate(90) scale(26)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#67e8f9" stopOpacity="0.38" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="28" fill="url(#rag-assistant-glow)" />
      <ellipse
        className="rag-orbit-flow-subtle"
        cx="32"
        cy="32"
        rx="24"
        ry="10.5"
        stroke="url(#rag-assistant-orbit)"
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity="0.54"
        transform="rotate(-18 32 32)"
      />
      <ellipse
        className="rag-orbit-flow"
        cx="32"
        cy="32"
        rx="22.5"
        ry="9.5"
        stroke="url(#rag-assistant-orbit)"
        strokeWidth="2.7"
        strokeLinecap="round"
        transform="rotate(18 32 32)"
      />

      <g className="rag-core-float">
        <path
          d="M32 16.5 45 24v16L32 47.5 19 40V24l13-7.5Z"
          fill="url(#rag-assistant-core)"
          stroke="url(#rag-assistant-primary)"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d="M32 17v30"
          stroke="url(#rag-assistant-primary)"
          strokeWidth="1.55"
          strokeLinecap="round"
          opacity="0.42"
        />
        <path
          d="M20 24.5 32 31.5l12-7"
          stroke="url(#rag-assistant-primary)"
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.44"
        />
        <path
          d="M24.8 37.8h14.4"
          stroke="url(#rag-assistant-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M27.5 32h9"
          stroke="url(#rag-assistant-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          className="rag-core-shine"
          d="M25.5 21.5 38.8 43"
          stroke="url(#rag-assistant-shine)"
          strokeWidth="3.6"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>

      <circle
        className="rag-node-pulse"
        cx="15.5"
        cy="31.5"
        r="3.5"
        fill="url(#rag-assistant-primary)"
      />
      <circle
        className="rag-node-pulse rag-node-delay-medium"
        cx="48.5"
        cy="28"
        r="3.5"
        fill="url(#rag-assistant-primary)"
      />
      <circle
        className="rag-node-pulse rag-node-delay-long"
        cx="41.5"
        cy="46"
        r="3.2"
        fill="#f59e0b"
      />
      <path
        className="rag-spark-pulse"
        d="M48.5 15.5 50 19l3.5 1.5L50 22l-1.5 3.5L47 22l-3.5-1.5L47 19l1.5-3.5Z"
        fill="#f59e0b"
      />
    </svg>
  );
}
