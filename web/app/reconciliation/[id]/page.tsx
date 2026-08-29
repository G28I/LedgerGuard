'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { RecordDetailDrawer } from '@/components/RecordDetailDrawer';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Loader2
} from 'lucide-react';

interface ReconciliationResultItem {
  id: string;
  runId: string;
  invoiceId: string | null;
  bankTransactionId: string | null;
  ledgerEntryId: string | null;
  status: 'MATCHED' | 'MISMATCH' | 'UNRESOLVED';
  method: 'DETERMINISTIC' | 'FUZZY' | 'AI';
  aiUsed: boolean;
  confidence: number | null;
  amountDeltaCents: number;
  reasonCode: string;
  explanation: string;
  evidenceJson: Record<string, unknown> | null;
  aiMetadataJson: Record<string, unknown> | null;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    vendorName: string;
    amountCents: number;
    currency: string;
    issueDate: string;
  } | null;
  bankTransaction?: {
    id: string;
    transactionRef: string;
    description: string;
    amountCents: number;
    currency: string;
    transactionDate: string;
  } | null;
  ledgerEntry?: {
    id: string;
    entryRef: string;
    accountCode: string;
    description: string;
    amountCents: number;
    currency: string;
    postingDate: string;
  } | null;
  exceptions?: Array<{
    id: string;
    type: string;
    priority: string;
    reason: string;
  }>;
}

interface RunDetailsData {
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
  results: ReconciliationResultItem[];
}

