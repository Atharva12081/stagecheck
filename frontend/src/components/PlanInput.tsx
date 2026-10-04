import { useState } from 'react';
import type { Plan, PlanItem } from '../types';

export function PlanInput({ initial, onVerify }: { initial: Plan; onVerify: (p: Plan) => void }) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [markets, setMarkets] = useState(initial.markets?.join(', ') ?? '');
  const [itemsJson, setItemsJson] = useState(JSON.stringify(initial.items, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const submit = () => {
    let items: PlanItem[];
    try {
      items = JSON.parse(itemsJson);
      if (!Array.isArray(items) || items.length === 0) throw new Error('items must be a non-empty array');
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }
    setJsonError(null);
    onVerify({
      title: title || undefined,
      markets: markets.split(',').map(s => s.trim()).filter(Boolean),
      items,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2 mb-10">
        <h2 className="text-2xl font-bold tracking-tight">Submit a plan for cultural preflight</h2>
        <p className="text-sm text-gray-500">StageCheck will decompose each decision, test it against Qloo, and return pass/fail verdicts with evidence.</p>
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">Title</span>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">Markets (comma-separated)</span>
        <input
          value={markets}
          onChange={e => setMarkets(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="Austin, Nashville, Portland"
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">Items (JSON)</span>
        <textarea
          value={itemsJson}
          onChange={e => { setItemsJson(e.target.value); setJsonError(null); }}
          rows={10}
          className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none resize-y"
        />
        {jsonError && <p className="text-red-400 text-xs mt-1">{jsonError}</p>}
      </label>

      <button
        onClick={submit}
        className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded hover:bg-emerald-400 transition-colors"
      >
        Run preflight
      </button>
    </div>
  );
}
