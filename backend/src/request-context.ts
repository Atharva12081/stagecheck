import { AsyncLocalStorage } from "node:async_hooks";

interface RequestState {
  qlooCalls: number;
  evidenceSeq: number;
}

const storage = new AsyncLocalStorage<RequestState>();
const fallback: RequestState = { qlooCalls: 0, evidenceSeq: 0 };

function state(): RequestState {
  return storage.getStore() ?? fallback;
}

export function withRequestContext<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ qlooCalls: 0, evidenceSeq: 0 }, fn);
}

export function getQlooCallCount(): number {
  return state().qlooCalls;
}

export function claimQlooCall(limit: number): boolean {
  const current = state();
  if (current.qlooCalls >= limit) return false;
  current.qlooCalls += 1;
  return true;
}

export function nextEvidenceId(): string {
  const current = state();
  current.evidenceSeq += 1;
  return `e${current.evidenceSeq}`;
}

/** Test/direct-operation compatibility. HTTP and MCP requests use isolated contexts. */
export function resetFallbackContext(): void {
  fallback.qlooCalls = 0;
  fallback.evidenceSeq = 0;
}
