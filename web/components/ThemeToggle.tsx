"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "dark" | "light";

/** Light/dark switch. The initial theme is set by the inline script in the layout. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    setTimeout(() => root.classList.remove("theme-switching"), 400);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or storage disabled: the choice just won't be remembered.
    }
    setTheme(next);
  };

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-fg/[0.12] bg-ink-850/80 text-mist-200 transition hover:border-fg/25 hover:text-mist-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xp-a/50"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme && (
          <motion.span
            key={theme}
            initial={{ y: 14, rotate: -90, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            exit={{ y: -14, rotate: 90, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="grid place-items-center"
          >
            {/* The icon shows the current mode; the label says what a click does. */}
            {theme === "light" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
