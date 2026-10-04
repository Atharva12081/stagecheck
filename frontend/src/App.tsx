import { useState } from 'react';
import { PlanInput } from './components/PlanInput';
import { Preflight } from './components/Preflight';
import { DiffView } from './components/DiffView';
import { Header } from './components/Header';
import type { Plan, VerifiedReport } from './types';

type Step = 'INPUT' | 'RUNNING' | 'RESULTS' | 'DIFF';

const DEFAULT_PLAN: Plan = {
  title: 'Summer indie tour',
  markets: ['Austin', 'Nashville', 'Portland'],
  items: [
    { kind: 'brand', name: 'Lone Star Beer', context: 'Which of these sponsors best aligns with an indie folk tour?', alternatives: ['Topo Chico', 'Yeti'] },
    { kind: 'artist', name: 'Phoebe Bridgers', context: 'Market strength for this headliner', market: 'Austin' },
  ],
};

export default function App() {
  const [step, setStep] = useState<Step>('INPUT');
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [report, setReport] = useState<VerifiedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = async (p: Plan) => {
    setPlan(p);
    setStep('RUNNING');
    setError(null);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setStep('INPUT');
        return;
      }
      setReport(data as VerifiedReport);
      setStep('RESULTS');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setStep('INPUT');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-mono selection:bg-gray-800">
      <Header step={step} mode={report?.mode} />
      {report?.mode === 'sample' && step !== 'INPUT' && (
        <div className="bg-yellow-400 text-black text-center text-xs font-black uppercase tracking-[0.2em] px-4 py-2">
          Sample data — simulated for demo purposes, not Qloo evidence
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 p-4 border border-red-800 bg-red-950/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'INPUT' && (
          <PlanInput initial={plan} onVerify={verify} />
        )}

        {step === 'RUNNING' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="uppercase tracking-widest text-xs text-gray-500">Cultural preflight in progress</p>
          </div>
        )}

        {step === 'RESULTS' && report && (
          <Preflight
            report={report}
            onViewDiff={() => setStep('DIFF')}
            onReset={() => { setStep('INPUT'); setReport(null); }}
          />
        )}

        {step === 'DIFF' && report && (
          <DiffView
            report={report}
            onBack={() => setStep('RESULTS')}
            onReset={() => { setStep('INPUT'); setReport(null); }}
          />
        )}
      </main>
    </div>
  );
}
