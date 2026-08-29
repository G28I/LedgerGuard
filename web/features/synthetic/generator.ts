import { faker } from '@faker-js/faker';
import type { 
  NormalizedInvoice, 
  NormalizedBankTx, 
  NormalizedLedgerEntry 
} from '@/features/reconciliation';
import type { 
  SyntheticBatchDataset, 
  GroundTruthLabel 
} from '@/features/benchmark';

export const DEFAULT_BENCHMARK_SEED = 42;
export const DEFAULT_BENCHMARK_CASES = 200;

/**
 * Options for Synthetic Generator
 */
export interface GenerateSyntheticOptions {
  seed?: number;
  totalCases?: number;
}

/**
 * Seeded Synthetic Financial Benchmark Generator
 * Generates 200 reproducible reconciliation cases across 7 scenarios with 100% isolated ground truth labels.
 * Zero dependencies on OpenRouter or AI models.
 */
export function generateSyntheticBenchmarkBatch(
  options: GenerateSyntheticOptions = {}
): SyntheticBatchDataset {
  const seed = options.seed ?? DEFAULT_BENCHMARK_SEED;
  const totalCases = options.totalCases ?? DEFAULT_BENCHMARK_CASES;

  // Seed Faker for 100% reproducible synthetic generation
  faker.seed(seed);

  // Scenario counts based on target share distribution
  const exactCount = Math.round(totalCases * 0.40);       // 40% = 80 cases
  const variationCount = Math.round(totalCases * 0.20);   // 20% = 40 cases
  const amountMismatchCount = Math.round(totalCases * 0.10);// 10% = 20 cases
  const dateMismatchCount = Math.round(totalCases * 0.10);  // 10% = 20 cases
  const missingCount = Math.round(totalCases * 0.10);        // 10% = 20 cases
  const duplicateCount = Math.round(totalCases * 0.05);      // 5% = 10 cases
  const ambiguousCount = Math.round(totalCases * 0.05);      // 5% = 10 cases

  const invoices: NormalizedInvoice[] = [];
  const bankTransactions: NormalizedBankTx[] = [];
  const ledgerEntries: NormalizedLedgerEntry[] = [];
  const groundTruthMap = new Map<string, GroundTruthLabel>();

  let caseCounter = 1;

  function nextRef(prefix: string): string {
    const num = String(caseCounter).padStart(4, '0');
    return `${prefix}-2026-${num}`;
  }

  function cleanStringRef(rawRef: string): string {
    return rawRef.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normVendor(rawVendor: string): string {
    return rawVendor
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const baseDate = new Date('2026-08-01T00:00:00.000Z');

  // =========================================================================
  // 1. EXACT MATCHES (40%, ~80 cases)
  // =========================================================================
  for (let i = 0; i < exactCount; i++) {
    const invRef = nextRef('INV');
    const vendor = faker.company.name();
    const amountCents = faker.number.int({ min: 5000, max: 2500000 }); // $50.00 to $25,000.00
    const issueDate = new Date(baseDate.getTime() + i * 3600000 * 4); // Spaced dates
    const txDate = new Date(issueDate.getTime() + faker.number.int({ min: 1, max: 10 }) * 86400000);

    const invId = `inv_exact_${caseCounter}`;
    const bankId = `bank_exact_${caseCounter}`;
    const ledgerId = `leg_exact_${caseCounter}`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendor,
      normalizedVendor: normVendor(vendor),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    bankTransactions.push({
      id: bankId,
      transactionRef: invRef,
      cleanTransactionRef: cleanStringRef(invRef),
      description: `PAYMENT OUT - ${vendor.toUpperCase()}`,
      normalizedDescription: normVendor(`PAYMENT OUT - ${vendor}`),
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    ledgerEntries.push({
      id: ledgerId,
      entryRef: `LEG-${invRef}`,
      cleanEntryRef: cleanStringRef(`LEG-${invRef}`),
      accountCode: 'AP-2000',
      description: `Ledger Entry for ${vendor}`,
      normalizedDescription: normVendor(vendor),
      amountCents,
      currency: 'USD',
      postingDate: txDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'EXACT_MATCH',
      expectedStatus: 'MATCHED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankId,
      expectedMatchedLedgerEntryId: ledgerId,
      expectedExceptionType: null,
      diagnosticIntendedMethod: 'DETERMINISTIC',
    });

    caseCounter++;
  }

  // =========================================================================
  // 2. VENDOR & MEMO VARIATIONS (20%, ~40 cases)
  // =========================================================================
  for (let i = 0; i < variationCount; i++) {
    const invRef = nextRef('INV');
    const baseVendor = faker.company.name();
    const vendorWithSuffix = `${baseVendor} Corporation Limited`;
    const vendorShort = `${baseVendor} Corp`;
    const amountCents = faker.number.int({ min: 10000, max: 1500000 });
    const issueDate = new Date(baseDate.getTime() + (exactCount + i) * 3600000 * 4);
    const txDate = new Date(issueDate.getTime() + 86400000 * 3);

    const invId = `inv_var_${caseCounter}`;
    const bankId = `bank_var_${caseCounter}`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendorWithSuffix,
      normalizedVendor: normVendor(vendorWithSuffix),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    const isRefMemoVariation = i % 2 === 0;
    const memoDesc = isRefMemoVariation
      ? `ACH WIRE SETTLEMENT REF:${invRef} ${vendorShort.toUpperCase()}`
      : `DEBIT ${vendorShort.toUpperCase()}`;

    bankTransactions.push({
      id: bankId,
      transactionRef: isRefMemoVariation ? `TX-${invRef}` : invRef,
      cleanTransactionRef: cleanStringRef(isRefMemoVariation ? `TX-${invRef}` : invRef),
      description: memoDesc,
      normalizedDescription: normVendor(memoDesc),
      extractedRef: isRefMemoVariation ? cleanStringRef(invRef) : null,
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: isRefMemoVariation ? 'REF_VARIATION' : 'VENDOR_VARIATION',
      expectedStatus: 'MATCHED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankId,
      expectedExceptionType: null,
      diagnosticIntendedMethod: isRefMemoVariation ? 'DETERMINISTIC' : 'FUZZY',
    });

    caseCounter++;
  }

  // =========================================================================
  // 3. AMOUNT MISMATCHES (10%, ~20 cases)
  // =========================================================================
  for (let i = 0; i < amountMismatchCount; i++) {
    const invRef = nextRef('INV');
    const vendor = faker.company.name();
    const invoiceAmountCents = faker.number.int({ min: 50000, max: 1000000 });
    const feeDeductionCents = faker.number.int({ min: 1500, max: 8000 }); // $15.00 to $80.00 discrepancy
    const bankAmountCents = invoiceAmountCents - feeDeductionCents;

    const issueDate = new Date(baseDate.getTime() + (exactCount + variationCount + i) * 3600000 * 4);
    const txDate = new Date(issueDate.getTime() + 86400000 * 2);

    const invId = `inv_amt_mismatch_${caseCounter}`;
    const bankId = `bank_amt_mismatch_${caseCounter}`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendor,
      normalizedVendor: normVendor(vendor),
      amountCents: invoiceAmountCents,
      currency: 'USD',
      issueDate,
    });

    bankTransactions.push({
      id: bankId,
      transactionRef: invRef,
      cleanTransactionRef: cleanStringRef(invRef),
      description: `PAYMENT OUT - ${vendor.toUpperCase()} (FEE DEDUCTED)`,
      normalizedDescription: normVendor(`PAYMENT OUT - ${vendor}`),
      amountCents: bankAmountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'AMOUNT_MISMATCH',
      expectedStatus: 'MISMATCH',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankId,
      expectedExceptionType: 'AMOUNT_MISMATCH',
      diagnosticIntendedMethod: 'FUZZY',
    });

    caseCounter++;
  }

  // =========================================================================
  // 4. DATE MISMATCHES (10%, ~20 cases)
  // =========================================================================
  for (let i = 0; i < dateMismatchCount; i++) {
    const invRef = nextRef('INV');
    const vendor = faker.company.name();
    const amountCents = faker.number.int({ min: 30000, max: 800000 });
    const issueDate = new Date(baseDate.getTime() + i * 86400000 * 2);
    const lateTxDate = new Date(issueDate.getTime() + 90 * 86400000); // 90 days late (> +30 days window)

    const invId = `inv_date_mismatch_${caseCounter}`;
    const bankId = `bank_date_mismatch_${caseCounter}`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendor,
      normalizedVendor: normVendor(vendor),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    bankTransactions.push({
      id: bankId,
      transactionRef: invRef,
      cleanTransactionRef: cleanStringRef(invRef),
      description: `OVERDUE SETTLEMENT - ${vendor.toUpperCase()}`,
      normalizedDescription: normVendor(`OVERDUE SETTLEMENT - ${vendor}`),
      amountCents,
      currency: 'USD',
      transactionDate: lateTxDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'DATE_MISMATCH',
      expectedStatus: 'UNRESOLVED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankId,
      expectedExceptionType: 'DATE_MISMATCH',
      diagnosticIntendedMethod: 'FUZZY',
    });

    caseCounter++;
  }

  // =========================================================================
  // 5. MISSING RECORDS (10%, ~20 cases)
  // =========================================================================
  for (let i = 0; i < missingCount; i++) {
    const invRef = nextRef('INV');
    const vendor = faker.company.name();
    const amountCents = faker.number.int({ min: 20000, max: 500000 });
    const issueDate = new Date(baseDate.getTime() + i * 86400000 * 3);

    const invId = `inv_missing_${caseCounter}`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendor,
      normalizedVendor: normVendor(vendor),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    // Zero bank transaction created for this invoice

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'MISSING_RECORD',
      expectedStatus: 'UNRESOLVED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: null,
      expectedExceptionType: 'MISSING_RECORD',
      diagnosticIntendedMethod: 'DETERMINISTIC',
    });

    caseCounter++;
  }

  // =========================================================================
  // 6. DUPLICATES (5%, ~10 cases)
  // =========================================================================
  for (let i = 0; i < duplicateCount; i++) {
    const invRef = nextRef('INV');
    const vendor = faker.company.name();
    const amountCents = faker.number.int({ min: 40000, max: 900000 });
    const issueDate = new Date(baseDate.getTime() + i * 86400000 * 4);
    const txDate = new Date(issueDate.getTime() + 86400000 * 2);

    const invId = `inv_dup_${caseCounter}`;
    const bankIdA = `bank_dup_${caseCounter}_A`;
    const bankIdB = `bank_dup_${caseCounter}_B`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: vendor,
      normalizedVendor: normVendor(vendor),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    // 2 effectively identical bank transactions for 1 invoice
    bankTransactions.push({
      id: bankIdA,
      transactionRef: `TX-DUP-${invRef}-1`,
      cleanTransactionRef: cleanStringRef(`TX-DUP-${invRef}-1`),
      description: `ACH PAYMENT - ${vendor.toUpperCase()} ${invRef}`,
      normalizedDescription: normVendor(`ACH PAYMENT - ${vendor} ${invRef}`),
      extractedRef: cleanStringRef(invRef),
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    bankTransactions.push({
      id: bankIdB,
      transactionRef: `TX-DUP-${invRef}-1`, // Identical Ref and Amount
      cleanTransactionRef: cleanStringRef(`TX-DUP-${invRef}-1`),
      description: `ACH PAYMENT - ${vendor.toUpperCase()} ${invRef}`,
      normalizedDescription: normVendor(`ACH PAYMENT - ${vendor} ${invRef}`),
      extractedRef: cleanStringRef(invRef),
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'DUPLICATE',
      expectedStatus: 'UNRESOLVED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankIdA,
      expectedExceptionType: 'DUPLICATE',
      diagnosticIntendedMethod: 'FUZZY',
    });

    caseCounter++;
  }

  // =========================================================================
  // 7. AMBIGUOUS MATCHES & ADVERSARIAL CASES (5%, ~10 cases)
  // =========================================================================
  for (let i = 0; i < ambiguousCount; i++) {
    const invRef = nextRef('INV');
    const baseName = `Apex Global ${i + 1}`;
    const amountCents = faker.number.int({ min: 60000, max: 1200000 });
    const issueDate = new Date(baseDate.getTime() + i * 86400000 * 5);
    const txDate = new Date(issueDate.getTime() + 86400000 * 3);

    const invId = `inv_ambig_${caseCounter}`;
    const bankIdA = `bank_ambig_${caseCounter}_A`;
    const bankIdB = `bank_ambig_${caseCounter}_B`;

    invoices.push({
      id: invId,
      invoiceNumber: invRef,
      cleanInvoiceNumber: cleanStringRef(invRef),
      vendorName: `${baseName} Holdings`,
      normalizedVendor: normVendor(`${baseName} Holdings`),
      amountCents,
      currency: 'USD',
      issueDate,
    });

    // 2 plausible non-identical candidate bank transactions with tie scores
    bankTransactions.push({
      id: bankIdA,
      transactionRef: `TX-AMB-${caseCounter}-A`,
      cleanTransactionRef: cleanStringRef(`TX-AMB-${caseCounter}-A`),
      description: `${baseName.toUpperCase()} PARTNERS`,
      normalizedDescription: normVendor(`${baseName} PARTNERS`),
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    bankTransactions.push({
      id: bankIdB,
      transactionRef: `TX-AMB-${caseCounter}-B`,
      cleanTransactionRef: cleanStringRef(`TX-AMB-${caseCounter}-B`),
      description: `${baseName.toUpperCase()} GROUP`,
      normalizedDescription: normVendor(`${baseName} GROUP`),
      amountCents,
      currency: 'USD',
      transactionDate: txDate,
    });

    groundTruthMap.set(invId, {
      caseId: `CASE-${caseCounter}`,
      scenarioType: 'AMBIGUOUS_MATCH',
      expectedStatus: 'UNRESOLVED',
      expectedMatchedInvoiceId: invId,
      expectedMatchedBankTxId: bankIdA,
      expectedExceptionType: 'AMBIGUOUS_MATCH',
      diagnosticIntendedMethod: 'FUZZY',
    });

    caseCounter++;
  }

  return {
    seed,
    totalCases: groundTruthMap.size,
    sourceRecords: {
      invoices,
      bankTransactions,
      ledgerEntries,
    },
    groundTruthMap,
  };
}
