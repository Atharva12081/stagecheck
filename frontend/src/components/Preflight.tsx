import { useState } from 'react';
import type { VerifiedReport, DecisionContract, Verdict, EvidenceEntry } from '../types';

const VERDICT_STYLE: Record<Verdict, string> = {
  PASS: 'text-emerald-400 border-emerald-800',
  FAIL: 'text-red-400 border-red-800',
  REVIEW: 'text-yellow-400 border-yellow-800',
  ABSTAIN: 'text-gray-500 border-gray-700',
};

const VERDICT_BG: Record<Verdict, string> = {
  PASS: 'bg-emerald-950/20',
  FAIL: 'bg-red-950/20',
  REVIEW: 'bg-yellow-950/20',
  ABSTAIN: 'bg-gray-900/20',
};

function EvidenceDrawer({ evidence, replacementEvidence }: { evidence: EvidenceEntry[]; replacementEvidence: EvidenceEntry[] }) {
  const all = [...evidence, ...replacementEvidence];
  return (
    <div className="mt-3 pt-3 border-t border-[#222] space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Evidence ledger ({all.length} entries)</p>
      {all.map(e => (
        <div key={e.id} className="text-xs text-gray-400 flex gap-2 items-start">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
            e.kind === 'qloo_output' ? 'bg-blue-950 text-blue-400' :
            e.kind === 'calculation' ? 'bg-purple-950 text-purple-400' :
            'bg-gray-800 text-gray-500'
          }`}>{e.kind === 'qloo_output' ? e.op : e.kind}</span>
          <span className="text-gray-500">{e.summary}</span>
        </div>
      ))}
    </div>
  );
}

function DecisionRow({ d }: { d: DecisionContract }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border border-[#222] rounded-lg overflow-hidden ${VERDICT_BG[d.verdict]}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-black uppercase tracking-widest w-16 shrink-0 ${VERDICT_STYLE[d.verdict]}`}>
            {d.verdict}
          </span>
          <span className="font-bold truncate">{d.original}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-[#1a1a1a] text-gray-500 rounded uppercase tracking-widest shrink-0">
            {d.context || d.kind}
          </span>
          {d.market && (
            <span className="text-[10px] text-gray-600 shrink-0">· {d.market}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {d.replacement && (
            <span className="text-xs text-emerald-400">
              → {d.replacement} ({d.reverify})
            </span>
          )}
          <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      <div className="px-5 pb-4">
        <p className="text-sm text-gray-400">{d.verdictReason}</p>

        {d.replacement && (
          <div className="mt-3 p-3 border border-emerald-900/40 rounded bg-emerald-950/20">
            <p className="text-[10px] uppercase tracking-widest text-emerald-600 mb-1">Repair</p>
            <p className="text-sm">
              <span className="line-through text-gray-600 mr-2">{d.original}</span>
              <span className="text-emerald-400 font-bold">→ {d.replacement}</span>
              <span className="text-gray-500 text-xs ml-2">(reverified: {d.reverify})</span>
            </p>
          </div>
        )}

        {d.derived && Object.keys(d.derived).length > 0 && (
          <div className="mt-2 flex gap-3">
            {Object.entries(d.derived).map(([k, v]) => (
              <span key={k} className="text-[10px] px-2 py-0.5 bg-[#1a1a1a] rounded text-gray-500">
                {k}: {typeof v === 'number' ? v.toFixed(3) : String(v)}
              </span>
            ))}
          </div>
        )}

        {open && <EvidenceDrawer evidence={d.evidence} replacementEvidence={d.replacementEvidence} />}
      </div>
    </div>
  );
}

export function Preflight({ report, onViewDiff, onReset }: {
  report: VerifiedReport;
  onViewDiff: () => void;
  onReset: () => void;
}) {
  const fails = report.decisions.filter(d => d.verdict === 'FAIL');
  const passes = report.decisions.filter(d => d.verdict === 'PASS');
  const reviews = report.decisions.filter(d => d.verdict === 'REVIEW');
  const abstains = report.decisions.filter(d => d.verdict === 'ABSTAIN');
  const hasRepairs = report.decisions.some(d => d.replacement);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{report.title}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {report.decisions.length} decisions · {report.qlooCalls} Qloo calls · {report.latencyMs}ms
          </p>
        </div>
        <div className="flex gap-2">
          {hasRepairs && (
            <button onClick={onViewDiff} className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors">
              View Diff
            </button>
          )}
          <button onClick={onReset} className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[#222] text-gray-400 rounded hover:bg-[#333] transition-colors">
            New Plan
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-3 text-xs font-bold">
        {passes.length > 0 && <span className="px-2 py-1 bg-emerald-950/40 text-emerald-400 rounded">{passes.length} PASS</span>}
        {fails.length > 0 && <span className="px-2 py-1 bg-red-950/40 text-red-400 rounded">{fails.length} FAIL</span>}
        {reviews.length > 0 && <span className="px-2 py-1 bg-yellow-950/40 text-yellow-400 rounded">{reviews.length} REVIEW</span>}
        {abstains.length > 0 && <span className="px-2 py-1 bg-gray-800/40 text-gray-500 rounded">{abstains.length} ABSTAIN</span>}
      </div>

      {report.unresolved.length > 0 && (
        <div className="p-3 border border-red-900/40 rounded bg-red-950/10 text-xs text-red-400">
          Unresolved: {report.unresolved.join(', ')}
        </div>
      )}

      <div className="space-y-3">
        {report.decisions.map(d => <DecisionRow key={d.id} d={d} />)}
      </div>
    </div>
  );
}
