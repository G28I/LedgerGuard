'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Play, Loader2, Database, Bot, ShieldCheck } from 'lucide-react';

interface NewReconciliationModalProps {
  onClose: () => void;
}

export function NewReconciliationModal({ onClose }: NewReconciliationModalProps) {
  const router = useRouter();
  const [seed, setSeed] = useState(42);
  const [batchName, setBatchName] = useState(`Reconciliation Batch ${new Date().toISOString().split('T')[0]}`);
  const [enableAI, setEnableAI] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, batchName, enableAI }),
      });

      const data = await res.json();

      if (!res.ok || data.status === 'FAILED') {
        throw new Error(data.message || data.error || 'Failed to execute reconciliation run');
      }

      onClose();
      router.push(`/reconciliation/${data.runId}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown execution failure');
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-md text-indigo-400">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <h2 className="text-sm font-semibold text-slate-100">Start New Reconciliation Run</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleExecute} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Batch Name</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              required
              disabled={isExecuting}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Synthetic Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
                required
                disabled={isExecuting}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Model Strategy</label>
              <div className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span>gemini-2.0-flash</span>
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>
          </div>

          {/* Dynamic Source Dataset Preview */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Source Dataset Composition (Seed {seed})
              </span>
              <span className="text-[11px] font-mono text-slate-400">480 Total Records</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
              <div className="bg-slate-900 border border-slate-800/80 p-2 rounded text-center">
                <span className="block text-slate-400 text-[10px]">Invoices</span>
                <span className="font-bold text-slate-200">200</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-2 rounded text-center">
                <span className="block text-slate-400 text-[10px]">Bank Txs</span>
                <span className="font-bold text-slate-200">200</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 p-2 rounded text-center">
                <span className="block text-slate-400 text-[10px]">Ledger Entries</span>
                <span className="font-bold text-slate-200">80</span>
              </div>
            </div>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/50 border border-slate-800 rounded-lg">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Enable AI Ambiguity Resolver
              </div>
              <p className="text-[11px] text-slate-400">Processes eligible unresolved candidates with safety gates.</p>
            </div>
            <input
              type="checkbox"
              checked={enableAI}
              onChange={(e) => setEnableAI(e.target.checked)}
              disabled={isExecuting}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExecuting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Run...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Run</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
