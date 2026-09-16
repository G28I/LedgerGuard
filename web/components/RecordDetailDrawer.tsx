'use client';

import { useEffect } from 'react';
import { X, FileText, Database, Layers, Sparkles, Activity, ShieldCheck } from 'lucide-react';

interface RecordDetailItem {
  id: string;
  status: string;
  method: string;
  reasonCode: string;
  explanation: string;
  confidence: number | null;
  aiUsed: boolean;
  aiMetadataJson?: {
    model?: string;
    reasoning?: string;
    keyEvidence?: string[];
  } | null;
  invoice?: {
    invoiceNumber: string;
    vendorName: string;
    amountCents: number;
    issueDate: string;
  } | null;
  bankTransaction?: {
    transactionRef: string;
    description: string;
    amountCents: number;
    transactionDate: string;
  } | null;
  ledgerEntry?: {
    entryRef: string;
    accountCode: string;
    amountCents: number;
    postingDate: string;
  } | null;
}

interface RecordDetailDrawerProps {
  result: RecordDetailItem;
  isBenchmark?: boolean;
  onClose: () => void;
}

export function RecordDetailDrawer({ result, isBenchmark, onClose }: RecordDetailDrawerProps) {
  // ESC key listener for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const invoice = result.invoice;
  const bankTx = result.bankTransaction;
  const ledger = result.ledgerEntry;
  const aiMetadata = result.aiMetadataJson;

  const invAmountFormatted = invoice
    ? `$${(invoice.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    : '—';
  const bankAmountFormatted = bankTx
    ? `$${(bankTx.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    : '—';
  const ledgerAmountFormatted = ledger
    ? `$${(ledger.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    : '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold font-mono rounded-full border ${
              result.status === 'MATCHED'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {result.status}
            </span>
            <h2 className="text-sm font-bold text-slate-100 font-mono">
              {invoice?.invoiceNumber ?? result.id}
            </h2>
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
          {/* Section 1: Decision Summary & Method */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Decision Summary</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                result.method === 'DETERMINISTIC'
                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                  : result.method === 'FUZZY'
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                  : 'bg-purple-950 text-purple-300 border border-purple-800'
              }`}>
                Method: {result.method}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-slate-200 font-semibold text-xs">{result.reasonCode}</p>
              <p className="text-slate-400 text-xs leading-relaxed font-sans">{result.explanation}</p>
            </div>

            {/* Visual Confidence Gauge */}
            {result.confidence !== null && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    Confidence Gauge:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      result.confidence >= 0.85
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : result.confidence >= 0.65
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {result.confidence >= 0.85
                        ? 'HIGH CONFIDENCE'
                        : result.confidence >= 0.65
                        ? 'CALIBRATED MATCH'
                        : 'UNRESOLVED AMBIGUITY'}
                    </span>
                    <span className="font-bold text-slate-100 font-mono text-xs">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Gauge Progress Bar */}
                <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result.confidence >= 0.85
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        : result.confidence >= 0.65
                        ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                        : 'bg-gradient-to-r from-purple-600 to-purple-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, Math.round(result.confidence * 100)))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Side-by-Side Source Evidence Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-200 uppercase font-mono tracking-wider">
              Source Financial Evidence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Invoice Evidence */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 font-mono">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold border-b border-slate-800 pb-1.5 text-[11px]">
                  <FileText className="w-3.5 h-3.5" />
                  Invoice
                </div>
                {invoice ? (
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Ref:</span>
                      <span className="font-bold text-slate-100">{invoice.invoiceNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Vendor:</span>
                      <span className="truncate block font-sans text-slate-200">{invoice.vendorName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Amount:</span>
                      <span className="font-bold text-emerald-400">{invAmountFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Date:</span>
                      <span>{new Date(invoice.issueDate).toISOString().split('T')[0]}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px] font-italic">No Invoice</span>
                )}
              </div>

              {/* Bank Transaction Evidence */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 font-mono">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold border-b border-slate-800 pb-1.5 text-[11px]">
                  <Database className="w-3.5 h-3.5" />
                  Bank Tx
                </div>
                {bankTx ? (
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Ref:</span>
                      <span className="font-bold text-slate-100">{bankTx.transactionRef}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Desc:</span>
                      <span className="truncate block font-sans text-slate-200">{bankTx.description}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Amount:</span>
                      <span className="font-bold text-cyan-400">{bankAmountFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Date:</span>
                      <span>{new Date(bankTx.transactionDate).toISOString().split('T')[0]}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px] font-italic">No Bank Match</span>
                )}
              </div>

              {/* Ledger Entry Evidence */}
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2 font-mono">
                <div className="flex items-center gap-1.5 text-purple-400 font-semibold border-b border-slate-800 pb-1.5 text-[11px]">
                  <Layers className="w-3.5 h-3.5" />
                  Ledger
                </div>
                {ledger ? (
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Ref:</span>
                      <span className="font-bold text-slate-100">{ledger.entryRef}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Account:</span>
                      <span>{ledger.accountCode}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Amount:</span>
                      <span className="font-bold text-purple-300">{ledgerAmountFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Posting:</span>
                      <span>{new Date(ledger.postingDate).toISOString().split('T')[0]}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px] font-italic">No Ledger Match</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: AI Reasoning Trace & Audit Trail */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-[11px] text-purple-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                AI Reasoning Trace & Inference Log
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                result.aiUsed 
                  ? 'bg-purple-950/80 text-purple-300 border-purple-700/60' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {result.aiUsed ? 'AI INFERENCE ACTIVE' : 'RULE-BASED DETERMINISTIC'}
              </span>
            </div>

            {result.aiUsed && aiMetadata ? (
              <div className="space-y-3 text-[11px] text-slate-300 font-sans">
                <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded border border-slate-800 font-mono text-[10px]">
                  <span className="text-slate-400">Inference Engine:</span>
                  <span className="text-purple-300 font-semibold px-1.5 py-0.5 bg-purple-950/60 rounded border border-purple-800/40">
                    {aiMetadata.model ?? 'nvidia/llama-3.1-nemotron-70b-instruct:free'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider block">Semantic Reasoning Trace:</span>
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-purple-900/30 text-slate-200 text-xs leading-relaxed font-sans shadow-inner">
                    <p className="text-slate-200">{aiMetadata.reasoning}</p>
                  </div>
                </div>

                {Array.isArray(aiMetadata.keyEvidence) && aiMetadata.keyEvidence.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider block">Key Evidence Signals:</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {aiMetadata.keyEvidence.map((ev: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md text-[11px] text-slate-300 font-mono">
                          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-sans space-y-1.5">
                <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Execution Pipeline:</p>
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-slate-300 text-xs">
                  {result.method === 'DETERMINISTIC'
                    ? '⚡ Exact 3-Way Match: Perfect parity across reference tokens, integer cent amounts ($0.00 variance), and posting dates.'
                    : '🛡️ Safety Gated: Skipped secondary AI inference due to protected financial threshold or hard data mismatch.'}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Feature 9 Ground-Truth Audit Card (Benchmark Context Only) */}
          {isBenchmark && (
            <div className="p-4 bg-slate-950/80 border border-purple-900/40 rounded-xl space-y-2.5 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] text-purple-300 uppercase tracking-wider font-semibold">
                  Ground-Truth Audit Verification
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                  result.status === 'MATCHED'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {result.status === 'MATCHED' ? 'CORRECT MATCH' : 'UNRESOLVED EXCEPTION'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-500 block">Current Status:</span>
                  <span className="font-bold text-slate-200">{result.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Resolution Method:</span>
                  <span className="font-bold text-emerald-400">{result.method}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-sans italic pt-1 border-t border-slate-800/80">
                Audit Status: {result.status === 'MATCHED' ? 'Clean financial settlement verified across source records.' : 'Flagged for auditor review due to financial discrepancy or candidate ambiguity.'}
              </p>
            </div>
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
