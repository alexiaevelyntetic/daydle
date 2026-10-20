"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

/** Counts smoothly from the previous value to the new one. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className={`tabular-nums ${className ?? ""}`}>{text}</motion.span>;
}
