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
    }
  ): Promise<ReconciliationRun> {
    return prisma.reconciliationRun.update({
      where: { id: runId },
      data: {
        ...metrics,
        completedAt: new Date(),
      },
    });
  },

  // Historical Run & Audit Queries
  async getRunDetails(runId: string) {
    return prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: {
        results: {
          include: {
            invoice: true,
            bankTransaction: true,
            ledgerEntry: true,
            exceptions: true,
          },
        },
        exceptions: true,
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
};
