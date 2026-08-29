# Scope: AI Finance Controller

Build an AI-assisted finance reconciliation controller that processes a meaningful batch of synthetic financial records, determines which records reconcile, uses AI only where ambiguity genuinely requires reasoning, and produces an auditable result with measured accuracy, throughput, and an honest exception list.

The first version closes exactly one finance-ops loop: **multi-source reconciliation across invoices, ledger entries, and bank transactions**.

Build it as a thin working slice first: ingest a small but real batch, reconcile it end-to-end, persist the results, and show the outcome in the UI before making any individual part more sophisticated. Then thicken the system piece by piece.

Before every build step, decide what is being built and why in a few plain sentences, then build it. If implementation proves that the plan is wrong, contradictory, or needlessly complicated, update this file and the implementation rather than silently working around the problem.

Whenever a build step gets underway, keep its checklist here and check things off as they are actually completed. This file should be enough for a fresh conversation to understand what exists, what remains, and why.

---

## Stack

Already decided:

* Next.js App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* PostgreSQL
* Prisma
* OpenRouter
* Zod
* Recharts
* Faker for reproducible synthetic financial data

Keep the AI provider behind a small application-level interface so the reconciliation engine does not depend directly on OpenRouter-specific details.

Do not add a heavyweight agent framework unless the implementation develops a concrete need for one.

---

## Sketches

There are no final visual designs yet.

Any future sketches should be treated as structural references only: what information exists and roughly where it sits, not as the final typography, spacing, colors, or component treatment.

If a sketch contradicts a written product decision here, stop and resolve the contradiction rather than quietly choosing one.

---

## At a glance

| #  | Feature                                    | Phase      | Status      |
| -- | ------------------------------------------ | ---------- | ----------- |
| 1  | Foundation and project setup               | Foundation | completed   |
| 2  | Coding standards & tooling                 | Foundation | completed   |
| 3  | Financial data model                       | Foundation | completed   |
| 4  | Reconciliation domain model & rules        | Foundation | completed   |
| 5  | Synthetic benchmark generator              | Foundation | completed   |
| 6  | Thin end-to-end reconciliation slice       | Slice 1    | completed   |
| 7  | AI ambiguity resolver                      | Slice 2    | completed   |
| 8  | Reconciliation dashboard & exception queue | Slice 3    | not started |
| 9  | Benchmarking, metrics & audit trail        | Slice 4    | not started |
| 10 | Failure recovery & hardening               | Slice 5    | not started |

---

# Foundation

## 1. Foundation and project setup

Create the Next.js application and establish the base project structure.

The first objective is not to build screens. It is to have a running application with the core dependencies configured and a known starting point for the reconciliation system.

Prisma should connect to PostgreSQL from the beginning.

OpenRouter should be configured through environment variables, but the project must be able to start without making an AI request.

Required configuration should fail fast when the application actually requires it rather than failing silently later.

### Decisions

* **Next.js App Router**: Route handlers (`app/api/`) and pages (`app/`) remain thin wrappers around core domain features.
* **Feature-Based Folder Structure**:
  - `features/reconciliation`: Pure TypeScript reconciliation engine, deterministic rules, fuzzy candidate generator, policy engine.
  - `features/synthetic`: Ground-truth synthetic benchmark generator with reproducible seeds (Faker).
  - `features/ai`: OpenRouter provider adapter, structured prompt templates, Zod output validators, failure recovery.
  - `features/benchmark`: Evaluation metrics calculator (precision, recall, F1, throughput, resolution rate).
  - `features/db`: Prisma client singleton and database repositories.
* **Prisma + PostgreSQL Setup**: Schema models explicit relational entities (`Invoice`, `BankTransaction`, `LedgerEntry`, `ReconciliationRun`, `ReconciliationResult`, `Exception`). Preserves original source data and full audit history.
* **OpenRouter Integration Boundary**: Isolated provider interface requiring structured output, strictly validated with Zod schemas before entering domain logic.
* **Environment Validation**: `lib/env.ts` with Zod to fail fast at startup if required variables (`DATABASE_URL`, `OPENROUTER_API_KEY`) are missing.
* **Domain Logic Boundary**: `features/reconciliation` contains pure functions with zero framework/UI/provider dependencies.

### Checklist

* [x] Create feature folder structure (`features/reconciliation`, `features/synthetic`, `features/ai`, `features/benchmark`, `features/db`)
* [x] Implement Zod environment validation in `lib/env.ts`
* [x] Install required foundation packages (`zod`, `recharts`, `@faker-js/faker`, `lucide-react`, `clsx`, `tailwind-merge`)
* [x] Verify Prisma PostgreSQL client connection
* [x] Verify Next.js clean start, lint, typecheck, and build

---

## 2. Coding standards & tooling

Define the actual engineering conventions once the project exists.

Keep the codebase strictly typed and predictable.

Financial/domain logic should be implemented as pure functions where possible so it can be tested independently from the database, UI, and AI provider.

### Standards & Decisions

1. **TypeScript Strictness**:
   - `tsconfig.json` maintains `"strict": true`, `"noImplicitReturns": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"exactOptionalPropertyTypes": true`.
   - Zero tolerance for `any`. External/untrusted data (e.g. AI or API responses) is represented as `unknown` at system boundaries and MUST be validated with Zod before entering domain logic. Do not use type assertions (`as ...`) to bypass validation.
2. **ESLint & Linting**:
   - Next.js flat config (`eslint.config.mjs`) extending `core-web-vitals` and `typescript`.
   - Run via `npm run lint`.
3. **Formatting & Imports**:
   - Standardize on ESM (`"type": "module"`) imports.
   - Use path aliases `@/features/...`, `@/lib/...` for clean, decoupled module boundaries.
   - Immutability by default: prefer TypeScript `const`, `readonly` properties, and immutable data patterns over runtime `Object.freeze` (use freezing only when explicitly required).
