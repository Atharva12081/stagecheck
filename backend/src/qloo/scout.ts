import { QLOO_KEY } from "../config.js";
import { resetQuota, getCallCount } from "./client.js";
import { opResolve, opRank, opWherePopular } from "./operations.js";
import type { DecisionKind } from "../tastediff/types.js";

if (!QLOO_KEY) {
  console.error("QLOO_API_KEY required");
  process.exit(2);
}

const H = ["Taylor Swift", "The Weeknd", "Bad Bunny", "Billie Eilish", "Kendrick Lamar", "Dua Lipa"];
const OPENERS = ["Sabrina Carpenter", "Chappell Roan", "Olivia Rodrigo", "Gracie Abrams", "Tate McRae", "Benson Boone", "Doja Cat", "SZA", "Phoebe Bridgers", "Fred again..", "Lana Del Rey", "Tyla"];
const BRANDS = ["Nike", "Adidas", "Coca-Cola", "Red Bull", "Heineken", "Liquid Death", "Monster Energy", "Levi's", "Vans", "Spotify", "Apple", "Topo Chico"];
const MARKETS = ["Austin", "Nashville", "Chicago", "Los Angeles"];

const ids = new Map<string, string>();

async function resolveAll(names: string[], kind: DecisionKind): Promise<void> {
  for (const n of names) {
    if (ids.has(`${kind}:${n}`)) continue;
    const r = await opResolve(n, kind);
    const hit = r.resolved[0];
    console.log(`resolve [${kind}] "${n}": ${hit ? `${hit.name} amb=${r.resolved.length > 1}` : "MISS"}`);
    if (hit && r.typeMatched) ids.set(`${kind}:${n}`, hit.id);
  }
}

interface Row {
  scenario: string;
  chosen: string;
  top: string;
  gap: number;
  order: string;
}

const rows: Row[] = [];

async function rankScenario(label: string, kind: DecisionKind, signalNames: string[], candNames: string[], chosen: string): Promise<void> {
  const sig = signalNames.map((n) => ids.get(`artist:${n}`) ?? ids.get(`brand:${n}`) ?? "").filter(Boolean);
  const cands = candNames.map((n) => ({ name: n, id: ids.get(`${kind}:${n}`) ?? "" })).filter((c) => c.id);
  if (sig.length === 0 || cands.length < 2) {
    console.log(`SKIP ${label} (unresolved)`);
    return;
  }
  const r = await opRank(kind, cands.map((c) => c.id), sig);
  if (r.candidates.length < 2) {
    console.log(`SKIP ${label} (no rank data)`);
    return;
  }
  const top = Math.max(...r.candidates.map((c) => c.affinity));
  const ch = r.candidates.find((c) => c.name.toLowerCase() === chosen.toLowerCase());
  const gap = ch ? Math.round((top - ch.affinity) * 1e4) / 1e4 : -1;
  const order = [...r.candidates].sort((a, b) => b.affinity - a.affinity).map((c) => `${c.name}(${c.affinity.toFixed(2)})`).join(" > ");
  rows.push({ scenario: label, chosen, top: r.candidates.find((c) => c.affinity === top)?.name ?? "?", gap, order });
  console.log(`${gap >= 0.15 ? "FAIL " : gap <= 0.05 ? "pass " : "revw "} ${label}: ${order}`);
}

async function geoScenario(label: string, artist: string, markets: string[]): Promise<void> {
  const id = ids.get(`artist:${artist}`);
  if (!id) {
    console.log(`SKIP ${label}`);
    return;
  }
  const g = await opWherePopular("artist", id, markets);
  const order = [...g.byMarket].sort((a, b) => b.affinity - a.affinity).map((m) => `${m.market}(${m.affinity.toFixed(3)})`).join(" > ");
  console.log(`geo  ${label}: ${order}`);
}

async function main(): Promise<void> {
  resetQuota();
  await resolveAll(H, "artist");
  await resolveAll(OPENERS, "artist");
  await resolveAll(BRANDS, "brand");

  // Opener picks: plausible originals, one per headliner.
  await rankScenario("opener for Taylor Swift", "artist", ["Taylor Swift"], ["Sabrina Carpenter", "Chappell Roan", "Gracie Abrams"], "Sabrina Carpenter");
  await rankScenario("opener for The Weeknd", "artist", ["The Weeknd"], ["Doja Cat", "SZA", "Tate McRae"], "Tate McRae");
  await rankScenario("opener for Bad Bunny", "artist", ["Bad Bunny"], ["Tyla", "Doja Cat", "Benson Boone"], "Benson Boone");
  await rankScenario("opener for Billie Eilish", "artist", ["Billie Eilish"], ["Phoebe Bridgers", "Gracie Abrams", "Olivia Rodrigo"], "Olivia Rodrigo");
  await rankScenario("opener for Kendrick Lamar", "artist", ["Kendrick Lamar"], ["SZA", "Doja Cat", "Fred again.."], "Fred again..");
  await rankScenario("opener for Dua Lipa", "artist", ["Dua Lipa"], ["Tate McRae", "Sabrina Carpenter", "Tyla"], "Tyla");
  // Sponsor picks.
  await rankScenario("sponsor for Taylor Swift tour", "brand", ["Taylor Swift"], ["Coca-Cola", "Liquid Death", "Nike"], "Liquid Death");
  await rankScenario("sponsor for The Weeknd tour", "brand", ["The Weeknd"], ["Red Bull", "Heineken", "Spotify"], "Spotify");
  await rankScenario("sponsor for Bad Bunny tour", "brand", ["Bad Bunny"], ["Topo Chico", "Coca-Cola", "Adidas"], "Adidas");
  await rankScenario("sponsor for Billie Eilish tour", "brand", ["Billie Eilish"], ["Nike", "Vans", "Monster Energy"], "Monster Energy");
  await rankScenario("sponsor for Kendrick Lamar tour", "brand", ["Kendrick Lamar"], ["Nike", "Levi's", "Red Bull"], "Red Bull");
  await rankScenario("sponsor for Dua Lipa tour", "brand", ["Dua Lipa"], ["Apple", "H&M", "Heineken"], "Heineken");
  // Markets.
  await geoScenario("Taylor Swift markets", "Taylor Swift", MARKETS);
  await geoScenario("Bad Bunny markets", "Bad Bunny", MARKETS);
  await geoScenario("Billie Eilish markets", "Billie Eilish", MARKETS);

  console.log(`\nAPI calls used: ${getCallCount()}`);
  console.log("\n=== contradiction shortlist (gap >= 0.15) ===");
  for (const r of rows.filter((x) => x.gap >= 0.15).sort((a, b) => b.gap - a.gap)) {
    console.log(`${r.gap.toFixed(2)} ${r.scenario} | chosen=${r.chosen} top=${r.top}\n    ${r.order}`);
  }
}

void main();
