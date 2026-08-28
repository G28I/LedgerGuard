/**
 * Database & Persistence Domain
 * Prisma Client singleton export and repository accessors.
 */
export { prisma } from '@/lib/prisma';
export { dbRepository } from './repository';
export type { CreateInvoiceInput, CreateBankTransactionInput, CreateLedgerEntryInput } from './repository';
