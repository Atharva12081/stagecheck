export function Header({ step, mode }: { step: string; mode?: string }) {
  return (
    <header className="border-b border-[#222] bg-[#111] px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
        <h1 className="font-bold tracking-[0.2em] uppercase text-sm">StageCheck</h1>
        <span className="text-[10px] text-gray-600 tracking-widest uppercase ml-2">cultural preflight</span>
      </div>
      <div className="flex items-center gap-4">
        {mode && (
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${
            mode === 'live' ? 'bg-emerald-900/50 text-emerald-400' : mode === 'sample' ? 'bg-yellow-400 text-black' : 'bg-red-900/50 text-red-400'
          }`}>
            {mode === 'live' ? 'live' : mode === 'sample' ? 'sample data' : 'not configured'}
          </span>
        )}
        <span className="text-[10px] tracking-widest text-gray-600 uppercase">
          {step === 'INPUT' && 'plan input'}
          {step === 'RUNNING' && 'verifying'}
          {step === 'RESULTS' && 'results'}
          {step === 'DIFF' && 'deployment diff'}
        </span>
      </div>
    </header>
  );
}