4. **Feature-Based Folder Conventions**:
   - Each domain feature (`reconciliation`, `synthetic`, `ai`, `benchmark`, `db`) owns its types, domain rules, and pure helper functions inside `features/<name>/`.
   - Features expose public symbols via `features/<name>/index.ts`. Internal helpers remain private to their feature folder.
5. **Environment & Config Conventions**:
   - Access environment variables strictly via `import { env } from '@/lib/env'` (validated with Zod at startup). Never dereference unvalidated `process.env` in domain logic.
6. **Prisma Conventions**:
   - Always access database via singleton `import { prisma } from '@/features/db'`.
   - Schema uses explicit relational entities for querying/filtering; raw JSON fields reserved strictly for variable audit metadata.
7. **Domain & Financial Business-Logic Conventions**:
   - Pure functional style: reconciliation functions take normalized records and return deterministic decisions without side effects.
   - Safe financial arithmetic: monetary amounts represented in integer cents (e.g. `$100.50` stored as `10050` cents) or decimal-safe string abstractions to avoid IEEE 754 floating-point inaccuracies.
8. **Developer Checks & Scripts**:
   - `"typecheck": "tsc --noEmit"` in `package.json`.
   - `"check": "npm run typecheck && npm run lint"` for single-command developer checks.

### Checklist

* [x] Enhance `tsconfig.json` with additional strictness flags (`noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`)
* [x] Add `typecheck` and `check` scripts to `package.json`
* [x] Create coding standards documentation in `docs/coding-standards.md`
* [x] Document financial arithmetic rules (cents/integer representation) in `features/reconciliation/`
* [x] Verify `npm run check` (typecheck + lint) passes cleanly

---

## 3. Financial data model

The database must preserve the original financial records and the history of every reconciliation run.

At minimum, model:

* invoices
* ledger entries
* bank transactions
* reconciliation runs
* reconciliation results
* exceptions

Every reconciliation result must be attributable to a particular run.

A reconciliation result should retain enough information to explain what was compared, what decision was reached, how the decision was reached, and whether AI participated.

Do not overwrite source records to make them reconcile.

Do not store the entire financial domain as one generic JSON object.

### Final Prisma / PostgreSQL Schema Decisions

1. **Monetary Representation & Numeric Range**:
   - Amounts are stored as integer `amountCents` (`Int` in Prisma/PostgreSQL, supported signed 32-bit range: -2,147,483,648 to 2,147,483,647 cents, corresponding to ±$21,474,836.47).
   - Rationale: Standard 32-bit `Int` easily covers synthetic financial batch transactions up to $21.4M with exact 0-rounding integer arithmetic across Node.js, Prisma, and PostgreSQL.
   - `currency` is stored as an ISO string (default `"USD"`).

2. **Source Financial Entities (Append-Only Data)**:
   - `Invoice`, `BankTransaction`, and `LedgerEntry` are append-only source records. `updatedAt` timestamps are removed to enforce immutability of ingested source data.
   - `Invoice`: `id`, `invoiceNumber`, `vendorName`, `vendorNormalized`, `amountCents`, `currency`, `issueDate`, `dueDate`, `status`, `groundTruthId`, `createdAt`.
   - `BankTransaction`: `id`, `transactionRef`, `description`, `descriptionNormalized`, `amountCents`, `currency`, `transactionDate`, `accountNumber`, `groundTruthId`, `createdAt`.
   - `LedgerEntry`: `id`, `entryRef`, `accountCode`, `description`, `amountCents`, `currency`, `postingDate`, `groundTruthId`, `createdAt`.

3. **Reconciliation Run, Results & Non-Unique Exceptions**:
   - `ReconciliationRun`: Tracks run status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), batch metrics (`totalRecords`, `matchedCount`, `unresolvedCount`, `exceptionCount`, `aiCallCount`, `accuracy`, `resolutionRate`, `durationMs`), `startedAt`, `completedAt`.
   - `ReconciliationResult`: Connects source records (`invoiceId`, `bankTransactionId`, `ledgerEntryId`), decision status (`MATCHED`, `MISMATCH`, `UNRESOLVED`), matching method (`DETERMINISTIC`, `FUZZY`, `AI`), `aiUsed` boolean, `confidence` score, `amountDeltaCents`, `reasonCode`, `explanation`, `evidenceJson`, `aiMetadataJson`.
   - `Exception`: Linked to a run and optional `resultId` (**non-unique**, allowing one reconciliation result to produce multiple exception records). Includes `type`, `priority`, `reason`, `expectedValue`, `observedValue`, `resolved`, `resolvedBy`, `resolvedAt`, `resolutionNotes`, `createdAt`.

4. **Supporting Enums**:
   - `RunStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
   - `MatchMethod`: `DETERMINISTIC`, `FUZZY`, `AI`
   - `ResultStatus`: `MATCHED`, `MISMATCH`, `UNRESOLVED`
   - `ExceptionType`: `AMOUNT_MISMATCH`, `DATE_MISMATCH`, `MISSING_RECORD`, `DUPLICATE`, `AMBIGUOUS_MATCH`, `AI_UNAVAILABLE`, `AI_INVALID_RESPONSE`, `INSUFFICIENT_EVIDENCE`
   - `ExceptionPriority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

5. **Benchmark Ground Truth Isolation**:
   - `groundTruthId` is stored strictly for offline synthetic benchmark evaluation. The runtime reconciliation engine and decision paths are isolated and cannot consume `groundTruthId`.

### Checklist

* [x] Finalize the Prisma schema with the adjustments above in `prisma/schema.prisma`
* [x] Generate Prisma Client (`npx prisma generate`)
* [x] Apply schema to PostgreSQL database (`npx prisma db push`)
* [x] Create DB repository utilities in `features/db/`
* [x] Create representative seed script in `prisma/seed.ts`
* [x] Verify source records are preserved as append-only
* [x] Verify reconciliation runs can reference results and multiple exceptions per result
* [x] Verify benchmark ground truth is isolated from decision logic

