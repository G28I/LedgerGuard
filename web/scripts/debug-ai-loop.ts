import { generateSyntheticBenchmarkBatch } from '../features/synthetic';
import { runReconciliationEngine, DEFAULT_RECONCILIATION_POLICY } from '../features/reconciliation';
import { generateCandidatePairs } from '../features/reconciliation/candidates';

const dataset = generateSyntheticBenchmarkBatch({ seed: 42, totalCases: 200 });
const decisions = runReconciliationEngine(
  dataset.sourceRecords.invoices,
  dataset.sourceRecords.bankTransactions,
  dataset.sourceRecords.ledgerEntries,
  DEFAULT_RECONCILIATION_POLICY
);
const candidatesMap = generateCandidatePairs(
  dataset.sourceRecords.invoices,
  dataset.sourceRecords.bankTransactions,
  dataset.sourceRecords.ledgerEntries,
  DEFAULT_RECONCILIATION_POLICY
);

console.log(`Total Invoices: ${dataset.sourceRecords.invoices.length}`);
console.log(`Total Decisions: ${decisions.length}`);

const statusCounts: Record<string, number> = {};
const reasonCounts: Record<string, number> = {};

decisions.forEach((d) => {
  statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  reasonCounts[d.reasonCode] = (reasonCounts[d.reasonCode] ?? 0) + 1;
});

console.log('\nStatus Breakdown:', statusCounts);
console.log('Reason Code Breakdown:', reasonCounts);

let eligibleCount = 0;
decisions.forEach((d) => {
  if (d.status === 'MATCHED' || d.reasonCode === 'EXACT_REF_AND_AMOUNT_MATCH' || d.reasonCode === 'AMOUNT_MISMATCH') {
    return;
  }
  if (d.reasonCode === 'MISSING_RECORD' || d.reasonCode === 'DUPLICATE_TRANSACTION_DETECTED') {
    return;
  }
  const c = candidatesMap.get(d.invoiceId ?? '');
  console.log(`Eligible Unresolved Invoice ID: ${d.invoiceId}, Reason: ${d.reasonCode}, Candidates Count: ${c?.length ?? 0}`);
  if (c && c.length > 0) eligibleCount++;
});

console.log(`\nTotal Eligible Candidates for AI: ${eligibleCount}`);
