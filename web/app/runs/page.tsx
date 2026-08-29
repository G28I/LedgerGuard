'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { GitCompare, Play, Loader2 } from 'lucide-react';
import { NewReconciliationModal } from '@/components/NewReconciliationModal';

interface RunItem {
  id: string;
  runNumber: string;
  batchName: string;
  totalRecords: number;
  matchedCount: number;
  unresolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
  status: string;
  startedAt: string;
}

export default function ReconciliationRunsPage() {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/reconciliation/run')
      .then((res) => res.json())
      .then((data) => {
        setRuns(data.runs || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-indigo-400" />
              Reconciliation Runs History
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Historical execution audit log of all reconciliation batches.
            </p>
          </div>
          <button
            onClick={() => setIsNewRunModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>New Reconciliation Run</span>
          </button>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-xs font-mono">Loading reconciliation runs...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 text-red-400 text-xs font-mono">
              Error: {error}
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono space-y-2">
              <p>No historical runs found. Execute a reconciliation run to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                    <th className="py-3 px-3">Run Number / Batch</th>
                    <th className="py-3 px-3">Started At</th>
                    <th className="py-3 px-3">Total Records</th>
                    <th className="py-3 px-3">Matched</th>
                    <th className="py-3 px-3">Unresolved</th>
                    <th className="py-3 px-3">Resolution Rate</th>
                    <th className="py-3 px-3">Accuracy</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-100 block">{run.runNumber}</span>
                        <span className="text-[10px] text-slate-500 block">{run.batchName}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(run.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3">{run.totalRecords}</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">{run.matchedCount}</td>
                      <td className="py-3 px-3 text-amber-400">{run.unresolvedCount}</td>
                      <td className="py-3 px-3">
                        {run.resolutionRate !== null ? `${(run.resolutionRate * 100).toFixed(1)}%` : '0%'}
                      </td>
                      <td className="py-3 px-3 text-cyan-300 font-bold">
                        {run.accuracy !== null ? `${run.accuracy}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          run.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/reconciliation/${run.id}`}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                        >
                          View Results
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isNewRunModalOpen && (
        <NewReconciliationModal onClose={() => setIsNewRunModalOpen(false)} />
      )}
    </AppShell>
  );
}
