'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { ExceptionDetailDrawer } from '@/components/ExceptionDetailDrawer';
import { 
  AlertTriangle, 
  Filter, 
  Search, 
  Loader2, 
  RefreshCw
} from 'lucide-react';

interface ExceptionQueueItem {
  id: string;
  runId: string;
  resultId: string | null;
  type: string;
  priority: string;
  reason: string;
  expectedValue: string | null;
  observedValue: string | null;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  run?: {
    runNumber: string;
    batchName: string;
  };
  result?: {
    id: string;
    status: string;
    method: string;
    invoice?: {
      invoiceNumber: string;
      vendorName: string;
      amountCents: number;
    } | null;
    bankTransaction?: {
      transactionRef: string;
      description: string;
      amountCents: number;
    } | null;
  } | null;
}

export default function ExceptionQueuePage() {
  const [exceptions, setExceptions] = useState<ExceptionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [resolvedFilter, setResolvedFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedException, setSelectedException] = useState<ExceptionQueueItem | null>(null);

  useEffect(() => {
    let ignore = false;
    let url = '/api/reconciliation/exceptions?limit=100&';
    if (resolvedFilter === 'OPEN') url += 'resolved=false&';
    if (resolvedFilter === 'RESOLVED') url += 'resolved=true&';
    if (selectedPriority !== 'ALL') url += `priority=${selectedPriority}&`;
    if (selectedType !== 'ALL') url += `type=${selectedType}&`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load exception queue');
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setExceptions(json.exceptions || []);
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
  }, [resolvedFilter, selectedPriority, selectedType, refreshKey]);

  const handleItemResolved = (updatedItem: ExceptionQueueItem) => {
    setExceptions((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? { ...item, ...updatedItem } : item))
    );
    setSelectedException(null);
  };

  // Local search filter
  const filteredExceptions = exceptions.filter((item) => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    const invRef = item.result?.invoice?.invoiceNumber.toLowerCase() ?? '';
    const vendor = item.result?.invoice?.vendorName.toLowerCase() ?? '';
    const bankRef = item.result?.bankTransaction?.transactionRef.toLowerCase() ?? '';
    const reason = item.reason.toLowerCase();
    return invRef.includes(q) || vendor.includes(q) || bankRef.includes(q) || reason.includes(q);
  });

  const openCount = exceptions.filter((e) => !e.resolved).length;
  const resolvedCount = exceptions.filter((e) => e.resolved).length;
  const highPriorityCount = exceptions.filter((e) => !e.resolved && (e.priority === 'HIGH' || e.priority === 'CRITICAL')).length;

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Exception Queue & Discrepancy Triage
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Unresolved financial records requiring operator review and manual resolution.
            </p>
          </div>

          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-mono transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase block">Open Exceptions</span>
            <span className="text-xl font-bold text-amber-400">{openCount}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase block">High Priority</span>
            <span className="text-xl font-bold text-red-400">{highPriorityCount}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase block">Resolved Exceptions</span>
            <span className="text-xl font-bold text-emerald-400">{resolvedCount}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase block">Reviewer Identity</span>
            <span className="text-xs font-bold text-slate-300 block truncate mt-1">DEMO_OPERATOR</span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 font-mono text-xs">
              {[
                { id: 'OPEN', label: 'Open Exceptions' },
                { id: 'RESOLVED', label: 'Resolved Exceptions' },
                { id: 'ALL', label: 'All Items' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setResolvedFilter(tab.id as 'ALL' | 'OPEN' | 'RESOLVED')}
                  className={`px-3 py-2 rounded-md transition-colors ${
                    resolvedFilter === tab.id
                      ? 'bg-slate-800 text-white font-semibold border-b-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 font-mono">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ref, vendor, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Sub-Filters */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-500" /> Priority:
              </span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-hidden"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Exception Type:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
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
          </div>
        </div>

        {/* Exception Queue Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-xs font-mono">Loading exception queue...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 text-red-400 text-xs font-mono">
              Failed to load exceptions: {error}
            </div>
          ) : filteredExceptions.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 font-mono space-y-2">
              <p>No exceptions match the selected filter criteria.</p>
            </div>
          ) : (
            <>
              {/* Limit Indicator */}
              {exceptions.length >= 100 && (
                <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400 font-mono">
                  Showing first 100 exceptions. Apply filters to narrow results.
                </div>
              )}
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[11px] font-medium uppercase tracking-wider">
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Exception Type</th>
                      <th className="py-3 px-3">Invoice Ref / Vendor</th>
                      <th className="py-3 px-3">Expected Value</th>
                      <th className="py-3 px-3">Observed Value</th>
                      <th className="py-3 px-3">Resolution State</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredExceptions.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedException(item)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            item.priority === 'HIGH' || item.priority === 'CRITICAL'
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          {item.type}
                        </td>
                        <td className="py-3 px-3 max-w-[200px]">
                          <span className="font-bold text-slate-100 block">
                            {item.result?.invoice?.invoiceNumber ?? '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate font-sans">
                            {item.result?.invoice?.vendorName ?? '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-[160px] truncate">
                          {item.expectedValue ?? (item.result?.invoice ? `$${(item.result.invoice.amountCents/100).toFixed(2)}` : '—')}
                        </td>
                        <td className="py-3 px-3 text-amber-400 max-w-[160px] truncate font-bold">
                          {item.observedValue ?? (item.result?.bankTransaction ? `$${(item.result.bankTransaction.amountCents/100).toFixed(2)}` : '—')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            item.resolved
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.resolved ? 'RESOLVED' : 'OPEN'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedException(item);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded transition-colors"
                          >
                            Triage & Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-800 font-mono">
                {filteredExceptions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedException(item)}
                    className="p-4 space-y-2 hover:bg-slate-800/30 cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-100">{item.type}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        item.resolved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {item.resolved ? 'RESOLVED' : 'OPEN'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans">{item.reason}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Exception Detail & Review Drawer */}
      {selectedException && (
        <ExceptionDetailDrawer
          exception={selectedException}
          onClose={() => setSelectedException(null)}
          onResolved={handleItemResolved}
        />
      )}
    </AppShell>
  );
}
