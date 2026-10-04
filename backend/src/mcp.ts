import type { FastifyInstance } from "fastify";
import { PlanSchema, rateLimit, sanitizePlan } from "./security/validate.js";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "./config.js";
import { resetQuota } from "./qloo/client.js";
import { resetLedgerSeq } from "./tastediff/ledger.js";
import { resetSeq } from "./tastediff/planner.js";
import { verifyPlan } from "./tastediff/orchestrator.js";

/** Minimal MCP-compatible JSON-RPC surface: tastediff_verify as an agent-callable tool. */
export async function registerMcp(app: FastifyInstance): Promise<void> {
  app.post("/mcp", async (req, reply) => {
    const body = (req.body ?? {}) as { method?: string; params?: { name?: string; arguments?: unknown }; id?: unknown };
    if (body.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: body.id ?? 1,
        result: {
          tools: [
            {
              name: "tastediff_verify",
              description: "Verify a plan's culturally dependent decisions against Qloo. Returns verdicts, evidence, repairs, unresolved items.",
              inputSchema: {
                type: "object",
                properties: {
                  plan: { type: "object", description: "Plan with items[{kind,name,context,market,alternatives}] and markets[]" },
                },
                required: ["plan"],
              },
            },
          ],
        },
      };
    }
    if (body.method === "tools/call" && body.params?.name === "tastediff_verify") {
      if (!rateLimit(req.ip ?? "mcp", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
        return reply.code(429).send({ jsonrpc: "2.0", id: body.id ?? 1, error: { code: -32000, message: "rate_limited" } });
      }
      const parsed = PlanSchema.safeParse((body.params.arguments as { plan?: unknown } | undefined)?.plan ?? body.params.arguments);
      if (!parsed.success) {
        return { jsonrpc: "2.0", id: body.id ?? 1, error: { code: -32602, message: "invalid plan arguments" } };
      }
      resetQuota();
      resetLedgerSeq();
      resetSeq();
      const report = await verifyPlan(sanitizePlan(parsed.data));
      return { jsonrpc: "2.0", id: body.id ?? 1, result: { content: [{ type: "text", text: JSON.stringify(report) }] } };
    }
    return { jsonrpc: "2.0", id: body.id ?? 1, error: { code: -32601, message: "unknown method/tool" } };
  });
}
