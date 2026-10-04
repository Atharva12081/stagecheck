import { QLOO_BASE, QLOO_KEY } from "../config.js";

/** Bounded live smoke: 3 read-only calls, verifies base URL + header + key validity. */
async function main(): Promise<void> {
  if (!QLOO_KEY) {
    console.error("SMOKE ABORT: QLOO_API_KEY not set. export QLOO_API_KEY=... (server-side only).");
    process.exit(2);
  }
  const h = { "X-Api-Key": QLOO_KEY };
  const calls: [string, string][] = [
    ["search", `${QLOO_BASE}/search?query=Taylor%20Swift&types=urn%3Aentity%3Aartist`],
    ["insights", `${QLOO_BASE}/v2/insights?filter.type=urn%3Aentity%3Aartist&take=3`],
    ["audiences", `${QLOO_BASE}/v2/audiences/types`],
  ];
  let fail = 0;
  for (const [name, url] of calls) {
    try {
      const res = await fetch(url, { headers: h });
      const text = await res.text();
      console.log(`${name}: http ${res.status} (${text.length} bytes) ${text.slice(0, 160)}`);
      if (!res.ok) fail++;
    } catch (e) {
      console.log(`${name}: ERROR ${e instanceof Error ? e.message : e}`);
      fail++;
    }
  }
  process.exit(fail > 0 ? 1 : 0);
}

await main();
