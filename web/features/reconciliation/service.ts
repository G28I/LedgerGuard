import { dbRepository } from '@/features/db';
import { generateSyntheticBenchmarkBatch, DEFAULT_BENCHMARK_SEED } from '@/features/synthetic';
import { scoreBenchmarkRun } from '@/features/benchmark';
import { runReconciliationEngine } from './engine';
import { generateCandidatePairs } from './candidates';
import { calculateVendorSimilarity } from './normalize';
import { isAiEligible } from './safety';
import { DEFAULT_RECONCILIATION_POLICY } from './types';
import type { ReconciliationPolicyConfig, ExecuteRunParams, ReconciliationRunSummaryResponse } from './types';
import { resolveAmbiguityWithAI } from '@/features/ai';
import { isSqsAsyncConfigured } from '@/infrastructure/aws/config';
import { getSqsJobProducer, type ReconciliationJobPayload } from '@/infrastructure/aws/sqs';
import type { Prisma } from '@prisma/client';

/**
 * Reconciliation Application Service Layer
 * Orchestrates job creation, SQS queuing, asynchronous worker processing, and database persistence.
 * 
 * Boundary Flow:
 * SQS Queue / HTTP -> Application Orchestration -> Pure Domain Engine -> OpenRouter AI -> Prisma Persistence
 */
