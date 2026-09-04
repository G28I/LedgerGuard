'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { 
  GitCompare, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  ArrowRight, 
  Play, 
  Loader2,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import { NewReconciliationModal } from '@/components/NewReconciliationModal';
import { formatMetricAsPercent } from '@/lib/format';

interface OverviewMetricsData {
  latestRun: {
    id: string;
    runNumber: string;
    batchName: string;
    totalRecords: number;
    matchedCount: number;
    unresolvedCount: number;
    exceptionCount: number;
    aiCallCount: number;
    accuracy: number | null;
    resolutionRate: number | null;
    durationMs: number | null;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  recentRuns: Array<{
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
  }>;
  exceptionBreakdown: Record<string, number>;
  sourceCounts: {
    invoices: number;
    bankTransactions: number;
    ledgerEntries: number;
    totalSourceRecords: number;
  };
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);

  const fetchOverviewData = () => {
    setLoading(true);
    fetch('/api/reconciliation/overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load overview metrics');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    fetch('/api/reconciliation/overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load overview metrics');
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { ignore = true; };
  }, []);

  const latestRun = data?.latestRun;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Reconciliation Control Center</h1>
            <p className="text-xs text-slate-400 mt-1">
              Multi-source financial reconciliation status and operational overview.
            </p>
          </div>
          <button
            onClick={() => setIsNewRunModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm shadow-indigo-900/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Reconciliation</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-xs font-mono">Loading overview metrics...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono flex items-center justify-between">
            <span>Error: {error}</span>
            <button onClick={fetchOverviewData} className="px-3 py-1 bg-red-500/20 rounded hover:bg-red-500/30 text-white">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Latest Completed Run Summary KPI Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Latest Reconciliation Run State ({latestRun ? latestRun.runNumber : 'No runs executed'})</span>
                {latestRun?.startedAt && (
                  <span className="font-mono text-[11px]">
                    {new Date(latestRun.startedAt).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Source Composition Indicator */}
              {data?.sourceCounts && (
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <span className="text-slate-600">Sources:</span>
                  <span className="px-1.5 py-0.5 bg-slate-900/60 border border-slate-800 rounded text-slate-400">
                    Invoices {data.sourceCounts.invoices}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-900/60 border border-slate-800 rounded text-slate-400">
                    Bank Txs {data.sourceCounts.bankTransactions}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-900/60 border border-slate-800 rounded text-slate-400">
                    Ledger {data.sourceCounts.ledgerEntries}
                  </span>
                  <span className="text-slate-600">
                    ({data.sourceCounts.totalSourceRecords} total)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                    Records
                  </span>
                  <p className="text-xl font-bold font-mono text-slate-100">
                    {latestRun ? latestRun.totalRecords : 0}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Matched
                  </span>
                  <p className="text-xl font-bold font-mono text-emerald-400">
                    {latestRun ? latestRun.matchedCount : 0}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Unresolved
                  </span>
                  <p className="text-xl font-bold font-mono text-amber-400">
                    {latestRun ? latestRun.unresolvedCount : 0}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
                    Resolution Rate
                  </span>
                  <p className="text-xl font-bold font-mono text-slate-100">
                    {formatMetricAsPercent(latestRun?.resolutionRate)}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                    Accuracy
                  </span>
                  <p className="text-xl font-bold font-mono text-cyan-300">
                    {formatMetricAsPercent(latestRun?.accuracy)}
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    AI Calls
                  </span>
                  <p className="text-xl font-bold font-mono text-purple-300">
                    {latestRun ? latestRun.aiCallCount : 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Grid: Exception Type Breakdown & Quick Link */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Exception Distribution */}
              <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-slate-200 tracking-tight">Open Exception Type Breakdown</h2>
                  <Link
                    href="/exceptions"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    View Exception Queue <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'AMOUNT_MISMATCH', label: 'Amount Mismatch', color: 'border-red-500/30 bg-red-500/10 text-red-300' },
                    { key: 'AMBIGUOUS_MATCH', label: 'Ambiguous Candidate', color: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
                    { key: 'DATE_MISMATCH', label: 'Date Window Out', color: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' },
                    { key: 'MISSING_RECORD', label: 'Missing Record', color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
                    { key: 'DUPLICATE', label: 'Duplicate Transaction', color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
                    { key: 'AI_UNAVAILABLE', label: 'AI Exception', color: 'border-slate-700 bg-slate-800/40 text-slate-400' },
                  ].map((exc) => {
                    const count = data?.exceptionBreakdown[exc.key] ?? 0;
                    return (
                      <div key={exc.key} className={`p-3 rounded-lg border ${exc.color} space-y-1`}>
                        <span className="block text-[10px] uppercase font-mono tracking-wider opacity-80">{exc.label}</span>
                        <span className="text-lg font-bold font-mono">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status / Callout Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-slate-200 tracking-tight">Reconciliation Policy</h2>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Deterministic rules lock exact ref and amount matches. Hard financial mismatches remain unresolved. AI resolves bounded ambiguous cases with strict safety gates.
                  </p>
                </div>
                {latestRun && (
                  <Link
                    href={`/reconciliation/${latestRun.id}`}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                  >
                    <span>View Latest Run Results</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Recent Reconciliation Runs Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-200 tracking-tight">Recent Reconciliation Runs</h2>
                <span className="text-[11px] font-mono text-slate-400">{data?.recentRuns.length ?? 0} runs recorded</span>
              </div>

              {data?.recentRuns.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  No historical runs found. Click &quot;Run Reconciliation&quot; to execute your first batch.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                        <th className="py-2.5 px-3">Run ID / Name</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Total Records</th>
                        <th className="py-2.5 px-3">Matched</th>
                        <th className="py-2.5 px-3">Unresolved</th>
                        <th className="py-2.5 px-3">Resolution Rate</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {data?.recentRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-100 block">{run.runNumber}</span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">{run.batchName}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(run.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-3 px-3">{run.totalRecords}</td>
                          <td className="py-3 px-3 text-emerald-400 font-bold">{run.matchedCount}</td>
                          <td className="py-3 px-3 text-amber-400">{run.unresolvedCount}</td>
                          <td className="py-3 px-3">
                            {formatMetricAsPercent(run.resolutionRate)}
                          </td>
                          <td className="py-3 px-3 text-cyan-300 font-bold">
                            {formatMetricAsPercent(run.accuracy)}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              run.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : run.status === 'FAILED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
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
                              Results
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isNewRunModalOpen && (
        <NewReconciliationModal onClose={() => setIsNewRunModalOpen(false)} />
      )}
    </AppShell>
  );
}
