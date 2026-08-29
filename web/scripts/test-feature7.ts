import { reconciliationService } from '../features/reconciliation';
import { dbRepository } from '../features/db';

async function verifyFeature7Implementation() {
  console.log('🧪 Running Feature 7 AI Ambiguity Resolver Verification...\n');

  // 1. Execute Baseline Deterministic Run (enableAI: false)
  console.log('1️⃣ Running Deterministic Baseline Run (enableAI: false)...');
  const baseline = await reconciliationService.executeRun({
    seed: 42,
    enableAI: false,
    batchName: 'Baseline Deterministic Run (Seed 42)',
  });

  console.log(`- Deterministic Baseline Accuracy: ${baseline.accuracyPercentage}%`);
  console.log(`- Deterministic Baseline Resolution Rate: ${(baseline.resolutionRate * 100).toFixed(2)}% (${baseline.matchedCount}/${baseline.totalRecords} Matched, ${baseline.unresolvedCount} Unresolved)`);
  console.log(`- Deterministic AI Call Count: ${baseline.aiCallCount}`);

  if (baseline.matchedCount !== 120 || baseline.unresolvedCount !== 80 || baseline.accuracyPercentage !== 92.5) {
    throw new Error('Verification Failed: Deterministic baseline metrics changed!');
  }

  // 2. Execute AI-Assisted Resolution Run (Mock Mode for 100% deterministic test execution)
  process.env.MOCK_OPENROUTER = 'true';
  console.log('\n2️⃣ Running AI-Assisted Resolution Run (enableAI: true, Mock OpenRouter)...');
  const startTime = Date.now();
  const aiRun = await reconciliationService.executeRun({
    seed: 42,
    enableAI: true,
    batchName: 'AI-Assisted Resolution Run (Seed 42)',
  });
  const durationMs = Date.now() - startTime;

  console.log(`\n🤖 AI-Assisted Run Summary Response (Completed in ${durationMs}ms):`);
  console.log(`- Run ID: ${aiRun.runId}`);
  console.log(`- Total Records: ${aiRun.totalRecords}`);
  console.log(`- Matched Count: ${aiRun.matchedCount} (Baseline: ${baseline.matchedCount})`);
  console.log(`- Unresolved Count: ${aiRun.unresolvedCount} (Baseline: ${baseline.unresolvedCount})`);
  console.log(`- AI Provider Calls Made (aiCallCount): ${aiRun.aiCallCount}`);
  console.log(`- AI-Assisted Resolution Rate: ${(aiRun.resolutionRate * 100).toFixed(2)}% (Baseline: ${(baseline.resolutionRate * 100).toFixed(2)}%)`);
  console.log(`- AI-Assisted Ground Truth Accuracy: ${aiRun.accuracyPercentage}% (Baseline: ${baseline.accuracyPercentage}%)`);

  if (aiRun.status !== 'COMPLETED') {
    throw new Error(`Verification Failed: Expected AI run status COMPLETED, got ${aiRun.status}`);
  }
  if (aiRun.aiCallCount < 10) {
    throw new Error(`Verification Failed: Expected at least 10 AI calls made for eligible ambiguous unresolved cases, got ${aiRun.aiCallCount}`);
  }
  if (aiRun.matchedCount <= baseline.matchedCount) {
    throw new Error('Verification Failed: AI did not improve resolution rate over baseline!');
  }

  // 3. Verify Deterministic Match Invariant Protection (Zero Degradation)
  console.log('\n🛡️ Verifying Deterministic Match Invariant Protection...');
  const baselineDetails = await dbRepository.getRunDetails(baseline.runId);
  const aiRunDetails = await dbRepository.getRunDetails(aiRun.runId);

  if (!baselineDetails || !aiRunDetails) {
    throw new Error('Verification Failed: Could not fetch run details from DB');
  }

  let degradedCount = 0;
  baselineDetails.results.forEach((baseRes) => {
    if (baseRes.status === 'MATCHED' && baseRes.invoiceId) {
      const aiRes = aiRunDetails.results.find((r) => r.invoiceId === baseRes.invoiceId);
      if (!aiRes || aiRes.status !== 'MATCHED') {
        degradedCount++;
        console.error(`❌ Degradation Detected: Invoice ${baseRes.invoiceId} was MATCHED deterministically but degraded to ${aiRes?.status}`);
      }
    }
  });

  if (degradedCount > 0) {
    throw new Error(`Verification Failed: ${degradedCount} deterministic matches were degraded by AI execution!`);
  }
  console.log('✓ Zero degradation verified! All 120 deterministic matches remained 100% intact.');

  // 4. Audit Trail & Metadata Inspection
  console.log('\n🔍 Inspecting AI Audit Metadata in Database...');
  const aiAssistedResults = aiRunDetails.results.filter((r) => r.aiUsed || r.method === 'AI');
  console.log(`- Total AI-Evaluated Results Persisted: ${aiAssistedResults.length}`);

  if (aiAssistedResults.length > 0) {
    const sample = aiAssistedResults[0];
    console.log(`- Sample AI Result ID: ${sample.id}`);
    console.log(`- Method: ${sample.method}`);
    console.log(`- AI Used Flag: ${sample.aiUsed}`);
    console.log(`- Model Confidence Signal: ${sample.confidence}`);
    console.log(`- Audit Metadata:`, JSON.stringify(sample.aiMetadataJson, null, 2));
  }

  console.log('\n✅ Feature 7 AI Ambiguity Resolver verified successfully!');
}

verifyFeature7Implementation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Feature 7 verification failed:', err);
    process.exit(1);
  });
