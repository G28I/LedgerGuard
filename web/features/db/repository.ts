import { prisma } from '@/lib/prisma';
import {
  Prisma,
  type Invoice,
  type BankTransaction,
  type LedgerEntry,
  type ReconciliationRun,
  type ReconciliationResult,
  type Exception,
  type RunStatus,
  type MatchMethod,
  type ResultStatus,
  type ExceptionType,
  type ExceptionPriority
} from '@prisma/client';

export type CreateInvoiceInput = Prisma.InvoiceCreateInput;
export type CreateBankTransactionInput = Prisma.BankTransactionCreateInput;
export type CreateLedgerEntryInput = Prisma.LedgerEntryCreateInput;

/**
 * DB Repository Layer
 * Manages persisted source records, reconciliation runs, results, and exceptions.
 */
export const dbRepository = {
  // Source Record Creators (Append-Only)
  async createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
    return prisma.invoice.create({ data });
  },

  async createInvoices(data: Prisma.InvoiceCreateManyInput[]) {
    return prisma.invoice.createMany({ data, skipDuplicates: true });
  },

  async createBankTransaction(data: CreateBankTransactionInput): Promise<BankTransaction> {
    return prisma.bankTransaction.create({ data });
  },

  async createBankTransactions(data: Prisma.BankTransactionCreateManyInput[]) {
    return prisma.bankTransaction.createMany({ data, skipDuplicates: true });
  },

  async createLedgerEntry(data: CreateLedgerEntryInput): Promise<LedgerEntry> {
    return prisma.ledgerEntry.create({ data });
  },

  async createLedgerEntries(data: Prisma.LedgerEntryCreateManyInput[]) {
    return prisma.ledgerEntry.createMany({ data, skipDuplicates: true });
  },

  // Source Record Readers
  async getInvoices(): Promise<Invoice[]> {
    return prisma.invoice.findMany({ orderBy: { issueDate: 'desc' } });
  },

  async getBankTransactions(): Promise<BankTransaction[]> {
    return prisma.bankTransaction.findMany({ orderBy: { transactionDate: 'desc' } });
  },

  async getLedgerEntries(): Promise<LedgerEntry[]> {
    return prisma.ledgerEntry.findMany({ orderBy: { postingDate: 'desc' } });
  },

  // Reconciliation Run & Result Persistence
  async createRun(data: {
    runNumber: string;
    batchName: string;
    totalRecords: number;
    status?: RunStatus;
  }): Promise<ReconciliationRun> {
    return prisma.reconciliationRun.create({ data });
  },

  async recordResult(data: {
    runId: string;
    invoiceId?: string;
    bankTransactionId?: string;
    ledgerEntryId?: string;
    status: ResultStatus;
    method: MatchMethod;
    aiUsed?: boolean;
    confidence?: number;
    amountDeltaCents?: number;
    reasonCode: string;
    explanation: string;
    evidenceJson?: Prisma.InputJsonValue;
    aiMetadataJson?: Prisma.InputJsonValue;
  }): Promise<ReconciliationResult> {
    return prisma.reconciliationResult.create({
      data: {
        runId: data.runId,
        invoiceId: data.invoiceId,
        bankTransactionId: data.bankTransactionId,
        ledgerEntryId: data.ledgerEntryId,
        status: data.status,
        method: data.method,
        aiUsed: data.aiUsed ?? false,
        confidence: data.confidence,
        amountDeltaCents: data.amountDeltaCents ?? 0,
        reasonCode: data.reasonCode,
        explanation: data.explanation,
        evidenceJson: data.evidenceJson !== undefined ? data.evidenceJson : Prisma.DbNull,
        aiMetadataJson: data.aiMetadataJson !== undefined ? data.aiMetadataJson : Prisma.DbNull,
      },
    });
  },

  async createException(data: {
    runId: string;
    resultId?: string;
    type: ExceptionType;
    priority?: ExceptionPriority;
    reason: string;
    expectedValue?: string;
    observedValue?: string;
  }): Promise<Exception> {
    return prisma.exception.create({ data });
  },

  async updateRunStatus(
    runId: string,
    status: RunStatus
  ): Promise<ReconciliationRun | null> {
    try {
      return await prisma.reconciliationRun.update({
        where: { id: runId },
        data: { status },
      });
    } catch (err) {
      console.error(`[dbRepository] Server-side log: Failed to update run ${runId} status to ${status}:`, err);
      return null;
    }
  },

  async completeRun(
    runId: string,
    metrics: {
      matchedCount: number;
      unresolvedCount: number;
      exceptionCount: number;
      aiCallCount: number;
      accuracy?: number;
      resolutionRate?: number;
      durationMs: number;
      status: RunStatus;
      isBenchmark?: boolean;
      aiEvaluatedCount?: number;
      aiPromotedCount?: number;
      aiFalsePositiveCount?: number;
      deterministicMatchedCount?: number;
      deterministicAccuracy?: number;
      precision?: number;
      recall?: number;
      f1Score?: number;
    }
  ): Promise<ReconciliationRun | null> {
    try {
      return await prisma.reconciliationRun.update({
        where: { id: runId },
        data: {
          ...metrics,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`[dbRepository] Server-side log: Failed to complete run ${runId}:`, err);
      return null;
    }
  },

  async getBenchmarkRuns(): Promise<ReconciliationRun[]> {
    return prisma.reconciliationRun.findMany({
      orderBy: { startedAt: 'desc' },
    });
  },

  /**
   * Atomic Transaction Persistence for Run Results & Exceptions
   * Ensures either ALL results and exceptions for a run are persisted, or NONE are (no partial rows).
   */
  async persistRunResultsAndExceptionsTransaction(
    resultsData: Array<{
      runId: string;
      invoiceId?: string | null;
      bankTransactionId?: string | null;
      ledgerEntryId?: string | null;
      status: ResultStatus;
      method: MatchMethod;
      aiUsed?: boolean;
      confidence?: number | null;
      amountDeltaCents?: number;
      reasonCode: string;
      explanation: string;
      evidenceJson?: Prisma.InputJsonValue;
      aiMetadataJson?: Prisma.InputJsonValue;
      exceptions: Array<{
        type: ExceptionType;
        priority?: ExceptionPriority;
        reason: string;
        expectedValue?: string;
        observedValue?: string;
      }>;
    }>
  ) {
    return prisma.$transaction(
      async (tx) => {
        const persistedResults = [];

        for (const res of resultsData) {
          const resultRecord = await tx.reconciliationResult.create({
            data: {
              runId: res.runId,
              invoiceId: res.invoiceId,
              bankTransactionId: res.bankTransactionId,
              ledgerEntryId: res.ledgerEntryId,
              status: res.status,
              method: res.method,
              aiUsed: res.aiUsed ?? false,
              confidence: res.confidence,
              amountDeltaCents: res.amountDeltaCents ?? 0,
              reasonCode: res.reasonCode,
              explanation: res.explanation,
              evidenceJson: res.evidenceJson !== undefined ? res.evidenceJson : Prisma.DbNull,
              aiMetadataJson: res.aiMetadataJson !== undefined ? res.aiMetadataJson : Prisma.DbNull,
            },
          });

          for (const exc of res.exceptions) {
            await tx.exception.create({
              data: {
                runId: res.runId,
                resultId: resultRecord.id,
                type: exc.type,
                priority: exc.priority ?? 'MEDIUM',
                reason: exc.reason,
                expectedValue: exc.expectedValue,
                observedValue: exc.observedValue,
              },
            });
          }

          persistedResults.push(resultRecord);
        }

        return persistedResults;
      },
      { timeout: 30000, maxWait: 10000 }
    );
  },

  // Historical Run & Audit Queries
  async getRunDetails(runId: string) {
    return prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
          include: {
            invoice: true,
            bankTransaction: true,
            ledgerEntry: true,
            exceptions: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        exceptions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async getRecentRuns(limit = 10) {
    return prisma.reconciliationRun.findMany({
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        _count: {
          select: { results: true, exceptions: true },
        },
      },
    });
  },

  async getLatestCompletedRun() {
    return prisma.reconciliationRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      include: {
        _count: {
          select: { results: true, exceptions: true },
        },
      },
    });
  },

  async getOverviewMetrics() {
    const latestRun = await this.getLatestCompletedRun();
    const recentRuns = await this.getRecentRuns(5);

    // Group open exceptions by type from latest run or across all runs
    const exceptionBreakdownRaw = await prisma.exception.groupBy({
      by: ['type'],
      where: latestRun ? { runId: latestRun.id, resolved: false } : { resolved: false },
      _count: { type: true },
    });

    const exceptionBreakdown: Record<string, number> = {};
    exceptionBreakdownRaw.forEach((group) => {
      exceptionBreakdown[group.type] = group._count.type;
    });

    const invoicesCount = await prisma.invoice.count();
    const bankTransactionsCount = await prisma.bankTransaction.count();
    const ledgerEntriesCount = await prisma.ledgerEntry.count();

    return {
      latestRun,
      recentRuns,
      exceptionBreakdown,
      sourceCounts: {
        invoices: invoicesCount,
        bankTransactions: bankTransactionsCount,
        ledgerEntries: ledgerEntriesCount,
        totalSourceRecords: invoicesCount + bankTransactionsCount + ledgerEntriesCount,
      },
    };
  },

  async getExceptions(filter?: {
    type?: ExceptionType;
    priority?: ExceptionPriority;
    resolved?: boolean;
    runId?: string;
    limit?: number;
  }) {
    const where: Prisma.ExceptionWhereInput = {};
    if (filter?.type) where.type = filter.type;
    if (filter?.priority) where.priority = filter.priority;
    if (filter?.resolved !== undefined) where.resolved = filter.resolved;
    if (filter?.runId) where.runId = filter.runId;

    return prisma.exception.findMany({
      where,
      take: filter?.limit ?? 100,
      orderBy: { createdAt: 'desc' },
      include: {
        run: true,
        result: {
          include: {
            invoice: true,
            bankTransaction: true,
            ledgerEntry: true,
          },
        },
      },
    });
  },

  async resolveException(
    exceptionId: string,
    data: {
      resolvedBy: string;
      resolutionNotes?: string;
    }
  ): Promise<Exception | null> {
    try {
      return await prisma.exception.update({
        where: { id: exceptionId },
        data: {
          resolved: true,
          resolvedBy: data.resolvedBy,
          resolvedAt: new Date(),
          resolutionNotes: data.resolutionNotes ?? null,
        },
      });
    } catch (err) {
      console.error(`[dbRepository] Server-side log: Failed to resolve exception ${exceptionId}:`, err);
      return null;
    }
  },
};
