// Same-origin proxy: the browser calls /api/*, this forwards to the Fastify API.
// API_URL is read at request time, so one build works locally (localhost) and in Docker (http://api:3001).
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const FORWARDED_HEADERS = ["content-type", "x-now"];

export const dynamic = "force-dynamic";

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await params;
  const target = `${API_URL}/${path.map(encodeURIComponent).join("/")}${new URL(req.url).search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  try {
    const res = await fetch(target, { method: req.method, headers, body: body || undefined, cache: "no-store" });
    const text = res.status === 204 ? null : await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ error: "API unreachable" }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
