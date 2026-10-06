import { QLOO_BASE, QLOO_KEY } from "../config.js";

if (!QLOO_KEY) {
  console.error("QLOO_API_KEY required");
  process.exit(2);
}
const H = { "X-Api-Key": QLOO_KEY };
let calls = 0;

async function call(label: string, path: string, params: Record<string, string>): Promise<unknown> {
  calls++;
  const url = `${QLOO_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: H });
  const body = await res.text();
  let shape = "";
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const r = j["results"] as Record<string, unknown> | unknown[] | undefined;
    if (Array.isArray(r)) {
      shape = `results[] n=${r.length} first=${JSON.stringify(r[0]).slice(0, 220)}`;
    } else if (r && typeof r === "object") {
      shape = `results{${Object.keys(r).join(",")}}`;
      const e = (r as Record<string, unknown>)["entities"];
      if (Array.isArray(e)) {
        shape += ` entities=${e.length} ` + e.slice(0, 4).map((x) => {
          const o = x as Record<string, unknown>;
          return `${o["name"]}(${typeof o["affinity"] === "number" ? (o["affinity"] as number).toFixed(2) : "?"})`;
        }).join(" | ");
      }
      const t = (r as Record<string, unknown>)["trending"];
      if (Array.isArray(t)) shape += ` trending=${t.length} first=${JSON.stringify(t[0]).slice(0, 160)}`;
    } else {
      shape = `topkeys=${Object.keys(j).join(",")}`;
    }
  } catch {
    shape = body.slice(0, 160);
  }
  console.log(`[${res.status}] ${label}: ${shape}`);
  return body;
}

async function main(): Promise<void> {
  // 1. resolution: known, ambiguous, unknown
  const taylor = await call("search known", "/search", { query: "Taylor Swift", types: "urn:entity:artist" }) as string;
  const tid = (JSON.parse(taylor) as { results: { entity_id: string }[] }).results[0]!.entity_id;
  await call("search ambiguous", "/search", { query: "Acme", types: "urn:entity:brand" });
  await call("search unknown", "/search", { query: "Xyzzy Nonexistent Act 12345" });
  // 2. describe
  await call("describe", "/entities", { entity_ids: tid });
  // 3. rank: joint evaluation with explainability
  const weeknd = await call("search weeknd", "/search", { query: "The Weeknd", types: "urn:entity:artist" }) as string;
  const wid = (JSON.parse(weeknd) as { results: { entity_id: string }[] }).results[0]!.entity_id;
  await call("rank joint", "/v2/insights", {
    "filter.type": "urn:entity:artist",
    "filter.results.entities": `${tid},${wid}`,
    "feature.explainability": "true",
    take: "5",
  });
  // 4. recommend (discovery)
  await call("recommend", "/v2/insights", {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": tid,
    take: "5",
  });
  // 5. where_popular
  await call("geo austin", "/v2/insights", {
    "filter.type": "urn:entity:artist",
    "filter.results.entities": tid,
    "filter.location.query": "Austin",
    "filter.location.radius": "0",
  });
  // 6. trends
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 84 * 86400_000).toISOString().slice(0, 10);
  await call("trending", "/v2/trending", {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": tid,
    "filter.start_date": start,
    "filter.end_date": end,
  });
  // 7. compare
  await call("compare", "/v2/analysis/compare", {
    "a.signal.interests.entities": tid,
    "b.signal.interests.entities": wid,
  });
  // 8. tags
  await call("tags", "/v2/tags", { "filter.query": "folk" });
  // 9. failure states
  await call("empty?", "/v2/insights", {
    "filter.type": "urn:entity:artist",
    "filter.results.entities": "00000000-0000-0000-0000-000000000000",
  });
  console.log(`total calls: ${calls}`);
}

void main();
