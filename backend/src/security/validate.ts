import { z } from "zod";

const KIND = z.enum(["artist", "brand", "place", "movie", "tv_show", "destination"]);

export const PlanItemSchema = z.object({
  kind: KIND.optional(),
  name: z.string().min(1).max(200),
  context: z.string().max(2000).optional(),
  market: z.string().max(120).optional(),
  alternatives: z.array(z.string().min(1).max(200)).max(6).optional(),
});

export const PlanSchema = z.object({
  title: z.string().max(200).optional(),
  markets: z.array(z.string().min(1).max(120)).max(6).optional(),
  items: z.array(PlanItemSchema).min(1).max(20),
  interpretation: z.string().max(2000).optional(),
});

export type ValidPlan = z.infer<typeof PlanSchema>;

/** Treat plan text as data: strip control chars, cap length (prompt-injection hygiene for any LLM wording step). */
export function sanitizeText(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export function sanitizePlan(p: ValidPlan): ValidPlan {
  return {
    ...p,
    ...(p.title !== undefined ? { title: sanitizeText(p.title) } : {}),
    items: p.items.map((i) => ({
      ...i,
      name: sanitizeText(i.name),
      ...(i.context !== undefined ? { context: sanitizeText(i.context) } : {}),
    })),
  };
}

const hits = new Map<string, number[]>();

export function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= max;
}

export function resetRateLimit(): void {
  hits.clear();
}