export default function ReconciliationResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const runId = resolvedParams.id;

  const [data, setData] = useState<RunDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [activeTab, setActiveTab] = useState<'ALL' | 'MATCHED' | 'UNRESOLVED' | 'AI_EVALUATED'>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedExceptionType, setSelectedExceptionType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Result for Drawer
  const [selectedResult, setSelectedResult] = useState<ReconciliationResultItem | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/reconciliation/run/${runId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load run details');
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
  }, [runId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-30 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-xs font-mono">Loading reconciliation results for run {runId}...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="p-8 max-w-xl mx-auto space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
            {error || 'Run details unavailable'}
          </div>
          <Link href="/" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Overview
          </Link>
        </div>
      </AppShell>
    );
  }

  // Calculate throughput
  const throughputRecSec = data.durationMs && data.durationMs > 0
    ? ((data.totalRecords / data.durationMs) * 1000).toFixed(1)
    : '—';

  // Apply filters
  const filteredResults = data.results.filter((item) => {
    // 1. Tab filter
    if (activeTab === 'MATCHED' && item.status !== 'MATCHED') return false;
    if (activeTab === 'UNRESOLVED' && item.status === 'MATCHED') return false;
    if (activeTab === 'AI_EVALUATED' && !item.aiUsed) return false;

    // 2. Method filter
    if (selectedMethod !== 'ALL' && item.method !== selectedMethod) return false;

    // 3. Exception Type filter
    if (selectedExceptionType !== 'ALL') {
      const hasExc = item.exceptions?.some((e) => e.type === selectedExceptionType);
      if (!hasExc) return false;
    }

    // 4. Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const invRef = item.invoice?.invoiceNumber.toLowerCase() ?? '';
      const vendor = item.invoice?.vendorName.toLowerCase() ?? '';
      const bankRef = item.bankTransaction?.transactionRef.toLowerCase() ?? '';
      const bankDesc = item.bankTransaction?.description.toLowerCase() ?? '';
      if (!invRef.includes(q) && !vendor.includes(q) && !bankRef.includes(q) && !bankDesc.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const aiEvaluatedCount = data.results.filter((r) => r.aiUsed).length;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Top Header Navigation & Meta */}
        <div className="space-y-4 border-b border-slate-800 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-100 font-mono tracking-tight">{data.runNumber}</h1>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                    {data.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{data.batchName}</p>
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-slate-400 hidden sm:block">
              <span>Executed {new Date(data.startedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Operational Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-1 font-mono">
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Total Records</span>
              <span className="text-sm font-bold text-slate-200">{data.totalRecords}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Matched</span>
              <span className="text-sm font-bold text-emerald-400">{data.matchedCount}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Unresolved</span>
              <span className="text-sm font-bold text-amber-400">{data.unresolvedCount}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Resolution Rate</span>
              <span className="text-sm font-bold text-slate-200">
                {data.resolutionRate !== null ? `${(data.resolutionRate * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Accuracy</span>
              <span className="text-sm font-bold text-cyan-300">
                {data.accuracy !== null ? `${data.accuracy}%` : 'N/A'}
              </span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">AI Provider Calls</span>
              <span className="text-sm font-bold text-purple-300">{data.aiCallCount}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-lg">
              <span className="text-[10px] text-slate-400 block uppercase">Throughput</span>
              <span className="text-sm font-bold text-slate-300">{throughputRecSec} rec/s</span>
            </div>
          </div>
        </div>

        {/* Filter Controls & Tabs */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            {/* Primary Tab Filters */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium">
              {[
                { id: 'ALL', label: 'All Results', count: data.totalRecords },
                { id: 'MATCHED', label: 'Matched', count: data.matchedCount },
                { id: 'UNRESOLVED', label: 'Unresolved / Exceptions', count: data.unresolvedCount },
                { id: 'AI_EVALUATED', label: 'AI Evaluated', count: aiEvaluatedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'ALL' | 'MATCHED' | 'UNRESOLVED' | 'AI_EVALUATED')}
                  className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-white font-semibold border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-950/80 text-slate-400 rounded-full border border-slate-800">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter ref, vendor, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Sub-Filters: Method & Exception Type */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-500" /> Method:
              </span>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-hidden"
              >
                <option value="ALL">All Methods</option>
                <option value="DETERMINISTIC">DETERMINISTIC</option>
                <option value="FUZZY">FUZZY</option>
                <option value="AI">AI</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Exception Type:</span>
              <select
                value={selectedExceptionType}
                onChange={(e) => setSelectedExceptionType(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-hidden"
              >
                <option value="ALL">All Exception Types</option>
                <option value="AMOUNT_MISMATCH">AMOUNT_MISMATCH</option>
                <option value="AMBIGUOUS_MATCH">AMBIGUOUS_MATCH</option>
                <option value="DATE_MISMATCH">DATE_MISMATCH</option>
                <option value="MISSING_RECORD">MISSING_RECORD</option>
                <option value="DUPLICATE">DUPLICATE</option>
                <option value="AI_UNAVAILABLE">AI_UNAVAILABLE</option>
              </select>
            </div>

            {(selectedMethod !== 'ALL' || selectedExceptionType !== 'ALL' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedMethod('ALL');
                  setSelectedExceptionType('ALL');
                  setSearchQuery('');
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Results Table (Desktop) & Cards (Mobile Responsive) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {filteredResults.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono space-y-2">
              <p>No reconciliation results match the active filter criteria.</p>
              <button
                onClick={() => {
                  setActiveTab('ALL');
                  setSelectedMethod('ALL');
                  setSelectedExceptionType('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Dense Financial Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Invoice Ref</th>
                      <th className="py-3 px-3">Vendor / Bank Desc</th>
                      <th className="py-3 px-3 text-right">Invoice Amount</th>
                      <th className="py-3 px-3">Matched Bank Tx</th>
                      <th className="py-3 px-3 text-right">Amount Delta</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3 text-center">Confidence</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredResults.map((item) => {
                      const amountFormatted = item.invoice
                        ? `$${(item.invoice.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—';
                      const deltaFormatted = item.amountDeltaCents !== 0
                        ? `$${(item.amountDeltaCents / 100).toFixed(2)}`
                        : '$0.00';

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedResult(item)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              item.status === 'MATCHED'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : item.status === 'MISMATCH'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-100 block">
                              {item.invoice?.invoiceNumber ?? '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[220px]">
                            <span className="text-slate-200 block truncate">
                              {item.invoice?.vendorName ?? '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {item.bankTransaction?.description ?? 'No Bank Tx Candidate'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-100">
                            {amountFormatted}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {item.bankTransaction ? (
                              <span className="text-indigo-300 font-medium block">
                                {item.bankTransaction.transactionRef}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-italic">No Match</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={item.amountDeltaCents !== 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                              {deltaFormatted}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                              item.method === 'DETERMINISTIC'
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : item.method === 'FUZZY'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}>
                              {item.method}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400">
                            {item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResult(item);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Stacked Cards (<768px) */}
              <div className="md:hidden divide-y divide-slate-800">
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedResult(item)}
                    className="p-4 space-y-2 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-100 font-mono">
                        {item.invoice?.invoiceNumber ?? 'Record'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        item.status === 'MATCHED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <p><span className="text-slate-400">Vendor:</span> {item.invoice?.vendorName ?? '—'}</p>
                      <p><span className="text-slate-400">Bank Tx:</span> {item.bankTransaction?.transactionRef ?? 'None'}</p>
                      <div className="flex items-center justify-between font-mono pt-1 text-[11px]">
                        <span>Amount: ${( (item.invoice?.amountCents ?? 0) / 100).toFixed(2)}</span>
                        <span className="text-indigo-400 font-semibold">{item.method}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Record Detail Side Drawer */}
      {selectedResult && (
        <RecordDetailDrawer
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </AppShell>
  );
}
