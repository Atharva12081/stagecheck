import type { FastifyInstance } from "fastify";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, qlooMode } from "../config.js";
import { getCallCount } from "../qloo/client.js";
import { PlanSchema, rateLimit, sanitizePlan } from "../security/validate.js";
import { verifyPlan } from "../tastediff/orchestrator.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true, qloo: qlooMode(), version: "0.1.0" }));

  app.post("/api/verify", async (req, reply) => {
    const ip = req.ip ?? "unknown";
    if (!rateLimit(ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return reply.code(429).send({ error: "rate_limited", message: "Too many requests; try again shortly." });
    }
    const parsed = PlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_plan", issues: parsed.error.issues.map((i) => i.message) });
    }
    const report = await verifyPlan(sanitizePlan(parsed.data));
    void getCallCount;
    return report;
  });
}
