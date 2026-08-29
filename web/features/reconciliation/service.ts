import { dbRepository } from '@/features/db';
import { generateSyntheticBenchmarkBatch, DEFAULT_BENCHMARK_SEED } from '@/features/synthetic';
import { runReconciliationEngine } from './engine';
import type { ExecuteRunParams, ReconciliationRunSummaryResponse } from './types';
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

      // 5. Execute Pure Domain Engine (Side-Effect-Free)
      const decisions = runReconciliationEngine(
        dataset.sourceRecords.invoices,
        dataset.sourceRecords.bankTransactions,
        dataset.sourceRecords.ledgerEntries,
        params.policyConfig
      );

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

      const resolutionRate = matchedCount / dataset.totalCases;
      const throughputRecordsPerSec = Number((dataset.totalCases / (durationMs / 1000)).toFixed(2));

      // Calculate offline accuracy percentage against ground truth map
      let correctGroundTruthCount = 0;
      decisions.forEach((d) => {
        if (!d.invoiceId) return;
        const gt = dataset.groundTruthMap.get(d.invoiceId);
        if (!gt) return;
        const isStatusMatch = d.status === gt.expectedStatus;
        const isExcMatch = gt.expectedExceptionType === null
          ? d.exceptions.length === 0
          : d.exceptions.some((e) => e.type === gt.expectedExceptionType);
        if (isStatusMatch && isExcMatch) correctGroundTruthCount++;
      });
      const accuracyPercentage = Number(((correctGroundTruthCount / dataset.totalCases) * 100).toFixed(2));

      // 7. Atomic Transaction Persistence (Results & Exceptions)
      const resultsToPersist = decisions.map((d) => ({
        runId: runRecord.id,
        invoiceId: d.invoiceId,
        bankTransactionId: d.bankTransactionId,
        ledgerEntryId: d.ledgerEntryId,
        status: d.status,
        method: d.method,
        aiUsed: false,
        confidence: d.confidence,
        amountDeltaCents: d.amountDeltaCents,
        reasonCode: d.reasonCode,
        explanation: d.explanation,
        evidenceJson: (d.evidenceJson as unknown) as Prisma.InputJsonValue,
        exceptions: d.exceptions.map((exc) => ({
          type: exc.type,
          priority: exc.priority,
          reason: exc.reason,
          expectedValue: exc.expectedValue,
          observedValue: exc.observedValue,
        })),
      }));

      const persistedResults = await dbRepository.persistRunResultsAndExceptionsTransaction(resultsToPersist);

      // 8. Complete Run (Status: COMPLETED)
      const completedRun = await dbRepository.completeRun(runRecord.id, {
        matchedCount,
        unresolvedCount,
        exceptionCount: totalExceptions,
        aiCallCount: 0,
        accuracy: accuracyPercentage,
        resolutionRate,
        durationMs,
        status: 'COMPLETED',
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
        aiCallCount: 0,
        resolutionRate,
        accuracyPercentage,
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
