import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { PORT } from "./config.js";
import { registerRoutes } from "./routes/verify.js";
import { registerMcp } from "./mcp.js";

const app = Fastify({ logger: false });

// Never log bodies or headers (may contain plan PII; key is never client-visible anyway).
app.addHook("onRequest", (req, _reply, done) => {
  if (req.url !== "/api/health") req.log.info({ method: req.method, url: req.url });
  done();
});

await registerRoutes(app);
await registerMcp(app);

const FRONTEND_DIST = join(process.cwd(), "..", "frontend", "dist");
const FRONTEND_SRC = join(process.cwd(), "..", "frontend");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** Serve the built frontend (../frontend/dist) with SPA fallback; same-origin, no CORS needed. */
async function serveStatic(rel: string): Promise<{ data: Buffer; type: string } | null> {
  for (const base of [FRONTEND_DIST, FRONTEND_SRC]) {
    const full = normalize(join(base, rel));
    if (full !== join(base, "index.html") && !full.startsWith(base + sep)) continue;
    try {
      const data = await readFile(full);
      const dot = full.lastIndexOf(".");
      return { data, type: MIME[full.slice(dot)] ?? "application/octet-stream" };
    } catch {
      continue;
    }
  }
  return null;
}

app.get("/*", async (req, reply) => {
  const raw = req.url.split("?")[0] ?? "/";
  if (raw.startsWith("/api/") || raw === "/mcp") return reply.code(404).send({ error: "not_found" });
  // Block traversal early on the raw path.
  if (raw.includes("..") || raw.includes("\0")) return reply.code(403).send({ error: "forbidden" });
  const rel = raw === "/" ? "index.html" : raw.slice(1);
  const hit = await serveStatic(rel);
  if (hit) {
    reply.header("content-type", hit.type);
    return reply.send(hit.data);
  }
  // SPA fallback for client-side routes.
  const index = await serveStatic("index.html");
  if (index && rel.endsWith(".html") === false && !rel.includes(".")) {
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(index.data);
  }
  if (index && rel === "index.html") {
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(index.data);
  }
  return reply.code(404).send({ error: "not_found" });
});

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`stagecheck backend listening on :${PORT}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}
