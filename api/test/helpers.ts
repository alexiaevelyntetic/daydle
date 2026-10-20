import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { Send } from "./replay-lib.js";

export function testApp(dbPath = ":memory:"): FastifyInstance {
  return buildApp({ dbPath });
}

/** A `Send` that goes through Fastify's in-process injection (no network). */
export function injector(app: FastifyInstance): Send {
  return async ({ method, path, headers, body }) => {
    const res = await app.inject({
      method: method as "GET",
      url: path,
      headers,
      payload: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.statusCode, body: res.body === "" ? undefined : res.json() };
  };
}

/** Small client for scenario tests: every call carries an explicit X-Now. */
export function client(app: FastifyInstance) {
  const call = async (method: string, url: string, now: string, body?: unknown) => {
    const res = await app.inject({
      method: method as "GET",
      url,
      headers: { "x-now": now, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      payload: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.statusCode, body: res.body === "" ? undefined : res.json() };
  };
  return {
    createQuest: (now: string, body: unknown) => call("POST", "/quests", now, body),
    complete: (now: string, id: string) => call("POST", `/quests/${id}/complete`, now),
    undo: (now: string, id: string) => call("DELETE", `/completions/${id}`, now),
    quests: (now: string) => call("GET", "/quests", now),
    completions: (now: string) => call("GET", "/completions", now),
    me: (now: string) => call("GET", "/me", now),
    setTimezone: (now: string, timezone: unknown) => call("PUT", "/me", now, { timezone }),
    call,
  };
}
