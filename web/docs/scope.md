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
| 4  | Reconciliation domain model & rules        | Foundation | not started |
| 5  | Synthetic benchmark generator              | Foundation | not started |
| 6  | Thin end-to-end reconciliation slice       | Slice 1    | not started |
| 7  | AI ambiguity resolver                      | Slice 2    | not started |
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

## 4. Reconciliation domain model & rules

The reconciliation engine is the core of the product.

It should not live inside a React component or depend directly on OpenRouter.

The engine should take normalized source records and produce explicit decisions.

The decision hierarchy is:

```text
Exact deterministic match
        ↓
Normalized / fuzzy matching
        ↓
AI reasoning for ambiguity
        ↓
Unresolved exception
```

The simplest reliable method always wins.

### Deterministic matching

Do not use AI for:

* exact reference comparison
* exact amount comparison
* currency comparison
* date tolerance checks
* arithmetic
* deterministic duplicate checks

Example:

```text
Invoice reference = bank reference
AND
Amount = amount
AND
Currency = currency
```

→ `MATCHED`

### Fuzzy matching

Normalize fields such as:

* vendor names
* references
* descriptions

Examples:

```text
"Acme Corporation Limited"
"ACME CORP LTD."
```

can become comparable representations before fuzzy scoring.

Fuzzy matching must remain explainable and bounded.

### Ambiguous matching

If deterministic logic finds multiple plausible candidates or insufficient evidence, produce an AI candidate-resolution request.

The AI should never receive an unconstrained instruction to "do the reconciliation."

It should receive the relevant records and a narrow decision:

```text
MATCH
REJECT
UNRESOLVED
```

along with a concise reason and model-produced confidence signal.

### Checklist

* [ ] Define normalized financial record types
* [ ] Define deterministic matching rules
* [ ] Define mismatch rules
* [ ] Define candidate generation
* [ ] Define fuzzy matching behavior
* [ ] Implement reconciliation as pure domain logic
* [ ] Verify decisions against representative cases

---

# Slice 1: Thin working reconciliation loop

## 5. Synthetic benchmark generator

The system must have a reproducible synthetic dataset with known ground truth.

The minimum requirement is 50+ records, but the actual benchmark should be substantially larger so throughput and error behavior mean something.

Aim for roughly 200 records for the primary demonstration unless implementation or runtime gives us a concrete reason to choose another size.

The generator should produce both straightforward and difficult cases.

Example distribution:

| Case type                | Approx. share |
| ------------------------ | ------------: |
| Exact match              |        50–60% |
| Name/reference variation |        10–20% |
| Amount mismatch          |         5–10% |
| Date mismatch            |         5–10% |
| Missing record           |            5% |
| Duplicate                |          3–5% |
| Ambiguous                |          2–5% |

These are starting targets, not immutable numbers. Adjust them if benchmark results suggest a more useful distribution and document the change.

Every generated case must retain its expected outcome so the system can be scored independently.

The benchmark should be seeded so the same dataset can be regenerated when useful.

### Checklist

* [ ] Define the benchmark record model
* [ ] Define ground-truth outcomes
* [ ] Implement synthetic data generation
* [ ] Add deliberate edge cases
* [ ] Add reproducible seeding
* [ ] Generate the first 50+ record dataset
* [ ] Generate the primary benchmark dataset
* [ ] Verify generated ground truth independently

---

## 6. Thin end-to-end reconciliation slice

Before adding AI, dashboards, or complex automation, prove that the whole reconciliation loop works.

The first slice should:

```text
Load synthetic records
        ↓
Normalize them
        ↓
Run deterministic reconciliation
        ↓
Persist results
        ↓
Produce a basic result summary
```

The goal is not completeness.

The goal is proving that:

* the data model works
* reconciliation logic works
* source records remain intact
* results are persisted
* exceptions can be represented
* a complete batch can be processed

Do not optimize the UI at this stage.

### Checklist

* [ ] Load benchmark data
* [ ] Normalize records
* [ ] Run reconciliation
* [ ] Persist the reconciliation run
* [ ] Persist individual results
* [ ] Persist exceptions
* [ ] Produce a basic summary
* [ ] Process the full benchmark successfully

---

# Slice 2: AI ambiguity resolver

## 7. OpenRouter AI resolver

AI enters the system only after deterministic reconciliation is working.

The AI resolver exists to interpret genuinely ambiguous evidence, not to replace the rule engine.

OpenRouter calls should be isolated behind a small interface.

The input should contain only the relevant evidence needed for that decision.

The output must be structured and validated.

Example conceptual output:

```json
{
  "decision": "MATCH",
  "confidence": 0.92,
  "reason": "The candidate matches the vendor identity, amount, and transaction timing."
}
```

The application must reject responses that do not conform to the expected schema.

Model confidence is a decision signal, not a guaranteed statistical probability.

Thresholds should be tuned against the benchmark and documented.

### AI decision policy

The initial policy may use a structure such as:

```text
High-confidence AI match
        ↓
Auto-resolve

Moderate confidence
        ↓
Review / unresolved

Low confidence
        ↓
Unresolved
```

Exact thresholds remain open until benchmark data exists.

Do not invent a threshold and treat it as scientifically correct.

### AI audit information

Where AI participates, persist:

* model/provider
* AI decision
* confidence
* reason
* timestamp
* relevant request/response metadata needed for auditability

Never store secrets.

### Checklist

* [ ] Decide OpenRouter request strategy
* [ ] Decide structured output shape
* [ ] Implement AI resolver interface
* [ ] Implement OpenRouter adapter
* [ ] Validate responses with Zod
* [ ] Handle invalid model output
* [ ] Add AI-assisted reconciliation
* [ ] Compare AI decisions with benchmark truth
* [ ] Tune and document confidence policy

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