---

### Reconciliation Engine Architecture & Rules

The domain layer lives in `features/reconciliation/` as pure, side-effect-free TypeScript functions. AI calls are strictly deferred to Slice 2; Feature 4 establishes the deterministic foundation.

```text
Normalized Source Records
          ↓
Multi-Index Candidate Generator
          ↓
Level 1: Exact Deterministic Rules (Ref, Amount, Currency, Strict Date)
          ↓ (If unmatched)
Level 2: Normalized & Bounded Fuzzy Rules (Vendor Similarity, Amount Delta, Date Window)
          ↓ (If ambiguous or conflict)
Duplicate & Ambiguity Safety Checks
          ↓
Decision Policy Gate → [MATCHED | MISMATCH | UNRESOLVED] + Exception List
```

#### 1. Normalized Record Representations
- **`NormalizedInvoice`**: `id`, `invoiceNumber` (raw + cleaned uppercase), `vendorName` (raw + normalized string), `amountCents` (integer cents), `currency` (ISO upper), `issueDate` (ISO Date), `dueDate` (ISO Date).
- **`NormalizedBankTx`**: `id`, `transactionRef` (raw + cleaned uppercase), `description` (raw + normalized string), `extractedRef` (regex extracted invoice ref if present), `amountCents` (integer cents), `currency` (ISO upper), `transactionDate` (ISO Date).
- **`NormalizedLedgerEntry`**: `id`, `entryRef` (raw + cleaned uppercase), `accountCode`, `description` (raw + normalized string), `amountCents` (integer cents), `currency` (ISO upper), `postingDate` (ISO Date).

#### 2. Normalization Rules
- **Vendor/Description Normalization**: Lowercases, strips punctuation, normalizes spaces, and strips corporate suffixes (`Inc`, `Ltd`, `Corp`, `LLC`, `Co`, `Corporation`, `Limited`, `Incorporated`).
- **Reference Extraction**: Uses pattern matching (`INV-\d+`, `PO-\d+`, `LEG-\d+`) to pull embedded reference tokens out of messy bank descriptions.

#### 3. Candidate Generation Strategy
- Uses indexed lookup maps (by exact reference, extracted reference, normalized vendor token, amountCents, and date window) rather than $O(N \times M)$ pairwise comparison.
- Produces bounded candidate pairs `(Invoice, BankTx, LedgerEntry?)` for rule evaluation.

#### 4. Level 1: Exact Deterministic Matching Rules
- **Rule 1.1 (Exact Reference & Amount Match)**: Exact reference match AND exact `amountCents` equality AND exact `currency` match AND `transactionDate` within `[-5, +30]` days of `issueDate`.
  - Result: `MATCHED`, method `DETERMINISTIC`, confidence `1.0`, reason `EXACT_REF_AND_AMOUNT_MATCH`.

#### 5. Level 2: Fuzzy & Bounded Discrepancy Matching Rules
- **Rule 2.1 (Normalized Vendor & Exact Amount Match)**: Normalized vendor similarity $\ge 0.85$ AND exact `amountCents` equality AND currency match AND `transactionDate` within `[-5, +30]` days.
  - Result: `MATCHED`, method `FUZZY`, confidence `0.90`, reason `FUZZY_VENDOR_EXACT_AMOUNT_MATCH`.
- **Rule 2.2 (Discrepancy - Amount Mismatch)**: Vendor/Reference matches ($\ge 0.85$), but `amountCents` delta is non-zero (exceeds fee threshold).
  - Result: `MISMATCH` or `UNRESOLVED`, method `FUZZY`, produces `AMOUNT_MISMATCH` Exception.
- **Rule 2.3 (Discrepancy - Date Mismatch)**: Reference and amount match, but `transactionDate` falls outside the allowed 35-day window.
  - Result: `UNRESOLVED`, method `FUZZY`, produces `DATE_MISMATCH` Exception.

#### 6. Safety & Disambiguation Rules
- **Duplicate Detection**: If a single invoice matches multiple bank transactions (or vice versa), ALL candidate matches for that record are rejected and flagged as `DUPLICATE` Exceptions.
- **Multiple Plausible Candidates**: If top 2 candidate scores for a record differ by $< 0.05$, the decision is set to `UNRESOLVED` with an `AMBIGUOUS_MATCH` Exception to prevent false-positive matching.
- **Missing Record Detection**: Records with zero candidate matches produce `MISSING_RECORD` Exceptions.
- **Currency Isolation**: Mismatched currencies are never auto-matched without explicit conversion logic; flagged as `UNRESOLVED` (`INSUFFICIENT_EVIDENCE`).

#### 7. Representative Edge Cases Covered
- `exact_match`: Identical reference, amount, and date.
- `vendor_name_variation`: "Acme Corporation Ltd." vs "ACME CORP".
- `reference_variation`: Embedded ref "PAYMENT FOR INV-2026-001" in bank memo.
- `amount_mismatch`: Vendor matches, but bank amount is $800.00 while invoice is $850.75.
- `date_mismatch`: Valid reference and amount, but bank transaction is 90 days late.
- `missing_transaction`: Invoice with 0 matching bank or ledger entries.
- `duplicate_candidate`: Two identical bank transactions matching the same single invoice.
- `multiple_plausible_candidates`: Invoice matching two different bank transactions with equal similarity scores (0.88 vs 0.86).
- `insufficient_evidence`: Bank memo "TRANSFER 123" with no reference or vendor match.

### Checklist

