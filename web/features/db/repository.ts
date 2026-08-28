import { prisma } from './index';
import { 
  Prisma,
  type Invoice, 
  type BankTransaction, 
  type LedgerEntry, 
  type RunStatus,
  type MatchMethod,
  type ResultStatus,
  type ExceptionType,
  type ExceptionPriority
} from '@prisma/client';

export type CreateInvoiceInput = Prisma.InvoiceCreateManyInput;
export type CreateBankTransactionInput = Prisma.BankTransactionCreateManyInput;
export type CreateLedgerEntryInput = Prisma.LedgerEntryCreateManyInput;

/**
 * DB Repository Layer
 * Manages persisted source records, reconciliation runs, results, and exceptions.
 */
export const dbRepository = {
  // Source Record Creators (Append-Only)
  async createInvoices(inputs: CreateInvoiceInput[]) {
    return prisma.invoice.createMany({ data: inputs, skipDuplicates: true });
  },

  async createBankTransactions(inputs: CreateBankTransactionInput[]) {
    return prisma.bankTransaction.createMany({ data: inputs, skipDuplicates: true });
  },

  async createLedgerEntries(inputs: CreateLedgerEntryInput[]) {
    return prisma.ledgerEntry.createMany({ data: inputs, skipDuplicates: true });
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
  }) {
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
  }) {
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
        evidenceJson: data.evidenceJson ?? Prisma.JsonNull,
        aiMetadataJson: data.aiMetadataJson ?? Prisma.JsonNull,
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
  }) {
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
  ) {
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
