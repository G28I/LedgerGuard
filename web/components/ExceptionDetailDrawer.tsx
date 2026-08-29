'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export interface ExceptionItem {
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

interface ExceptionDetailDrawerProps {
  exception: ExceptionItem;
  onClose: () => void;
  onResolved: (updatedException: ExceptionItem) => void;
}

export function ExceptionDetailDrawer({ exception, onClose, onResolved }: ExceptionDetailDrawerProps) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResolving(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/reconciliation/exceptions/${exception.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Explicit non-human system identity for unauthenticated demo environment
          resolvedBy: 'DEMO_OPERATOR',
          resolutionNotes: resolutionNotes.trim() || 'Manually verified and resolved by demo operator.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.exception) {
        throw new Error(data.error || 'Failed to update exception resolution state');
      }

      onResolved(data.exception);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Resolution failed');
      setIsResolving(false);
    }
  };

  const result = exception.result;
  const invoice = result?.invoice;
  const bankTx = result?.bankTransaction;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold font-mono rounded-full border ${
              exception.priority === 'HIGH' || exception.priority === 'CRITICAL'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {exception.type}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Priority: {exception.priority}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 text-xs font-sans">
          {/* Resolution Status Banner */}
          {exception.resolved ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 font-mono text-emerald-300">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Exception Resolved</span>
              </div>
              <div className="text-[11px] space-y-1 text-slate-300 font-sans">
                <p><span className="font-mono text-slate-400">Resolved By:</span> {exception.resolvedBy}</p>
                <p><span className="font-mono text-slate-400">Resolved At:</span> {exception.resolvedAt ? new Date(exception.resolvedAt).toLocaleString() : '—'}</p>
                {exception.resolutionNotes && (
                  <p><span className="font-mono text-slate-400">Notes:</span> {exception.resolutionNotes}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl font-mono text-amber-300 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Status: OPEN (Requires Operator Review)</span>
            </div>
          )}

          {/* Section 1: Expected vs Observed Discrepancy Box */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 font-mono">
            <h3 className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Discrepancy Evidence Package
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Expected Value</span>
                <span className="font-bold text-slate-100 block truncate">
                  {exception.expectedValue ?? (invoice ? `$${(invoice.amountCents/100).toFixed(2)} (${invoice.invoiceNumber})` : '—')}
                </span>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block">Observed Value</span>
                <span className="font-bold text-amber-300 block truncate">
                  {exception.observedValue ?? (bankTx ? `$${(bankTx.amountCents/100).toFixed(2)} (${bankTx.transactionRef})` : '—')}
                </span>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-500 uppercase block">Root Cause Reason:</span>
              <p className="text-slate-300 text-xs leading-relaxed font-sans bg-slate-900 p-2.5 rounded border border-slate-800">
                {exception.reason}
              </p>
            </div>
          </div>

          {/* Section 2: Linked Source Records */}
          <div className="space-y-2 font-mono text-xs">
            <h3 className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Linked Financial Source Records
            </h3>

            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-bold text-slate-100">{invoice?.invoiceNumber ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vendor Name:</span>
                <span className="text-slate-200">{invoice?.vendorName ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Bank Candidate:</span>
                <span className="text-indigo-300">{bankTx?.transactionRef ?? 'None Matched'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Review Action Form */}
          {!exception.resolved && (
            <form onSubmit={handleResolve} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] text-slate-200 uppercase font-semibold">Review & Resolve Action</span>
                <span className="text-[10px] text-slate-500">Identity: DEMO_OPERATOR</span>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[11px]">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-medium text-slate-300">Resolution Notes (Optional)</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Enter manual auditor notes or verification explanation..."
                  rows={3}
                  disabled={isResolving}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isResolving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50 font-sans"
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Persisting Resolution...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve Exception</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors font-mono"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