* [x] Implement normalized record domain types in `features/reconciliation/types.ts`
* [x] Implement string & vendor normalization utility in `features/reconciliation/normalize.ts`
* [x] Implement candidate indexing and generation in `features/reconciliation/candidates.ts`
* [x] Implement Level 1 exact deterministic matching rules in `features/reconciliation/rules/exact.ts`
* [x] Implement Level 2 fuzzy matching and similarity scoring in `features/reconciliation/rules/fuzzy.ts`
* [x] Implement safety rules (duplicate detection, candidate ties, missing records) in `features/reconciliation/safety.ts`
* [x] Implement pure reconciliation engine pipeline in `features/reconciliation/engine.ts`
* [x] Write unit verification tests covering all 9 representative edge cases
* [x] Verify `npm run check` (typecheck + lint) passes cleanly
* [x] Verify decisions against representative cases

---

# Slice 1: Thin working reconciliation loop

## 5. Synthetic benchmark generator

The synthetic benchmark generator provides reproducible multi-source financial data with independent ground truth labels for objective evaluation.

### Feature 4 Edge-Case Semantics Clarification
- **Why `INSUFFICIENT_EVIDENCE` becomes `MISSING_RECORD` for unlinked memo tokens**:
  - In Feature 4, when a bank description contains generic text (e.g. `"GENERIC TRANSFER 123"`) with zero reference token link and zero vendor similarity to an invoice, the candidate generator correctly finds **0 candidate matches** for that invoice.
  - To the reconciliation engine, an invoice with 0 matching candidate records in the bank batch is classified as a `MISSING_RECORD` exception (no corresponding transaction found in the settlement source).
  - Conversely, if candidate records ARE generated (e.g. via token overlap) but lack sufficient reference proof to auto-resolve, the engine produces `reasonCode: 'INSUFFICIENT_EVIDENCE'` with an `INSUFFICIENT_EVIDENCE` Exception. This explicit semantic distinction is intentional and enforced.

---

### Generator Architecture & Design Decisions

#### 1. Location & Module Boundaries
- **Generation Logic (`features/synthetic/`)**: Pure generator functions using `@faker-js/faker`. Zero dependencies on OpenRouter or AI models.
- **Shared Benchmark Contracts (`features/benchmark/`)**: Shared types (`SyntheticBatchDataset`, `GroundTruthLabel`, `BenchmarkScenarioType`) live in `features/benchmark/types.ts` so generation and evaluation layers stay cleanly decoupled.

#### 2. Reproducible Seed Strategy
- Uses `@faker-js/faker` with explicit `faker.seed(seedNumber)` (e.g. `seed = 42`).
- Guaranteed 100% reproducible synthetic financial batches across test runs and benchmark scoring.

#### 3. Target Benchmark Size & Distribution (200 Records Default)
- **Primary Benchmark Size**: **200 records** (substantially above the 50-record minimum, testing realistic batch throughput and statistical metrics).
- **Scenario Share Distribution**:
  - **Exact Matches (40%, ~80 records)**: Identical invoice number, vendor name, exact integer amountCents, valid dates.
  - **Vendor & Memo Variations (20%, ~40 records)**: Typos, corporate suffixes (`"Acme Corp"` vs `"Acme Corporation Limited"`), memo prefixes (`"WIRE SETTLEMENT REF: INV-2026-101"`).
  - **Amount Mismatches (10%, ~20 records)**: Settlement fee deductions (-$5.00 to -$50.00), partial payments, rounding errors.
  - **Date Mismatches (10%, ~20 records)**: Settlement dates 45 to 120 days past invoice due date.
  - **Missing Records (10%, ~20 records)**: Unmatched invoices without bank transactions, or unlinked bank deposits.
  - **Duplicates & Ambiguous Matches (10%, ~20 records)**: Double bank payments for 1 invoice, split payments, or lookalike vendor candidates (`"Apex Capital Group"` vs `"Apex Capital Partners"`).

#### 4. Ground Truth Labeling & Isolation
- Each synthetic record is assigned an isolated `groundTruthId` (e.g. `GT-PAIR-088`).
- **`GroundTruthLabel` Object**:
  - `groundTruthId`: `string`
  - `scenarioType`: `EXACT_MATCH` | `VENDOR_VARIATION` | `REF_VARIATION` | `AMOUNT_MISMATCH` | `DATE_MISMATCH` | `MISSING_RECORD` | `DUPLICATE` | `AMBIGUOUS_MATCH` | `ADVERSARIAL`
  - `expectedStatus`: `MATCHED` | `MISMATCH` | `UNRESOLVED`
  - `expectedMatchMethod`: `DETERMINISTIC` | `FUZZY` | `AI`
  - `expectedExceptionType`: `AMOUNT_MISMATCH` | `DATE_MISMATCH` | `MISSING_RECORD` | `DUPLICATE` | `AMBIGUOUS_MATCH` | `INSUFFICIENT_EVIDENCE` | null
  - `expectedInvoiceId`: `string`
  - `expectedBankTxId`: `string` | null
- **Strict Isolation Guarantee**: Generator produces `SyntheticBatchDataset` containing two separate outputs:
  - `sourceRecords`: Pure `Invoice[]`, `BankTransaction[]`, `LedgerEntry[]` sent to the runtime reconciliation engine.
  - `groundTruthMap`: `Map<string, GroundTruthLabel>` passed ONLY to `features/benchmark/` for offline scoring.
  - The runtime reconciliation engine receives ONLY `sourceRecords` and has zero access to `groundTruthMap` or `groundTruthId`.

#### 5. Adversarial Scenarios
- `ADVERSARIAL_LOOKALIKE`: Invoices with similar vendor names and identical amountCents, but different invoice numbers and dates (tests candidate tie-breaking & ambiguity safety).
- `ADVERSARIAL_DUPLICATE_MEMO`: Bank memos with copy-pasted invoice references for two separate transactions.
- `ADVERSARIAL_UNRESOLVED_MEMO`: Garbage bank descriptions (`"MISC DEP 8839"`) with matching amounts.

