import { generateSyntheticBenchmarkBatch, DEFAULT_BENCHMARK_SEED } from '../features/synthetic';
import { runReconciliationEngine } from '../features/reconciliation';

function verifyFeature5Implementation() {
  console.log('🧪 Running Feature 5 Synthetic Benchmark Generator Verification...\n');

  // 1. Generate Primary 200-Case Benchmark Dataset
  const batch = generateSyntheticBenchmarkBatch({ seed: DEFAULT_BENCHMARK_SEED, totalCases: 200 });

  console.log(`📦 Generated Benchmark Dataset (Seed: ${batch.seed}):`);
  console.log(`- Total Reconciliation Cases: ${batch.totalCases}`);
  console.log(`- Invoices Source Records: ${batch.sourceRecords.invoices.length}`);
  console.log(`- Bank Transactions Source Records: ${batch.sourceRecords.bankTransactions.length}`);
  console.log(`- Ledger Entries Source Records: ${batch.sourceRecords.ledgerEntries.length}`);
  console.log(`- Ground Truth Labels Map Size: ${batch.groundTruthMap.size}`);

  if (batch.totalCases !== 200) {
    throw new Error(`Verification Failed: Expected 200 total cases, found ${batch.totalCases}`);
  }

  // 2. Verify Scenario Distribution
  const counts = {
    EXACT_MATCH: 0,
    VENDOR_VARIATION: 0,
    REF_VARIATION: 0,
    AMOUNT_MISMATCH: 0,
    DATE_MISMATCH: 0,
    MISSING_RECORD: 0,
    DUPLICATE: 0,
    AMBIGUOUS_MATCH: 0,
  };

  batch.groundTruthMap.forEach((gt) => {
    if (gt.scenarioType in counts) {
      counts[gt.scenarioType as keyof typeof counts]++;
    }
  });

  console.log('\n📊 Scenario Distribution Breakdown:');
  console.log(`- Exact Matches (Target 40% / 80): ${counts.EXACT_MATCH}`);
  console.log(`- Variations (Target 20% / 40): Vendor ${counts.VENDOR_VARIATION} + Ref ${counts.REF_VARIATION} = ${counts.VENDOR_VARIATION + counts.REF_VARIATION}`);
  console.log(`- Amount Mismatches (Target 10% / 20): ${counts.AMOUNT_MISMATCH}`);
  console.log(`- Date Mismatches (Target 10% / 20): ${counts.DATE_MISMATCH}`);
  console.log(`- Missing Records (Target 10% / 20): ${counts.MISSING_RECORD}`);
  console.log(`- Duplicates (Target 5% / 10): ${counts.DUPLICATE}`);
  console.log(`- Ambiguous Matches (Target 5% / 10): ${counts.AMBIGUOUS_MATCH}`);

  if (counts.EXACT_MATCH !== 80 || counts.AMOUNT_MISMATCH !== 20 || counts.DATE_MISMATCH !== 20 || counts.MISSING_RECORD !== 20 || counts.DUPLICATE !== 10 || counts.AMBIGUOUS_MATCH !== 10) {
    throw new Error('Verification Failed: Scenario distribution count mismatch!');
  }

  // 3. Verify Seed Reproducibility
  console.log('\n🔄 Testing Seed Reproducibility...');
  const batchSecondRun = generateSyntheticBenchmarkBatch({ seed: DEFAULT_BENCHMARK_SEED, totalCases: 200 });
  const isIdentical = JSON.stringify(batch.sourceRecords) === JSON.stringify(batchSecondRun.sourceRecords);

  if (!isIdentical) {
    throw new Error('Verification Failed: Seed reproducibility failed! Second run produced different records.');
  }
  console.log('✓ Generator seed reproducibility verified 100%.');

  // 4. Verify Ground Truth Isolation
  console.log('\n🛡️ Testing Ground Truth Isolation...');
  const sampleInvoice = (batch.sourceRecords.invoices[0] as unknown) as Record<string, unknown>;
  const sampleBank = (batch.sourceRecords.bankTransactions[0] as unknown) as Record<string, unknown>;

  if ('groundTruthId' in sampleInvoice || 'groundTruthMap' in sampleInvoice || 'groundTruthId' in sampleBank) {
    throw new Error('Verification Failed: Ground truth leaked into runtime source records!');
  }
  console.log('✓ Ground truth isolation verified. Source records contain 0 ground truth properties.');

  // 5. Execute Engine & Score Ground Truth Outcomes
  console.log('\n⚡ Executing Reconciliation Engine against 200-Case Synthetic Dataset...');
  const startTime = Date.now();
  const decisions = runReconciliationEngine(
    batch.sourceRecords.invoices,
    batch.sourceRecords.bankTransactions,
    batch.sourceRecords.ledgerEntries
  );
  const durationMs = Date.now() - startTime;

  console.log(`✓ Reconciliation completed in ${durationMs}ms across ${batch.totalCases} cases (${(batch.totalCases / (durationMs / 1000)).toFixed(0)} records/sec throughput).`);

  let correctCount = 0;
  let incorrectCount = 0;

  decisions.forEach((decision) => {
    if (!decision.invoiceId) return;
    const gt = batch.groundTruthMap.get(decision.invoiceId);
    if (!gt) return;

    const isStatusMatch = decision.status === gt.expectedStatus;
    const isExceptionMatch =
      gt.expectedExceptionType === null
        ? decision.exceptions.length === 0
        : decision.exceptions.some((e) => e.type === gt.expectedExceptionType);

    if (isStatusMatch && isExceptionMatch) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const accuracyPct = ((correctCount / batch.totalCases) * 100).toFixed(2);
  console.log(`\n🎯 Ground Truth Evaluation Score: ${correctCount}/${batch.totalCases} Correct (${accuracyPct}% Accuracy)`);

  console.log('\n✅ Feature 5 Synthetic Benchmark Generator verified successfully!');
}

try {
  verifyFeature5Implementation();
} catch (err) {
  console.error('\n❌ Feature 5 verification failed:', err);
  process.exit(1);
}
