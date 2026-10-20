"use client";

import { useAnimate } from "motion/react";
import { useEffect, useRef } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Progress through the current level. On a level-up it fills to the end, wraps to empty and
 * fills to the new progress; on a level-down (undo) it plays the same thing backwards.
 */
export function XpBar({ level, into, toNext }: { level: number; into: number; toNext: number }) {
  const pct = (into / (into + toNext)) * 100;
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const previous = useRef({ level, pct });

  useEffect(() => {
    const prev = previous.current;
    previous.current = { level, pct };
    const el = scope.current;
    if (!el) return;
    let cancelled = false;
    const run = async () => {
      if (level > prev.level) {
        await animate(el, { width: "100%" }, { duration: 0.45, ease: EASE });
        if (cancelled) return;
        await animate(el, { width: "0%" }, { duration: 0 });
      } else if (level < prev.level) {
        await animate(el, { width: "0%" }, { duration: 0.35, ease: EASE });
        if (cancelled) return;
        await animate(el, { width: "100%" }, { duration: 0 });
      }
      if (!cancelled) await animate(el, { width: `${pct}%` }, { duration: 0.7, ease: EASE });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [level, pct, animate, scope]);

  return (
    <div
      className="relative h-4 w-full overflow-hidden rounded-full bg-ink-950/80 ring-1 ring-fg/5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)]"
      role="progressbar"
      aria-label={`Level ${level} progress`}
      aria-valuemin={0}
      aria-valuemax={into + toNext}
      aria-valuenow={into}
    >
      <div
        ref={scope}
        style={{ width: `${pct}%` }}
        className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-xp-a to-xp-b shadow-[0_0_18px_var(--glow)]"
      >
        <div className="absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </div>
    </div>
  );
}