#### 6. Objective Benchmark Scoring Contract
- `features/benchmark/` compares runtime `ReconciliationDecision[]` against `groundTruthMap` to calculate:
  - Overall Accuracy %
  - Precision, Recall, F1 for Matches
  - Precision & Recall for Exception Detection
  - Throughput (records/sec) & AI Escalation Rate

### Checklist

* [x] Define benchmark data types and ground truth contracts in `features/benchmark/types.ts`
* [x] Implement reproducible seeded Faker generator in `features/synthetic/generator.ts`
* [x] Implement scenario distributions (Exact, Variation, Amount Mismatch, Date Mismatch, Missing, Duplicate, Ambiguous)
* [x] Implement adversarial cases (Lookalike vendors, duplicate memos, garbage descriptions)
* [x] Enforce strict ground truth isolation from runtime reconciliation engine
* [x] Export synthetic generator API in `features/synthetic/index.ts`
* [x] Generate 50-record initial dataset and 200-record primary benchmark dataset
* [x] Verify generator seed reproducibility and ground truth integrity

---

## 6. Thin end-to-end reconciliation slice

The thin slice connects all foundation layers into one executable, auditable end-to-end reconciliation workflow without AI dependencies.

```text
Pure Domain Engine (features/reconciliation/)
        ↓
Application Orchestration (features/reconciliation/service.ts)
        ↓
Prisma & PostgreSQL Persistence (features/db/repository.ts)
        ↓
Next.js API Route & Response Contract (app/api/reconciliation/run/route.ts)
```

### Architecture & Service Boundaries

#### 1. Application Service Layer (`features/reconciliation/service.ts`)
- **`reconciliationService.executeRun(params)`**:
  - Accepts `{ seed?: number; batchName?: string }`.
  - Generates or loads the 200-case synthetic benchmark batch via `generateSyntheticBenchmarkBatch({ seed })`.
  - Ingests append-only source records into PostgreSQL using `dbRepository.createInvoices`, `createBankTransactions`, `createLedgerEntries`.
  - Creates a `ReconciliationRun` record in PostgreSQL with `status: PENDING`.
  - Transitions `ReconciliationRun` to `status: PROCESSING`.
  - Executes pure `runReconciliationEngine` (0 side-effects).
  - Measures execution duration (`durationMs`) and throughput (`totalRecords / (durationMs / 1000)`).
  - Maps domain `ReconciliationDecision` objects into database `ReconciliationResult` and `Exception` rows.
  - Persists all results and exceptions in a single database transaction (`prisma.$transaction`).
  - Calculates run-level metrics (`matchedCount`, `unresolvedCount`, `exceptionCount`, `resolutionRate`, `durationMs`).
  - Transitions `ReconciliationRun` to `status: COMPLETED` (or `status: FAILED` on error).

#### 2. Source Record & Run Association
- Source records in PostgreSQL remain 100% append-only and unmutated.
- `ReconciliationResult` rows reference `runId` and optional foreign keys (`invoiceId`, `bankTransactionId`, `ledgerEntryId`).
- Multiple runs can reference the same source records over time without data duplication or mutation.

#### 3. Transaction Safety & Failure Handling
- Result and Exception database insertions are wrapped in an atomic `prisma.$transaction`.
- If persistence fails, the run is updated to `status: FAILED` with error details logged in `ReconciliationRun`, preventing orphaned or partial result rows.

#### 4. API Entry Point & Minimal UI Contract
- **API Route**: `POST /api/reconciliation/run`
  - Request: `{ "seed": 42, "batchName": "Benchmark Run 42" }`
  - Response (`ReconciliationRunSummaryResponse`):
    - `runId`: string
    - `runNumber`: string
    - `status`: `COMPLETED` | `FAILED`
    - `totalRecords`: number
    - `matchedCount`: number
    - `unresolvedCount`: number
    - `exceptionCount`: number
    - `resolutionRate`: number (0.0 to 1.0)
    - `durationMs`: number
    - `throughputRecordsPerSec`: number
    - `startedAt`: ISO date string
    - `completedAt`: ISO date string
    - `resultsSummary`: Array of top results
    - `exceptionsSummary`: Array of top exceptions
- **API Route**: `GET /api/reconciliation/run`
  - Lists recent reconciliation runs and details.

### Checklist

* [x] Implement application orchestration service in `features/reconciliation/service.ts`
* [x] Implement API response contract types in `features/reconciliation/types.ts`
* [x] Implement Next.js API route `POST /api/reconciliation/run` in `app/api/reconciliation/run/route.ts`
* [x] Implement Next.js API route `GET /api/reconciliation/run` in `app/api/reconciliation/run/route.ts`
* [x] Verify source records are ingested into PostgreSQL without mutation
* [x] Verify atomic transaction persistence of run, results, and exceptions
* [x] Verify run status lifecycle transition (`PENDING` → `PROCESSING` → `COMPLETED`)
* [x] Verify throughput and duration calculation
* [x] Execute the full 200-case benchmark through the API
* [x] Verify `npm run check` (typecheck + lint) and `npm run build` pass cleanly

---

## 7. OpenRouter AI resolver

The AI Ambiguity Resolver sits strictly downstream of deterministic reconciliation. It evaluates only records marked `UNRESOLVED` by rule-based reconciliation to determine if ambiguous candidate evidence can be safely resolved.

```text
Exact Deterministic Rules (Level 1)
        ↓
Normalized & Bounded Fuzzy Rules (Level 2)
        ↓
UNRESOLVED / Ambiguous Candidates Only
        ↓
AI Resolver Service (features/ai/resolver.ts)
        ↓
OpenRouter API (Verified model ID e.g. google/gemini-2.5-flash)
        ↓
Zod Validation & Application-Side Safety Gate (>= 0.80)
        ↓
MATCHED (AI-Assisted) / UNRESOLVED / REJECTED
```

---

### Architecture & Design Decisions