export const reconciliationService = {
  /**
   * Creates a ReconciliationRun in PENDING state and either dispatches to SQS or executes synchronously.
   */
  async enqueueRun(params: ExecuteRunParams = {}): Promise<ReconciliationRunSummaryResponse> {
    const seed = params.seed ?? DEFAULT_BENCHMARK_SEED;
    const batchName = params.batchName ?? `Benchmark Run (Seed ${seed})`;
    const enableAI = params.enableAI ?? true;
    const isBenchmark = params.isBenchmark ?? true;

    // 1. Generate / Load Synthetic Benchmark Dataset
    const dataset = generateSyntheticBenchmarkBatch({ seed, totalCases: 200 });

    // 2. Ingest Source Records into PostgreSQL (Append-Only)
    await dbRepository.createInvoices(
      dataset.sourceRecords.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendorName,
        vendorNormalized: inv.normalizedVendor,
        amountCents: inv.amountCents,
        currency: inv.currency,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate ?? null,
      }))
    );

    await dbRepository.createBankTransactions(
      dataset.sourceRecords.bankTransactions.map((tx) => ({
        id: tx.id,
        transactionRef: tx.transactionRef,
        description: tx.description,
        descriptionNormalized: tx.normalizedDescription,
        amountCents: tx.amountCents,
        currency: tx.currency,
        transactionDate: tx.transactionDate,
      }))
    );

    if (dataset.sourceRecords.ledgerEntries.length > 0) {
      await dbRepository.createLedgerEntries(
        dataset.sourceRecords.ledgerEntries.map((leg) => ({
          id: leg.id,
          entryRef: leg.entryRef,
          accountCode: leg.accountCode,
          description: leg.description,
          amountCents: leg.amountCents,
          currency: leg.currency,
          postingDate: leg.postingDate,
        }))
      );
    }

    // 3. Create Reconciliation Run (Status: PENDING)
    const runNumber = `RUN-${Date.now()}`;
    const startTime = Date.now();

    const runRecord = await dbRepository.createRun({
      runNumber,
      batchName,
      totalRecords: dataset.totalCases,
    });

    const jobPayload: ReconciliationJobPayload = {
      jobId: crypto.randomUUID(),
      runId: runRecord.id,
      runNumber,
      seed,
      batchName,
      enableAI,
      isBenchmark,
      policyConfig: params.policyConfig,
      enqueuedAt: new Date().toISOString(),
    };

    // 4. If SQS is configured, dispatch to queue for async worker consumption
    if (isSqsAsyncConfigured()) {
      console.log(`[reconciliationService] Publishing Run ${runRecord.id} to AWS SQS...`);
      const producer = getSqsJobProducer();
      const publishResult = await producer.publishReconciliationJob(jobPayload);

      if (!publishResult.success) {
        console.warn(`[reconciliationService] SQS publish failed for Run ${runRecord.id}: ${publishResult.error}. Falling back to synchronous processing.`);
        return this.processRunJob(jobPayload);
      }

      // Return initial PENDING state response contract for client polling
      return {
        runId: runRecord.id,
        runNumber,
        status: 'PENDING',
        totalRecords: dataset.totalCases,
        matchedCount: 0,
        unresolvedCount: 0,
        exceptionCount: 0,
        aiCallCount: 0,
        resolutionRate: 0,
        durationMs: Date.now() - startTime,
        throughputRecordsPerSec: 0,
        startedAt: new Date(startTime).toISOString(),
        errorMessage: null,
        resultsSummary: [],
        exceptionsSummary: [],
      };
    }

    // 5. Local Development Fallback: Execute in-process synchronously
    return this.processRunJob(jobPayload);
  },

  /**
   * Executes reconciliation for a designated ReconciliationRun with strict idempotency protection.
   * Invoked either directly (local fallback) or by an SQS Worker consumer.
   */
  async processRunJob(payload: ReconciliationJobPayload): Promise<ReconciliationRunSummaryResponse> {
    const startTime = Date.now();
    const { runId, runNumber, seed, enableAI, policyConfig, isBenchmark = true } = payload;

    // 1. Idempotency Check: Verify current run state in DB
    const existingRun = await dbRepository.getRunDetails(runId);
    if (!existingRun) {
      const errorMsg = `ReconciliationRun ${runId} not found in database. Cannot process job.`;
      console.error('[reconciliationService]', errorMsg);
      throw new Error(errorMsg);
    }

    if (existingRun.status === 'COMPLETED') {
      console.log(`[reconciliationService] Idempotency Guard: Run ${runId} is already COMPLETED. Skipping duplicate execution.`);
      return {
        runId: existingRun.id,
        runNumber: existingRun.runNumber,
        status: 'COMPLETED',
        totalRecords: existingRun.totalRecords,
        matchedCount: existingRun.matchedCount,
        unresolvedCount: existingRun.unresolvedCount,
        exceptionCount: existingRun.exceptionCount,
        aiCallCount: existingRun.aiCallCount,
        resolutionRate: existingRun.resolutionRate ?? 0,
        accuracyPercentage: existingRun.accuracy,
        accuracyRatio: existingRun.accuracy,
        precision: existingRun.precision,
        recall: existingRun.recall,
        f1Score: existingRun.f1Score,
        aiEvaluatedCount: existingRun.aiEvaluatedCount,
        aiPromotedCount: existingRun.aiPromotedCount,
        aiFalsePositiveCount: existingRun.aiFalsePositiveCount,
        deterministicMatchedCount: existingRun.deterministicMatchedCount,
        deterministicAccuracyRatio: existingRun.deterministicAccuracy,
        durationMs: existingRun.durationMs ?? 0,
        throughputRecordsPerSec: existingRun.durationMs && existingRun.durationMs > 0 ? (existingRun.totalRecords / (existingRun.durationMs / 1000)) : 0,
        startedAt: existingRun.startedAt.toISOString(),
        completedAt: existingRun.completedAt?.toISOString() ?? null,
        errorMessage: null,
        resultsSummary: existingRun.results.slice(0, 10).map((r) => ({
          id: r.id,
          status: r.status,
          method: r.method,
          reasonCode: r.reasonCode,
          amountDeltaCents: r.amountDeltaCents,
        })),
        exceptionsSummary: [],
      };
    }

    // 2. Transition Run State to PROCESSING
    await dbRepository.updateRunStatus(runId, 'PROCESSING');

    // 3. Load / Regenerate Source Dataset by Seed
    const dataset = generateSyntheticBenchmarkBatch({ seed, totalCases: 200 });

    const policy: ReconciliationPolicyConfig = {
      ...DEFAULT_RECONCILIATION_POLICY,
      ...policyConfig,
    };

    try {
      // 4. Execute Pure Domain Engine (Side-Effect-Free)
      const decisions = runReconciliationEngine(
        dataset.sourceRecords.invoices,
        dataset.sourceRecords.bankTransactions,
        dataset.sourceRecords.ledgerEntries,
        policy
      );

      let aiCallCount = 0;
      const aiMetadataMap = new Map<string, { model: string; reasoning: string; keyEvidence: string[]; promptDurationMs: number }>();

      // 5. AI Ambiguity Resolution (Downstream of Deterministic Engine)
      if (enableAI) {
        const candidatesMap = generateCandidatePairs(
          dataset.sourceRecords.invoices,
          dataset.sourceRecords.bankTransactions,
          dataset.sourceRecords.ledgerEntries,
          policy
        );

        for (let i = 0; i < decisions.length; i++) {
          const d = decisions[i];
          if (!d.invoiceId) continue;

          // Invariant Safety Check: Only UNRESOLVED records that pass the safety predicate are eligible for AI.
          if (!isAiEligible(d)) {
            continue;
          }

          const invoiceObj = dataset.sourceRecords.invoices.find((inv) => inv.id === d.invoiceId);
          let candidates = candidatesMap.get(d.invoiceId) ?? [];

          // If candidates map is empty, retrieve plausible bank transaction candidates within policy date window
          if (candidates.length === 0 && invoiceObj) {
            candidates = dataset.sourceRecords.bankTransactions
              .filter((tx) => {
                const dateDeltaDays = Math.round((tx.transactionDate.getTime() - invoiceObj.issueDate.getTime()) / (1000 * 60 * 60 * 24));
                const amountDeltaCents = Math.abs(tx.amountCents - invoiceObj.amountCents);
                return (
                  dateDeltaDays >= policy.dateWindowDays.minDaysBefore &&
                  dateDeltaDays <= policy.dateWindowDays.maxDaysAfter &&
                  (amountDeltaCents <= policy.maxAllowedFeeDeltaCents || amountDeltaCents <= invoiceObj.amountCents * 0.10)
                );
              })
              .map((tx) => ({
                invoice: invoiceObj,
                bankTx: tx,
                ledgerEntry: null,
                matchScore: 0.50,
                amountDeltaCents: tx.amountCents - invoiceObj.amountCents,
                dateDeltaDays: Math.round((tx.transactionDate.getTime() - invoiceObj.issueDate.getTime()) / (1000 * 60 * 60 * 24)),
                vendorSimilarity: calculateVendorSimilarity(invoiceObj.vendorName, tx.description),
                hasExactRefMatch: false,
              }));
            candidates.sort((a, b) => b.vendorSimilarity - a.vendorSimilarity);
          }

          if (invoiceObj && candidates.length > 0) {
            aiCallCount++;

            const aiResult = await resolveAmbiguityWithAI(invoiceObj, candidates, d, policy);

            aiMetadataMap.set(d.invoiceId, {
              model: aiResult.actualModelUsed,
              reasoning: aiResult.reasoning,
              keyEvidence: aiResult.keyEvidence,
              promptDurationMs: aiResult.promptDurationMs,
            });

            if (aiResult.status === 'MATCHED' && aiResult.selectedBankTxId) {
              decisions[i] = {
                ...d,
                status: 'MATCHED',
                method: 'AI',
                ruleStrength: 'FUZZY_HIGH',
                confidence: aiResult.confidenceScore,
                bankTransactionId: aiResult.selectedBankTxId,
                reasonCode: 'AI_ASSISTED_MATCH',
                explanation: `AI-Assisted Resolution (${aiResult.actualModelUsed}): ${aiResult.reasoning}`,
                exceptions: [],
              };
            } else {
              const updatedExceptions = [...d.exceptions];
              if (aiResult.exceptionType) {
                updatedExceptions.push({
                  type: aiResult.exceptionType,
                  priority: 'HIGH',
                  reason: aiResult.exceptionReason ?? 'AI resolution provider error',
                  expectedValue: 'Valid JSON response from OpenRouter',
                  observedValue: aiResult.reasoning,
                });
              }

              decisions[i] = {
                ...d,
                method: 'AI',
                confidence: aiResult.confidenceScore ?? null,
                explanation: `AI Evaluated (${aiResult.actualModelUsed}): ${aiResult.reasoning}`,
                exceptions: updatedExceptions,
              };
            }
          }
        }
      }

      const endTime = Date.now();
      const durationMs = Math.max(1, endTime - startTime);

      // 6. Derive Run Metrics
      let matchedCount = 0;
      let unresolvedCount = 0;
      let totalExceptions = 0;

      decisions.forEach((d) => {
        if (d.status === 'MATCHED') {
          matchedCount++;
        } else {
          unresolvedCount++;
        }
        totalExceptions += d.exceptions.length;
      });

      // 7. Benchmark Scoring (Strict Offline Airgap)
      const deterministicDecisions = runReconciliationEngine(
        dataset.sourceRecords.invoices,
        dataset.sourceRecords.bankTransactions,
        dataset.sourceRecords.ledgerEntries,
        policy
      );
      const detScore = scoreBenchmarkRun(deterministicDecisions, dataset.groundTruthMap);

      const benchmarkScore = scoreBenchmarkRun(decisions, dataset.groundTruthMap, {
        aiEvaluatedInvoiceIds: new Set(aiMetadataMap.keys()),
      });

      const resolutionRate = Number((matchedCount / dataset.totalCases).toFixed(4));
      const throughputRecordsPerSec = Number((dataset.totalCases / (durationMs / 1000)).toFixed(2));

      // 8. Atomic Transaction Persistence
      const resultsToPersist = decisions.map((d) => {
        const aiMeta = d.invoiceId ? aiMetadataMap.get(d.invoiceId) : undefined;
        const aiMetadataJson = aiMeta
          ? ((aiMeta as unknown) as Prisma.InputJsonValue)
          : undefined;

        return {
          runId,
          invoiceId: d.invoiceId,
          bankTransactionId: d.bankTransactionId,
          ledgerEntryId: d.ledgerEntryId,
          status: d.status,
          method: d.method,
          aiUsed: Boolean(aiMeta),
          confidence: d.confidence,
          amountDeltaCents: d.amountDeltaCents,
          reasonCode: d.reasonCode,
          explanation: d.explanation,
          evidenceJson: (d.evidenceJson as unknown) as Prisma.InputJsonValue,
          aiMetadataJson,
          exceptions: d.exceptions.map((exc) => ({
            type: exc.type,
            priority: exc.priority,
            reason: exc.reason,
            expectedValue: exc.expectedValue,
            observedValue: exc.observedValue,
          })),
        };
      });

      const persistedResults = await dbRepository.persistRunResultsAndExceptionsTransaction(resultsToPersist);

      // 9. Complete Run Record
      const completedRun = await dbRepository.completeRun(runId, {
        matchedCount,
        unresolvedCount,
        exceptionCount: totalExceptions,
        aiCallCount,
        accuracy: benchmarkScore.accuracy,
        resolutionRate,
        durationMs,
        status: 'COMPLETED',
        isBenchmark,
        aiEvaluatedCount: benchmarkScore.aiEvaluatedCount,
        aiPromotedCount: benchmarkScore.aiPromotedCount,
        aiFalsePositiveCount: benchmarkScore.aiFalsePositiveCount,
        deterministicMatchedCount: detScore.matchedCount,
        deterministicAccuracy: detScore.accuracy,
        precision: benchmarkScore.precision,
        recall: benchmarkScore.recall,
        f1Score: benchmarkScore.f1Score,
      });

      const resultsSummary = persistedResults.slice(0, 10).map((r) => ({
        id: r.id ?? '',
        status: r.status,
        method: r.method,
        reasonCode: r.reasonCode,
        amountDeltaCents: r.amountDeltaCents ?? 0,
      }));

      return {
        runId,
        runNumber: completedRun?.runNumber ?? runNumber,
        status: 'COMPLETED',
        totalRecords: dataset.totalCases,
        matchedCount,
        unresolvedCount,
        exceptionCount: totalExceptions,
        aiCallCount,
        resolutionRate,
        accuracyPercentage: benchmarkScore.accuracy,
        accuracyRatio: benchmarkScore.accuracy,
        precision: benchmarkScore.precision,
        recall: benchmarkScore.recall,
        f1Score: benchmarkScore.f1Score,
        aiEvaluatedCount: benchmarkScore.aiEvaluatedCount,
        aiPromotedCount: benchmarkScore.aiPromotedCount,
        aiFalsePositiveCount: benchmarkScore.aiFalsePositiveCount,
        deterministicMatchedCount: detScore.matchedCount,
        deterministicAccuracyRatio: detScore.accuracy,
        durationMs,
        throughputRecordsPerSec,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date(endTime).toISOString(),
        errorMessage: null,
        resultsSummary,
        exceptionsSummary: [],
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[reconciliationService] Run ${runId} execution failed:`, errorMessage);

      try {
        await dbRepository.updateRunStatus(runId, 'FAILED');
      } catch (dbErr) {
        console.error(`[reconciliationService] Server-side log: Failed to mark run ${runId} as FAILED:`, dbErr);
      }

      return {
        runId,
        runNumber,
        status: 'FAILED',
        totalRecords: dataset.totalCases,
        matchedCount: 0,
        unresolvedCount: 0,
        exceptionCount: 0,
        aiCallCount: 0,
        resolutionRate: 0,
        durationMs: Date.now() - startTime,
        throughputRecordsPerSec: 0,
        startedAt: new Date(startTime).toISOString(),
        errorMessage,
        resultsSummary: [],
        exceptionsSummary: [],
      };
    }
  },

  /**
   * Synchronous convenience wrapper for benchmarks and test suites.
   */
  async executeRun(params: ExecuteRunParams = {}): Promise<ReconciliationRunSummaryResponse> {
    return this.enqueueRun(params);
  },
};
