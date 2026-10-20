"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Watches the displayed level and celebrates when it goes up. The first value seen (initial
 * load) is not celebrated. If an optimistic level-up is rolled back, the level simply drops.
 */
export function LevelUp({ level }: { level: number }) {
  const prev = useRef<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = level;
    if (before === null || level <= before) {
      if (before !== null && level < before) setShown(null);
      return;
    }
    setShown(level);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void import("canvas-confetti").then(({ default: confetti }) => {
        const colors = ["#8fdc5a", "#c8e36a", "#23861f", "#ffa94d", "#ffffff"];
        confetti({ particleCount: 120, spread: 75, startVelocity: 45, origin: { y: 0.4 }, colors });
        setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { y: 0.45 }, colors }), 220);
      });
    }
    const t = setTimeout(() => setShown(null), 2800);
    return () => clearTimeout(t);
  }, [level]);

  return (
    <AnimatePresence>
      {shown !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShown(null)}
          className="fixed inset-0 z-40 grid place-items-center bg-ink-950/60 px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative w-full max-w-sm rounded-3xl border border-fg/10 bg-ink-850/95 px-8 py-10 text-center shadow-2xl"
          >
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-xp-a/40 to-xp-b/30 blur-2xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-xp-b">Level up!</p>
            <motion.p
              initial={{ scale: 0.3, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
              className="my-3 bg-gradient-to-br from-xp-a to-xp-b bg-clip-text font-display text-8xl font-bold text-transparent"
            >
              {shown}
            </motion.p>
            <p className="text-sm text-mist-400">
              You reached level {shown}. The next one takes {shown * 100} XP.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