#### 1. Downstream Placement & Protection of Deterministic Baseline
- **Strict Invariants**:
  - Deterministic matches (`status === 'MATCHED'`) are **locked and protected**. AI is **NEVER** called for deterministic matches.
  - Hard financial mismatches (`AMOUNT_MISMATCH`) exceeding fee policy ($5.00) are **NEVER** sent to AI.
  - Zero-candidate invoices (`MISSING_RECORD`) and duplicate payments (`DUPLICATE`) are **NEVER** sent to AI.
- **Principle**: *AI may improve an unresolved decision, but it must NEVER degrade a decision established safely by deterministic logic.*

#### 2. OpenRouter Interface & Input Bounding (`features/ai/types.ts`)
- **Module Location**: `features/ai/` contains `types.ts`, `openrouter.ts`, `resolver.ts`, `index.ts`.
- **Bounded Input Contract**:
  - Maximum 3 top candidate pairs per unresolved invoice (`top3Candidates`).
  - Input evidence payload sent to model:
    - `invoice`: `{ number, vendor, amountCents, currency, issueDate }`
    - `candidates`: Array of `{ bankTxId, ref, description, amountCents, currency, transactionDate, vendorSimilarity, dateDeltaDays, amountDeltaCents }`
    - `reconciliationContext`: Reason code explaining why deterministic rules marked the record `UNRESOLVED` (e.g. `INSUFFICIENT_EVIDENCE`).
  - **Zero Leakage**: `groundTruthId`, benchmark labels, and expected outputs are 100% excluded from model prompts.

#### 3. Model Selection, Timeout & Provider Failovers
- **Model Verification**: OpenRouter model IDs verified against active OpenRouter API catalog (e.g. `google/gemini-2.5-flash`, `google/gemini-flash-1.5`, `openai/gpt-4o-mini`).
- **Auditability**: The exact actual model ID returned by OpenRouter is recorded in `aiMetadataJson` for every call to ensure complete reproducibility.
- **Timeout**: `8000ms` (8s) per request via `AbortSignal.timeout(8000)`.
- **Retries**: Max 1 retry with 500ms backoff.
- **Provider Failure Handling**: On network failure, HTTP 5xx, HTTP 429, or timeout, system catches error, records `AI_UNAVAILABLE` Exception, and safely preserves the original deterministic `UNRESOLVED` decision.

#### 4. Clean Structured JSON Output & Zod Validation
- Model returns only evidence analysis, decision recommendation, candidate selection, confidence score, and reasoning. Matching method and rule strength classifications belong exclusively to application policy.
- **Zod Response Schema**:
  ```ts
  export const aiResolverResponseSchema = z.object({
    decision: z.enum(['MATCH', 'REJECT', 'UNRESOLVED']),
    selectedBankTxId: z.string().nullable(),
    confidenceScore: z.number().min(0).max(1),
    reasoning: z.string().min(10).max(500),
    keyEvidence: z.array(z.string()),
  });
  ```
- **Invalid Response Handling**: If model output fails Zod parsing (malformed JSON or invalid schema), system catches error, records `AI_INVALID_RESPONSE` Exception, and safely preserves the original deterministic `UNRESOLVED` decision.

#### 5. Application-Side Safety & Promotion Gate
The application (NOT the model) enforces financial safety before promoting any candidate to `MATCHED`:
1. `selectedBankTxId` **MUST** exist within the supplied candidate set (`top3Candidates`).
2. Model `confidenceScore` **MUST** be $\ge 0.80$.
3. Settlement `amountDeltaCents` **MUST** be within allowed fee policy ($5.00).
4. Currency **MUST** match (`invoice.currency === bankTx.currency`).
5. Date delta **MUST** be within policy window (`[-5, +30]` days).
6. Duplicate and ambiguity safety rules **MUST** pass.
- If any safety check fails, decision remains `UNRESOLVED`.

#### 6. Persisted Audit Trail & Metrics
- Where AI evaluates a record, persist:
  - `method`: `'AI'`
  - `aiUsed`: `true`
  - `confidence`: `confidenceScore`
  - `aiMetadataJson`: `{ model: "google/gemini-2.5-flash", actualModelUsed, reasoning, keyEvidence, promptDurationMs }`
- `ReconciliationRun` tracks `aiCallCount` incrementing for every actual provider call made.

#### 7. Authoritative Benchmark Evaluation Rules
- Benchmark expected status (`MATCHED` | `MISMATCH` | `UNRESOLVED`) is authoritative.
- Decisions are evaluated purely by expected status and exception match; using `method: 'AI'` incurs **zero penalty** if the financial outcome is correct.

### Checklist

* [x] Verify current OpenRouter model IDs (`google/gemini-2.0-flash-001`, `meta-llama/llama-3.3-70b-instruct`, `openai/gpt-4o-mini`)
* [x] Finalize primary/fallback model policy with dynamic model detection and provider error handling
* [x] Implement AI resolver interface in `features/ai/types.ts`
* [x] Implement bounded candidate/evidence payload (0 ground truth leaked)
* [x] Implement OpenRouter adapter in `features/ai/openrouter.ts` (8s timeout, max 1 retry, failover fallback)
* [x] Implement structured response parsing & Zod validation in `features/ai/resolver.ts`
* [x] Implement provider error and Zod schema error handling (`AI_UNAVAILABLE` / `AI_INVALID_RESPONSE` exceptions)
* [x] Implement application-side safety/promotion gate (candidate set membership, amount tolerance, date policy, currency matching)
* [x] Ensure AI cannot override deterministic decisions or hard financial mismatches
* [x] Persist actual model used and AI decision metadata in `ReconciliationResult.aiMetadataJson` and increment `aiCallCount`
* [x] Verify benchmark ground truth remains 100% inaccessible to the AI path
* [x] Execute full 200-case benchmark with AI enabled and compare results against 92.5% baseline (verified 0 degradation of deterministic matches)

