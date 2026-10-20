import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Self-contained server for the Docker image only (web/server.js inside .next/standalone);
  // `next start` (the no-Docker path) does not support standalone output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // The repo is an npm workspace; trace files from its root so the layout is predictable.
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
};

export default config;
