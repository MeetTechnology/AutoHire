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
          .assistant-bot-float {
            animation: assistant-bot-float 3.6s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          .assistant-eye {
            animation: assistant-eye 3.2s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          .assistant-eye-right {
            animation-delay: 0.14s;
          }

          .assistant-signal {
            animation: assistant-signal 2.8s ease-in-out infinite;
            transform-box: fill-box;
            transform-origin: center;
          }

          .assistant-soft-glow {
            animation: assistant-soft-glow 3.6s ease-in-out infinite;
          }

          @keyframes assistant-bot-float {
            0%, 100% {
              transform: translateY(0);
            }
            52% {
              transform: translateY(-1.4px);
            }
          }

          @keyframes assistant-eye {
            0%, 100% {
              transform: scaleY(1);
              opacity: 0.9;
            }
            44% {
              transform: scaleY(1);
              opacity: 1;
            }
            48% {
              transform: scaleY(0.22);
              opacity: 0.78;
            }
            54% {
              transform: scaleY(1);
              opacity: 1;
            }
          }

          @keyframes assistant-signal {
            0%, 100% {
              transform: scale(0.94);
              opacity: 0.72;
            }
            50% {
              transform: scale(1.16);
              opacity: 1;
            }
          }

          @keyframes assistant-soft-glow {
            0%, 100% {
              opacity: 0.36;
            }
            50% {
              opacity: 0.72;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .assistant-bot-float,
            .assistant-eye,
            .assistant-signal,
            .assistant-soft-glow {
              animation: none;
            }
          }
        `}
      </style>
      <defs>
        <linearGradient
          id="assistant-bot-stroke"
          x1="18"
          y1="15"
          x2="47"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#18356f" />
          <stop offset="0.5" stopColor="#1264b8" />
          <stop offset="1" stopColor="#0794a8" />
        </linearGradient>
        <linearGradient
          id="assistant-bot-face"
          x1="20"
          y1="18"
          x2="44"
          y2="47"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eefaff" />
          <stop offset="1" stopColor="#d9f3ff" />
        </linearGradient>
        <linearGradient
          id="assistant-bot-eye"
          x1="24"
          y1="29"
          x2="40"
          y2="37"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient
          id="assistant-bot-glow"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(32 35) rotate(90) scale(24)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#67e8f9" stopOpacity="0.38" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle
        className="assistant-soft-glow"
        cx="32"
        cy="34"
        r="27"
        fill="url(#assistant-bot-glow)"
      />
      <g className="assistant-bot-float">
        <path
          d="M32 15.5v4.8"
          stroke="url(#assistant-bot-stroke)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle
          className="assistant-signal"
          cx="32"
          cy="12.8"
          r="3.2"
          fill="#f59e0b"
        />
        <path
          d="M20.5 26.5c0-4.1 3.3-7.4 7.4-7.4h8.2c4.1 0 7.4 3.3 7.4 7.4v12.2c0 4.1-3.3 7.4-7.4 7.4h-8.2c-4.1 0-7.4-3.3-7.4-7.4V26.5Z"
          fill="url(#assistant-bot-face)"
          stroke="url(#assistant-bot-stroke)"
          strokeWidth="2.9"
        />
        <path
          d="M18.6 32.2h1.9v7.2h-1.9c-2 0-3.6-1.6-3.6-3.6s1.6-3.6 3.6-3.6Z"
          fill="#e7f7ff"
          stroke="url(#assistant-bot-stroke)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M45.4 32.2h1.9c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6h-1.9v-7.2Z"
          fill="#e7f7ff"
          stroke="url(#assistant-bot-stroke)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle
          className="assistant-eye"
          cx="27.2"
          cy="32.4"
          r="2.8"
          fill="url(#assistant-bot-eye)"
        />
        <circle
          className="assistant-eye assistant-eye-right"
          cx="36.8"
          cy="32.4"
          r="2.8"
          fill="url(#assistant-bot-eye)"
        />
        <path
          d="M27.8 39.1c2.4 1.7 6 1.7 8.4 0"
          stroke="url(#assistant-bot-stroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          d="M24.2 25.5c1.8-1.2 4.2-1.8 7.8-1.8 3.6 0 6 .6 7.8 1.8"
          stroke="white"
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity="0.82"
        />
      </g>
    </svg>
  );
}