---

### Measured Benchmark Baseline vs Fixed AI-Assisted Metrics

| Metric | Deterministic Baseline (Feature 6) | Initial AI-Assisted (Pre-Fix) | Fixed AI-Assisted (Applied Fix) |
| :--- | :--- | :--- | :--- |
| **Total Cases Evaluated** | 200 | 200 | 200 (seed 42) |
| **Deterministic Matches (`MATCHED`)** | 120 (60.00%) | 120 (60.00%) | **120 (60.00%) (100% Invariant Preserved)** |
| **AI Provider Calls Made (`aiCallCount`)** | 0 | 44 | **26 (0 calls for AMBIGUOUS_MATCH_TIE)** |
| **Valid AI Responses Received** | 0 | 44 | **26** |
| **AI Matches Recommended** | 0 | 10 | **0** |
| **AI Rejections / Unresolved** | 0 | 34 | **26** |
| **Promoted Matches to DB** | 0 | 10 | **0** |
| **Correct AI Promotions (True+)** | 0 | 0 | **0** |
| **Incorrect AI Promotions (False+)** | 0 | 10 | **0 (100% Eliminated)** |
| **False Negatives (Measurable)** | 0 | 0 | **0** |
| **Ground Truth Accuracy (%)** | **92.50%** | **87.50%** | **92.50% (Restored 100% to Baseline)** |
| **Resolution Rate (%)** | **60.00%** | **65.00%** | **60.00% (100% Policy-Safe)** |

---

### Evaluation Findings, Applied Fix & Verified Results

#### 1. Root Cause Summary
- All 10 false positive promotions in initial Feature 7 testing originated from 10 benchmark cases (`inv_ambig_191` to `inv_ambig_200`) where two non-identical bank transactions tied in amount and date with high vendor similarity (`APEX GLOBAL 1 GROUP` at 84% vs `APEX GLOBAL 1 PARTNERS` at 82%).
- Ground truth explicitly defines these cases as `UNRESOLVED` (`AMBIGUOUS_MATCH`). The deterministic engine correctly flagged them as `AMBIGUOUS_MATCH_TIE` and returned `UNRESOLVED`.
- Downstream, the initial AI promotion gate allowed AI to pick Candidate B over Candidate A and promote it to `MATCHED` because `AMBIGUOUS_MATCH_TIE` was not explicitly excluded from AI execution.

#### 2. Applied Corrective Fix
- **Orchestration Layer Protection (`features/reconciliation/service.ts`)**: Added `d.reasonCode === 'AMBIGUOUS_MATCH_TIE'` to the list of protected deterministic decisions. If the deterministic engine produces `AMBIGUOUS_MATCH_TIE`, AI is **NEVER** called, preserving `UNRESOLVED` status and the `AMBIGUOUS_MATCH` exception.
- **Candidate Separation Safety Rule (`features/ai/resolver.ts`)**: Implemented Safety Check F in the AI resolver. When top competing candidates have vendor similarities within $\le 0.05$ of each other with identical amounts, AI is blocked from promoting the result to `MATCHED` and returns `UNRESOLVED`.

#### 3. Verified Metrics & Final Safety Policy
- **Ground-Truth Accuracy**: 100% restored to **92.50%** (185/200 correct).
- **False Positive Promotions**: Reduced from 10 to **0** (0 false positives!).
- **Deterministic Match Preservation**: All 120/120 deterministic matches remained 100% untouched.
- **Protected Ambiguity Invariant**: All 10/10 `AMBIGUOUS_MATCH` benchmark cases remained `UNRESOLVED` with zero AI calls made for protected ties.
- **Final Safety Policy Invariant**: AI may resolve genuine ambiguity where unique, safe evidence exists, but it must **NEVER** override a deterministic ambiguity safety decision or promote competing tied candidates.

---

# Slice 3: Dashboard & exception queue

## 8. Reconciliation dashboard & exception queue

Build the operator-facing interface once the reconciliation pipeline produces meaningful results.

The dashboard should immediately answer:

```text
How many records were processed?
How many matched?
How many remain unresolved?
How accurate was the system?
How fast did it run?
How often was AI needed?
What exceptions require attention?
```

Primary summary metrics:

```text
Records processed
Matched
Unresolved
Resolution rate
Accuracy
Processing time
Throughput
AI calls
AI-assisted matches
```

The UI must distinguish:

```text
MATCHED
MISMATCH
UNRESOLVED
```

and clearly identify whether a decision was:

```text
DETERMINISTIC
FUZZY
AI
```

A user should be able to inspect a result and see the evidence behind it.

### Exception queue

Each exception should show:

* affected record
* reason
* expected value where applicable
* observed value
* evidence considered
* resolution status
* whether human review is appropriate

The exception queue is first-class product output.

Do not bury unresolved cases at the bottom of the application.

### Checklist

* [ ] Decide dashboard information hierarchy
* [ ] Build summary metrics
* [ ] Build reconciliation result table
* [ ] Build result detail view
* [ ] Build exception queue
* [ ] Show decision method
* [ ] Show supporting evidence
* [ ] Add loading states
* [ ] Add empty states
* [ ] Add failure states
* [ ] Verify keyboard and accessibility behavior

---

# Slice 4: Benchmarking, metrics & audit trail

## 9. Benchmarking, metrics & audit trail

This feature turns the demo into measurable evidence.

Every benchmark run should compare system predictions with known ground truth.

At minimum report:

```text
Total records
Correct decisions
Incorrect decisions
Matched
Unresolved
Resolution rate
Accuracy
Processing duration
Throughput
AI calls
AI-assisted resolutions
AI escalations
```

Where the classification makes it meaningful, calculate:

* precision
* recall
* F1

Do not report metrics that do not correspond to a clearly defined target.

### Example

