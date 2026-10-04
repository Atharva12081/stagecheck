const $ = (id) => document.getElementById(id);

async function health() {
  try {
    const r = await fetch("/api/health");
    const h = await r.json();
    const m = $("mode");
    m.textContent = h.qloo === "live" ? "LIVE QLOO" : h.qloo === "sample" ? "SAMPLE (labeled)" : "UNCONFIGURED";
    m.className = "badge " + (h.qloo === "live" ? "live" : h.qloo === "sample" ? "sample" : "unknown");
    $("healthText").textContent = `backend ok · qloo=${h.qloo}`;
  } catch {
    $("healthText").textContent = "backend unreachable";
  }
}

$("verify").onclick = async () => {
  $("status").textContent = "verifying…";
  $("report").innerHTML = "";
  let items;
  try {
    items = JSON.parse($("items").value);
  } catch {
    $("status").textContent = "items JSON is invalid";
    return;
  }
  const plan = {
    title: $("title").value,
    markets: $("markets").value.split(",").map((s) => s.trim()).filter(Boolean),
    items,
  };
  const t0 = performance.now();
  const res = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
  const report = await res.json();
  $("status").textContent = `done in ${Math.round(performance.now() - t0)}ms · ${report.qlooCalls ?? "?"} qloo calls · mode=${report.mode}`;
  if (!res.ok) {
    $("report").innerHTML = `<p>Error: ${report.error ?? res.status}</p>`;
    return;
  }
  const el = $("report");
  for (const d of report.decisions) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML =
      `<div><span class="verdict ${d.verdict}">${d.verdict}</span> — <strong></strong> <span class="dim"></span></div>` +
      `<div></div>` +
      (d.replacement ? `<div>Repair: <strong></strong> (reverified: ${d.reverify})</div>` : "") +
      `<div><small class="ev"></small></div>`;
    div.querySelector("strong").textContent = d.original;
    div.querySelector(".dim").textContent = `(${d.kind}${d.market ? " · " + d.market : ""} · ${d.op})`;
    div.querySelectorAll("div")[1].textContent = d.verdictReason;
    if (d.replacement) div.querySelectorAll("strong")[1].textContent = d.replacement;
    div.querySelector("small").textContent = `evidence: ${d.evidence.length} entries · quality=${d.evidenceQuality} · rank_gap=${d.derived.rank_gap ?? "n/a"}`;
    el.appendChild(div);
  }
  const rev = document.createElement("div");
  rev.innerHTML = "<h3>Revised plan</h3>";
  const ul = document.createElement("ul");
  for (const r of report.revisedPlan) {
    const li = document.createElement("li");
    li.textContent = `${r.choice} — ${r.verdict}`;
    ul.appendChild(li);
  }
  rev.appendChild(ul);
  if (report.unresolved.length > 0) {
    const p = document.createElement("p");
    p.textContent = `Unresolved: ${report.unresolved.join(", ")}`;
    rev.appendChild(p);
  }
  el.appendChild(rev);
};

void health();
