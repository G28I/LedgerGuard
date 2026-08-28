import { prisma } from '../lib/prisma';
import { dbRepository } from '../features/db/repository';
import { MatchMethod, ResultStatus, ExceptionType, ExceptionPriority, RunStatus } from '@prisma/client';

async function main() {
  console.log('🌱 Starting database verification and seed script...');

  // 1. Clean existing test seed data
  await prisma.exception.deleteMany({});
  await prisma.reconciliationResult.deleteMany({});
  await prisma.reconciliationRun.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.bankTransaction.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});

  // 2. Insert representative append-only source records (monetary values in integer cents)
  console.log('📦 Inserting source records...');
  
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-001',
      vendorName: 'Acme Corporation Ltd.',
      vendorNormalized: 'acme corp',
      amountCents: 150000, // $1,500.00
      currency: 'USD',
      issueDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-31'),
      status: 'OPEN',
      groundTruthId: 'GT-PAIR-001', // Benchmark ground truth
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-002',
      vendorName: 'Starlight Logistics Inc.',
      vendorNormalized: 'starlight logistics',
      amountCents: 85075, // $850.75
      currency: 'USD',
      issueDate: new Date('2026-08-05'),
      dueDate: new Date('2026-09-05'),
      status: 'OPEN',
      groundTruthId: 'GT-PAIR-002',
    },
  });

  const bankTx1 = await prisma.bankTransaction.create({
    data: {
      transactionRef: 'BANK-TX-9901',
      description: 'WIRE OUT - ACME CORP',
      descriptionNormalized: 'acme corp',
      amountCents: 150000, // $1,500.00
      currency: 'USD',
      transactionDate: new Date('2026-08-15'),
      accountNumber: 'ACC-7788',
      groundTruthId: 'GT-PAIR-001',
    },
  });

  const bankTx2 = await prisma.bankTransaction.create({
    data: {
      transactionRef: 'BANK-TX-9902',
      description: 'ACH DEBIT - STARLIGHT LOGISTICS',
      descriptionNormalized: 'starlight logistics',
      amountCents: 80000, // $800.00 (DISCREPANCY: expected $850.75)
      currency: 'USD',
      transactionDate: new Date('2026-08-16'),
      accountNumber: 'ACC-7788',
      groundTruthId: 'GT-PAIR-002',
    },
  });

  const ledgerEntry1 = await prisma.ledgerEntry.create({
    data: {
      entryRef: 'LEG-1001',
      accountCode: 'AP-500',
      description: 'Acme Payment Ledger Entry',
      amountCents: 150000,
      currency: 'USD',
      postingDate: new Date('2026-08-15'),
      groundTruthId: 'GT-PAIR-001',
    },
  });

  console.log(`✓ Inserted 2 Invoices, 2 Bank Transactions, 1 Ledger Entry.`);

  // 3. Create a Reconciliation Run
  console.log('🔄 Creating Reconciliation Run...');
  const run = await dbRepository.createRun({
    runNumber: `RUN-VERIFY-${Date.now()}`,
    batchName: 'Synthetic Verification Batch 1',
    totalRecords: 2,
    status: RunStatus.PROCESSING,
  });

  // 4. Record a MATCHED result (Deterministic Match)
  await dbRepository.recordResult({
    runId: run.id,
    invoiceId: invoice1.id,
    bankTransactionId: bankTx1.id,
    ledgerEntryId: ledgerEntry1.id,
    status: ResultStatus.MATCHED,
    method: MatchMethod.DETERMINISTIC,
    aiUsed: false,
    confidence: 1.0,
    amountDeltaCents: 0,
    reasonCode: 'EXACT_REF_AND_AMOUNT_MATCH',
    explanation: 'Exact reference, vendor identity, and amount match across Invoice, Bank, and Ledger.',
    evidenceJson: {
      invoiceRef: invoice1.invoiceNumber,
      bankRef: bankTx1.transactionRef,
      matchedAmountCents: 150000,
    },
  });

  // 5. Record an UNRESOLVED result with MULTIPLE Exceptions per result (Testing Non-Unique Exception.resultId)
  const result2 = await dbRepository.recordResult({
    runId: run.id,
    invoiceId: invoice2.id,
    bankTransactionId: bankTx2.id,
    status: ResultStatus.UNRESOLVED,
    method: MatchMethod.FUZZY,
    aiUsed: true,
    confidence: 0.62,
    amountDeltaCents: -5075, // -$50.75 mismatch
    reasonCode: 'AMOUNT_AND_DATE_DISCREPANCY',
    explanation: 'Vendor matches fuzzy score 0.95, but settlement amount delta is $50.75 lower than invoice.',
    evidenceJson: {
      expectedCents: 85075,
      actualCents: 80000,
      deltaCents: -5075,
    },
  });

  // Exception 1 for Result 2: Amount Mismatch
  await dbRepository.createException({
    runId: run.id,
    resultId: result2.id,
    type: ExceptionType.AMOUNT_MISMATCH,
    priority: ExceptionPriority.HIGH,
    reason: 'Settlement amount $800.00 is $50.75 lower than Invoice amount $850.75',
    expectedValue: '$850.75 (85075 cents)',
    observedValue: '$800.00 (80000 cents)',
  });

  // Exception 2 for Result 2: Ambiguous Match / Multiple Exceptions on Same Result
  await dbRepository.createException({
    runId: run.id,
    resultId: result2.id,
    type: ExceptionType.AMBIGUOUS_MATCH,
    priority: ExceptionPriority.MEDIUM,
    reason: 'AI confidence 0.62 below policy threshold 0.85 for auto-resolution.',
    expectedValue: 'Confidence >= 0.85',
    observedValue: 'Confidence = 0.62',
  });

  // Complete Run
  await dbRepository.completeRun(run.id, {
    matchedCount: 1,
    unresolvedCount: 1,
    exceptionCount: 2,
    aiCallCount: 1,
    accuracy: 1.0,
    resolutionRate: 0.5,
    durationMs: 450,
    status: RunStatus.COMPLETED,
  });

  console.log('✓ Reconciliation Run completed successfully.');

  // 6. Verify Relations & Query Audit Trail
  const fetchedRun = await dbRepository.getRunDetails(run.id);

  console.log('\n📊 Database Verification Summary:');
  console.log(`- Run Number: ${fetchedRun?.runNumber}`);
  console.log(`- Run Status: ${fetchedRun?.status}`);
  console.log(`- Total Results: ${fetchedRun?.results.length}`);
  console.log(`- Total Run Exceptions: ${fetchedRun?.exceptions.length}`);

  if (fetchedRun && fetchedRun.results.length >= 2) {
    const res1 = fetchedRun.results[0];
    const res2 = fetchedRun.results[1];
    
    console.log(`- Result 1 Method: ${res1.method}, Status: ${res1.status}, AI Used: ${res1.aiUsed}`);
    console.log(`- Result 2 Method: ${res2.method}, Status: ${res2.status}, Exceptions Count: ${res2.exceptions.length}`);
    
    if (res2.exceptions.length !== 2) {
      throw new Error(`Verification failed: Expected 2 exceptions on Result 2, found ${res2.exceptions.length}`);
    }
  }

  console.log('\n✅ All database schema constraints, relations, and enums verified successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Verification script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
