import type { VerifiedReport, Verdict } from '../types';

const VERDICT_DOT: Record<Verdict, string> = {
  PASS: 'bg-emerald-400',
  FAIL: 'bg-red-400',
  REVIEW: 'bg-yellow-400',
  ABSTAIN: 'bg-gray-600',
};

export function DiffView({ report, onBack, onReset }: {
  report: VerifiedReport;
  onBack: () => void;
  onReset: () => void;
}) {
  // Build the before/after from decisions + revisedPlan
  const rows = report.decisions.map((d, i) => {
    const revised = report.revisedPlan[i];
    const changed = revised && revised.choice !== d.original;
    return {
      kind: d.kind,
      context: d.context || d.kind,
      original: d.original,
      revised: revised?.choice ?? d.original,
      originalVerdict: d.verdict,
      revisedVerdict: revised?.verdict ?? d.verdict,
      changed,
    };
  });

  const changeCount = rows.filter(r => r.changed).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{report.title}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {changeCount} decision{changeCount !== 1 ? 's' : ''} changed · {report.qlooCalls} Qloo calls
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[#222] text-gray-400 rounded hover:bg-[#333] transition-colors">
            ← Details
          </button>
          <button onClick={onReset} className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-[#222] text-gray-400 rounded hover:bg-[#333] transition-colors">
            New Plan
          </button>
        </div>
      </div>

      <div className="border border-[#222] rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_2fr_2fr] bg-[#111] text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-[#222]">
          <div className="px-4 py-3">Decision</div>
          <div className="px-4 py-3 border-l border-[#222]">Original</div>
          <div className="px-4 py-3 border-l border-[#222]">Verified</div>
        </div>

        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_2fr_2fr] border-b border-[#222] last:border-0 ${
              row.changed ? 'bg-emerald-950/10' : ''
            }`}
          >
            <div className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider flex items-center">
              {row.context}
            </div>
            <div className={`px-4 py-3 border-l border-[#222] flex items-center gap-2 ${row.changed ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${VERDICT_DOT[row.originalVerdict]}`} />
              <span className={row.changed ? 'line-through text-gray-600' : ''}>{row.original}</span>
            </div>
            <div className="px-4 py-3 border-l border-[#222] flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${VERDICT_DOT[row.revisedVerdict]}`} />
              <span className={row.changed ? 'font-bold text-emerald-400' : ''}>{row.revised}</span>
              {row.changed && (
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded uppercase tracking-wider font-bold ml-auto">
                  changed
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {report.unresolved.length > 0 && (
        <div className="p-3 border border-red-900/40 rounded bg-red-950/10 text-xs text-red-400">
          <span className="font-bold uppercase tracking-widest mr-2">Unresolved:</span>
          {report.unresolved.join(', ')} — no Qloo-backed replacement found
        </div>
      )}
    </div>
  );
}