```text
Records processed:      200
Correct decisions:      184
Incorrect decisions:     16

Accuracy:               92.0%

Automatically resolved: 169
AI-assisted:              21
Unresolved:               31

Resolution rate:         84.5%

Processing time:         4.2s
Throughput:              47.6 records/sec
```

These numbers are examples only. Never hard-code them into the product.

### Audit trail

Each decision should be traceable to:

```text
Reconciliation run
        ↓
Source records
        ↓
Matching method
        ↓
Decision
        ↓
Evidence / explanation
```

Historical runs should remain reproducible as observations.

A later reconciliation run may disagree with an earlier run; that does not mean the earlier run should be silently rewritten.

### Checklist

* [ ] Define metric formulas
* [ ] Implement benchmark scoring
* [ ] Show benchmark results
* [ ] Persist run-level metrics
* [ ] Persist decision-level evidence
* [ ] Add audit information
* [ ] Verify metrics independently against ground truth

---

# Slice 5: Failure recovery & hardening

## 10. Failure recovery & hardening

This project is being judged partly on what happens when things go wrong.

Design explicit recovery paths for:

### OpenRouter unavailable

```text
Request
  ↓
Bounded retry
  ↓
Still unavailable
  ↓
AI_UNAVAILABLE
  ↓
Exception queue
```

The underlying financial record must remain present.

It must not be falsely marked as resolved.

### Invalid AI response

```text
Model output
    ↓
Zod validation
    ↓
Invalid
    ↓
Retry where appropriate
    ↓
Otherwise exception
```

### Timeout

Do not leave a reconciliation run in an unexplained state.

Record the failure and move the affected decision to a known state.

### Duplicate records

Detect duplicate candidates explicitly.

Do not match two payments to one invoice simply because amount and vendor happen to agree.

### Insufficient evidence

The correct output is:

```text
UNRESOLVED
```

not a forced match.

### User-facing errors

Never expose:

* stack traces
* raw provider errors
* internal exception details
* database errors

Translate failures into clear human-readable states.

### Checklist

* [ ] Handle provider timeout
* [ ] Handle provider rate limit
* [ ] Handle provider outage
* [ ] Handle malformed AI output
* [ ] Handle duplicate candidates
* [ ] Handle missing records
* [ ] Handle ambiguous matches
* [ ] Add safe user-facing error states
* [ ] Verify that failures become auditable exceptions
* [ ] Re-run the complete benchmark after hardening

---

# Design & look

The product should feel like a finance operations tool, not a generic AI chatbot.

The visual hierarchy should prioritize:

```text
Numbers
Status
Exceptions
Evidence
Actions
```

The interface should make uncertainty obvious.

Do not use decorative AI imagery or excessive gradients to communicate "AI."

Use color semantically:

* normal state: neutral
* successful reconciliation: success color
* exception/error: error color
* interactive elements: accent color

Avoid using the same color to mean multiple unrelated things.

The dashboard should work when viewed quickly by a finance operator who is primarily looking for exceptions.

### Design checklist

* [ ] Decide visual direction
* [ ] Define spacing and typography
* [ ] Define status treatment
* [ ] Define exception treatment
* [ ] Build dashboard shell
* [ ] Verify contrast
* [ ] Verify keyboard operation
* [ ] Verify focus visibility

---

# Product principles

## 1. Batch over cherry-picking

The system must be judged on the complete benchmark.

Never showcase one carefully selected successful match as evidence that the system works.

## 2. Correctness over AI usage

Using fewer AI calls is a success when deterministic logic is the better solution.

## 3. Exceptions over hallucinations

An unresolved financial record is preferable to an incorrect automatic match.

## 4. Evidence over claims

Every important result should have inspectable evidence.

## 5. Repeatability over demos

The same benchmark should be runnable again and produce a result that can be compared meaningfully.

## 6. Narrow scope over feature sprawl

The project closes one reconciliation loop.

Do not turn it into an ERP, accounting suite, forecasting platform, or general finance assistant before the core loop is trustworthy.

---

# Definition of done

The project is considered ready for judging when all of the following are true:

* A benchmark containing 50+ synthetic records can be processed end-to-end.
* The records have known ground truth.
* Deterministic matching handles cases that do not require AI.
* AI is used only for ambiguous cases.
* AI output is structured and validated.
* Reconciliation results are persisted with Prisma/Postgres.
* Every decision can be inspected.
* Unresolved cases appear in an explicit exception queue.
* Accuracy and throughput are measured from the benchmark.
* Failures do not silently become successful matches.
* The application handles provider failures gracefully.
* The UI makes the important financial state obvious.
* The application runs successfully in production build mode.
* Typecheck passes.
* Lint passes.
* The complete real workflow has been exercised manually.

---

# Not doing right now

Kept here so scope remains honest.

* Full accounting or ERP functionality.
* Autonomous money movement.
* Autonomous journal posting.
* Tax filing or tax compliance automation.
* Full cash forecasting.
* Settlement Q&A as a separate product.
* Multi-agent orchestration without a concrete need.
* Automatic approval of financially significant actions.
* Real customer financial data.
* Complex user/organization permissions unless required by the deployment environment.
* Fancy model leaderboards.
* A generic "ask your finances anything" chatbot.
* Large-scale infrastructure before the benchmark demonstrates a need for it.

Potential future additions can be reconsidered only after the reconciliation loop is demonstrably reliable.

---

# Open decisions

These remain intentionally open until their relevant implementation step.

* Exact PostgreSQL schema details.
* Candidate-generation algorithm and matching tolerances.
* Fuzzy matching algorithm.
* OpenRouter model selection.
* AI confidence thresholds.
* Retry policy and timeout values.
* Benchmark distribution after the first meaningful results.
* Final dashboard visual direction.
* Whether reconciliation is synchronous or moves to a background job once batch size requires it.

When an open decision is made, move it into the relevant feature's permanent decision notes and remove it from this section if it is no longer open.
