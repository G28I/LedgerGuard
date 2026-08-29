import { dbRepository } from '@/features/db';
import { generateSyntheticBenchmarkBatch, DEFAULT_BENCHMARK_SEED } from '@/features/synthetic';
import { scoreBenchmarkRun } from '@/features/benchmark';
import { runReconciliationEngine } from './engine';
import { generateCandidatePairs } from './candidates';
import { calculateVendorSimilarity } from './normalize';
import { DEFAULT_RECONCILIATION_POLICY } from './types';
import type { ReconciliationPolicyConfig, ExecuteRunParams, ReconciliationRunSummaryResponse } from './types';
import { resolveAmbiguityWithAI } from '@/features/ai';
import type { Prisma } from '@prisma/client';

/**
 * Reconciliation Application Service Layer
 * Orchestrates synchronous end-to-end reconciliation runs across foundation layers.
 * 
 * Boundary Flow:
 * Pure Domain Engine -> Application Orchestration -> Prisma/PostgreSQL Persistence -> API Response Contract
 */
export const reconciliationService = {
  async executeRun(params: ExecuteRunParams = {}): Promise<ReconciliationRunSummaryResponse> {
    const seed = params.seed ?? DEFAULT_BENCHMARK_SEED;
    const batchName = params.batchName ?? `Benchmark Run (Seed ${seed})`;

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

    try {
      // 4. Transition Run to PROCESSING
      await dbRepository.updateRunStatus(runRecord.id, 'PROCESSING');

      const policy: ReconciliationPolicyConfig = {
        ...DEFAULT_RECONCILIATION_POLICY,
        ...params.policyConfig,
      };

      // 5. Execute Pure Domain Engine (Side-Effect-Free)
      const decisions = runReconciliationEngine(
        dataset.sourceRecords.invoices,
        dataset.sourceRecords.bankTransactions,
        dataset.sourceRecords.ledgerEntries,
        policy
      );

      let aiCallCount = 0;
      const aiMetadataMap = new Map<string, { model: string; reasoning: string; keyEvidence: string[]; promptDurationMs: number }>();

      // 5b. AI Ambiguity Resolution (Downstream of Deterministic Engine)
      if (params.enableAI) {
        const candidatesMap = generateCandidatePairs(
          dataset.sourceRecords.invoices,
          dataset.sourceRecords.bankTransactions,
          dataset.sourceRecords.ledgerEntries,
          policy
        );

        for (let i = 0; i < decisions.length; i++) {
          const d = decisions[i];
          if (!d.invoiceId) continue;

          // Invariant Safety Check: Only UNRESOLVED records are eligible for AI resolution.
          // Deterministic MATCHED, AMOUNT_MISMATCH, MISSING_RECORD, DUPLICATE, and AMBIGUOUS_MATCH_TIE decisions are NEVER processed by AI!
          if (
            d.status === 'MATCHED' ||
            d.reasonCode === 'EXACT_REF_AND_AMOUNT_MATCH' ||
            d.reasonCode === 'AMOUNT_MISMATCH' ||
            d.reasonCode === 'MISSING_RECORD' ||
            d.reasonCode === 'DUPLICATE_TRANSACTION_DETECTED' ||
            d.reasonCode === 'AMBIGUOUS_MATCH_TIE'
          ) {
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
              // Promote to MATCHED with AI method
              decisions[i] = {
                ...d,
                status: 'MATCHED',
                method: 'AI',
                ruleStrength: 'FUZZY_HIGH',
                confidence: aiResult.confidenceScore,
                bankTransactionId: aiResult.selectedBankTxId,
                reasonCode: 'AI_ASSISTED_MATCH',
                explanation: `AI-Assisted Resolution (${aiResult.actualModelUsed}): ${aiResult.reasoning}`,
                exceptions: [], // Clear unresolved exception on successful AI match
              };
            } else if (aiResult.exceptionType) {
              // Provider or Zod error -> Append Exception while preserving UNRESOLVED status
              decisions[i].exceptions.push({
                type: aiResult.exceptionType,
                priority: 'HIGH',
                reason: aiResult.exceptionReason ?? 'AI resolution provider error',
                expectedValue: 'Valid JSON response from OpenRouter',
                observedValue: aiResult.reasoning,
              });
            }
          }
        }
      }

      const endTime = Date.now();
      const durationMs = Math.max(1, endTime - startTime);

      // 6. Derive Run Metrics Directly from Completed Decisions Set
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

      // 6. Benchmark Scoring (Offline Evaluation Boundary)
      // Strict Boundary: Ground truth map is NOT accessed by runtime engine/service/API/AI.
      // It is passed exclusively to scoreBenchmarkRun after reconciliation completes.
      const isBenchmark = params.isBenchmark ?? true;

      // Pass A (In-Memory Pure Deterministic Baseline Pass)
      const deterministicDecisions = runReconciliationEngine(
        dataset.sourceRecords.invoices,
        dataset.sourceRecords.bankTransactions,
        dataset.sourceRecords.ledgerEntries,
        policy
      );
      const detScore = scoreBenchmarkRun(deterministicDecisions, dataset.groundTruthMap);

      // Pass B (AI-Enabled Pipeline Pass - Scored Offline)
      const benchmarkScore = scoreBenchmarkRun(decisions, dataset.groundTruthMap, {
        aiEvaluatedInvoiceIds: new Set(aiMetadataMap.keys()),
      });

      const resolutionRate = Number((matchedCount / dataset.totalCases).toFixed(4));
      const throughputRecordsPerSec = Number((dataset.totalCases / (durationMs / 1000)).toFixed(2));

      // 7. Atomic Transaction Persistence (Results & Exceptions)
      const resultsToPersist = decisions.map((d) => {
        const aiMeta = d.invoiceId ? aiMetadataMap.get(d.invoiceId) : undefined;
        const aiMetadataJson = aiMeta
          ? ((aiMeta as unknown) as Prisma.InputJsonValue)
          : undefined;

        return {
          runId: runRecord.id,
          invoiceId: d.invoiceId,
          bankTransactionId: d.bankTransactionId,
          ledgerEntryId: d.ledgerEntryId,
          status: d.status,
          method: d.method,
          aiUsed: d.method === 'AI',
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

      // 8. Complete Run with Materialized Summaries (All metrics stored as decimal ratios e.g. 0.925)
      const completedRun = await dbRepository.completeRun(runRecord.id, {
        matchedCount,
        unresolvedCount,
        exceptionCount: totalExceptions,
        aiCallCount,
        accuracy: benchmarkScore.accuracy, // Normalized ratio e.g. 0.925
        resolutionRate, // Normalized ratio e.g. 0.60
        durationMs,
        status: 'COMPLETED',
        isBenchmark,
        aiEvaluatedCount: benchmarkScore.aiEvaluatedCount,
        aiPromotedCount: benchmarkScore.aiPromotedCount,
        aiFalsePositiveCount: benchmarkScore.aiFalsePositiveCount,
        deterministicMatchedCount: detScore.matchedCount,
        deterministicAccuracy: detScore.accuracy, // Normalized ratio e.g. 0.925
        precision: benchmarkScore.precision, // Ratio e.g. 1.0
        recall: benchmarkScore.recall, // Ratio e.g. 1.0
        f1Score: benchmarkScore.f1Score, // Ratio e.g. 1.0
      });

      // 9. Return Typed Summary Response Contract
      const resultsSummary = persistedResults.slice(0, 10).map((r) => ({
        id: r.id,
        status: r.status,
        method: r.method,
        reasonCode: r.reasonCode,
        amountDeltaCents: r.amountDeltaCents,
      }));

      return {
        runId: runRecord.id,
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
      console.error(`[reconciliationService] Run ${runRecord.id} execution failed:`, errorMessage);

      // Best-effort FAILED state update with server-side logging if database fails
      try {
        await dbRepository.updateRunStatus(runRecord.id, 'FAILED');
      } catch (dbErr) {
        console.error(`[reconciliationService] Server-side log: Failed to mark run ${runRecord.id} as FAILED:`, dbErr);
      }

      return {
        runId: runRecord.id,
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
};
