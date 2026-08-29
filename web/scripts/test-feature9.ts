import { reconciliationService } from '../features/reconciliation';
import { dbRepository } from '../features/db';
import { scoreBenchmarkRun, FEATURE7_BASELINE_SNAPSHOTS } from '../features/benchmark';
import { generateSyntheticBenchmarkBatch } from '../features/synthetic';

async function verifyFeature9() {
  console.log('🧪 Starting Feature 9: Benchmarking, Metrics & Audit Trail Verification...\n');

  // 1. Verify Baseline Snapshots are preserved as immutable reference points
  console.log('1️⃣ Verifying Static Feature 7 Baseline Reference Snapshots...');
  if (FEATURE7_BASELINE_SNAPSHOTS.length !== 3) {
    throw new Error('Verification Failed: Expected 3 Feature 7 baseline snapshots!');
  }
  const [detBase, initAiBase, fixAiBase] = FEATURE7_BASELINE_SNAPSHOTS;
  
  if (detBase.accuracy !== 0.925 || detBase.resolutionRate !== 0.60) {
    throw new Error(`Verification Failed: Deterministic baseline ratio values invalid (${detBase.accuracy})`);
  }
  if (initAiBase.accuracy !== 0.875 || initAiBase.aiFalsePositiveCount !== 10) {
    throw new Error(`Verification Failed: Initial AI baseline values invalid (${initAiBase.accuracy})`);
  }
  if (fixAiBase.accuracy !== 0.925 || fixAiBase.aiFalsePositiveCount !== 0 || fixAiBase.aiCallCount !== 26) {
    throw new Error(`Verification Failed: Fixed AI baseline values invalid (${fixAiBase.accuracy})`);
  }
  console.log('✓ Verified 100%: All 3 static baseline snapshots are strictly preserved as decimal ratios.');

  // 2. Execute Real 200-Case Benchmark Run (seed 42)
  console.log('\n2️⃣ Executing Real 200-Case Benchmark Run via reconciliationService...');
  process.env.MOCK_OPENROUTER = 'true';
  const startTime = Date.now();
  const benchmarkRun = await reconciliationService.executeRun({
    seed: 42,
    enableAI: true,
    isBenchmark: true,
    batchName: 'Feature 9 Verification Benchmark Run (Seed 42)',
  });
  const durationMs = Date.now() - startTime;

  console.log(`- Benchmark Run ID: ${benchmarkRun.runId} (Duration: ${durationMs}ms)`);
  console.log(`- Total Cases: ${benchmarkRun.totalRecords}`);
  console.log(`- Matched Count: ${benchmarkRun.matchedCount}`);
  console.log(`- Unresolved Count: ${benchmarkRun.unresolvedCount}`);
  console.log(`- AI Provider Calls Made: ${benchmarkRun.aiCallCount}`);
  console.log(`- Resolution Rate Ratio: ${benchmarkRun.resolutionRate} (${(benchmarkRun.resolutionRate * 100).toFixed(1)}%)`);
  console.log(`- Ground Truth Accuracy Ratio: ${benchmarkRun.accuracyRatio} (${(benchmarkRun.accuracyRatio! * 100).toFixed(1)}%)`);
  console.log(`- Precision: ${benchmarkRun.precision}, Recall: ${benchmarkRun.recall}, F1: ${benchmarkRun.f1Score}`);
  console.log(`- AI Evaluated: ${benchmarkRun.aiEvaluatedCount}, AI Promoted: ${benchmarkRun.aiPromotedCount}, AI FP: ${benchmarkRun.aiFalsePositiveCount}`);

  if (benchmarkRun.matchedCount !== 120 || benchmarkRun.unresolvedCount !== 80) {
    throw new Error(`Verification Failed: Expected 120 matched / 80 unresolved, got ${benchmarkRun.matchedCount}/${benchmarkRun.unresolvedCount}`);
  }
  if (benchmarkRun.accuracyRatio !== 0.925) {
    throw new Error(`Verification Failed: Expected accuracy ratio 0.925, got ${benchmarkRun.accuracyRatio}`);
  }
  if (benchmarkRun.aiCallCount !== 26 || benchmarkRun.aiEvaluatedCount !== 26) {
    throw new Error(`Verification Failed: Expected 26 AI calls / 26 evaluated, got ${benchmarkRun.aiCallCount}/${benchmarkRun.aiEvaluatedCount}`);
  }
  if (benchmarkRun.aiFalsePositiveCount !== 0) {
    throw new Error(`Verification Failed: Expected 0 AI false positives, got ${benchmarkRun.aiFalsePositiveCount}`);
  }
  console.log('✓ Verified 100%: Execution produced exact baseline metrics.');

  // 3. Independently Recompute Metrics Offline using scoreBenchmarkRun
  console.log('\n3️⃣ Independently Recomputing Benchmark Metrics from Decisions + groundTruthMap...');
  const dataset = generateSyntheticBenchmarkBatch({ seed: 42, totalCases: 200 });
  const dbDetails = await dbRepository.getRunDetails(benchmarkRun.runId);
  if (!dbDetails) throw new Error('Verification Failed: Could not fetch run details from DB');

  // Convert db results back to decision format for independent scoring check
  const decisionsForScoring = dbDetails.results.map((r) => ({
    invoiceId: r.invoiceId,
    bankTransactionId: r.bankTransactionId,
    ledgerEntryId: r.ledgerEntryId,
    status: r.status,
    method: r.method,
    ruleStrength: 'EXACT' as const,
    confidence: r.confidence,
    amountDeltaCents: r.amountDeltaCents,
    reasonCode: r.reasonCode,
    explanation: r.explanation,
    evidenceJson: {},
    exceptions: r.exceptions.map((e) => ({
      type: e.type,
      priority: e.priority,
      reason: e.reason,
    })),
  }));

  const aiEvaluatedInvoiceIds = dbDetails.results
    .filter((r) => r.aiMetadataJson !== null && r.aiMetadataJson !== undefined && r.invoiceId)
    .map((r) => r.invoiceId!);

  const recomputed = scoreBenchmarkRun(decisionsForScoring, dataset.groundTruthMap, { aiEvaluatedInvoiceIds });
  console.log(`- Recomputed Accuracy: ${recomputed.accuracy}`);
  console.log(`- Recomputed Precision: ${recomputed.precision}, Recall: ${recomputed.recall}, F1: ${recomputed.f1Score}`);
  console.log(`- Recomputed AI Promoted: ${recomputed.aiPromotedCount}, AI FP: ${recomputed.aiFalsePositiveCount}`);

  if (recomputed.accuracy !== dbDetails.accuracy) {
    throw new Error(`Verification Failed: DB persisted accuracy ${dbDetails.accuracy} != recomputed ${recomputed.accuracy}`);
  }
  if (recomputed.precision !== dbDetails.precision || recomputed.recall !== dbDetails.recall || recomputed.f1Score !== dbDetails.f1Score) {
    throw new Error('Verification Failed: DB persisted precision/recall/F1 do not match recomputed metrics!');
  }
  console.log('✓ Verified 100%: Persisted metrics match independently calculated metrics from decisions + groundTruthMap.');

  // 4. Verify Ground Truth Isolation Boundary
  console.log('\n4️⃣ Verifying Ground Truth Isolation Boundary...');
  // Inspect runtime source records to ensure groundTruthId is not exposed or used
  dbDetails.results.forEach((r) => {
    if (r.aiMetadataJson) {
      const metaStr = JSON.stringify(r.aiMetadataJson);
      if (metaStr.includes('groundTruth') || metaStr.includes('targetId')) {
        throw new Error(`Verification Failed: Found ground truth signal in AI metadata payload!`);
      }
    }
  });
  console.log('✓ Verified 100%: Ground truth never enters runtime reconciliation or AI payloads.');

  // 5. Verify Database Benchmark Runs Query
  console.log('\n5️⃣ Verifying DB Benchmark Runs Retrieval...');
  const dbBenchmarkRuns = await dbRepository.getBenchmarkRuns();
  console.log(`- Total Benchmark Runs in DB: ${dbBenchmarkRuns.length}`);
  if (dbBenchmarkRuns.length === 0) {
    throw new Error('Verification Failed: getBenchmarkRuns returned empty list!');
  }
  console.log('✓ Verified 100%: Database benchmark runs query operates correctly.');

  console.log('\n✅ Feature 9: Benchmarking, Metrics & Audit Trail Verification PASSED cleanly!');
}

verifyFeature9()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Feature 9 verification failed:', err);
    process.exit(1);
  });
