"use client";

import { CircleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Toast } from "@/lib/useQuestlog";

export function Toasts({ toasts, onDismiss }: { toasts: readonly Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="assertive">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-rose-400/25 bg-ink-800/95 px-4 py-3 text-sm shadow-2xl shadow-shade/50 backdrop-blur"
            role="alert"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden />
            <p className="flex-1 text-mist-200">{t.text}</p>
            <button onClick={() => onDismiss(t.id)} className="text-mist-500 hover:text-mist-200" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
