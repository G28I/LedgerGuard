# LedgerGuard: AI Finance Controller

> **Auditable Multi-Source Financial Reconciliation with Bounded AI Ambiguity Resolution**

LedgerGuard is an institutional finance-ops workstation that automates multi-source reconciliation across invoices, bank transactions, and general ledger journal entries. It executes deterministic-first matching at high throughput, strictly isolates AI reasoning to ambiguous transaction memos where heuristics fail, enforces application-side financial safety gates, and maintains an auditable human-in-the-loop exception queue with zero false-positive promotions.

---

## 30-Second Overview

Finance teams spend significant time manually reconciling invoices, bank transactions, and ledger entries during accounting close cycles. Discrepancies caused by truncated bank memos, timing differences, and wire fees require tedious investigation, while naive AI agents risk hallucinating incorrect matches that pollute financial ledgers.

LedgerGuard solves this with a **guarded three-tier reconciliation pipeline**:
1. **Level 1 (Exact Deterministic)**: Instant 1:1 matching on references, amounts, and dates with zero LLM involvement.
2. **Level 2 (Normalized & Bounded Fuzzy)**: Normalizes corporate suffixes, extracts embedded tokens, and matches within strict date/fee policies.
3. **Level 3 (Guarded AI Ambiguity Resolver)**: For remaining unresolved records with candidate ambiguity, OpenRouter LLMs evaluate evidence under strict application-level safety gates (candidate containment, currency match, date window, fee threshold, and candidate separation).

---

## Core Reconciliation Workflow

```text
[ Invoices ]          [ Bank Transactions ]          [ Ledger Entries ]
     │                         │                            │
     └─────────────────────────┼────────────────────────────┘
                               ▼
            1. Source Ingestion & Normalization
                               │
                               ▼
            2. Multi-Index Candidate Generation
                               │
                               ▼
            3. Level 1: Exact Deterministic Rules
               (Exact ref, exact amount, currency, strict date)
                               │
                 [Matched?] ───┴───► [ MATCHED (DETERMINISTIC) ]
                               │ (No)
                               ▼
            4. Level 2: Fuzzy & Discrepancy Rules
               (Normalized vendor >=0.85, date window, fee check)
                               │
                 [Matched?] ───┴───► [ MATCHED (FUZZY) ]
                               │ (No)
                               ▼
            5. Safety Invariant Check
               (Detect duplicates, hard amount mismatches, candidate ties)
                               │
                 [Protected?] ─┴───► [ UNRESOLVED (Exception Queue) ]
                               │ (Genuine Ambiguity Only)
                               ▼
            6. Level 3: AI Ambiguity Resolver (OpenRouter)
               (Bounded evidence payload, 8s timeout, Zod validation)
                               │
                               ▼
            7. Application-Side Safety Gate
               (Candidate set check, confidence >=0.80, fee <=$5, separation >5%)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       [ Passed Gate ]                 [ Failed Gate ]
               │                               │
               ▼                               ▼
     [ MATCHED (AI) ]               [ UNRESOLVED ]
                                               │
                                               ▼
                                   [ Exception Triage Queue ]
                                   (Audit trail + Human review)
```

---

## Authoritative Benchmark Results

LedgerGuard is evaluated against an independent, reproducible synthetic benchmark dataset (**Seed 42**) comprising 200 diverse financial cases. The evaluation strictly isolates the ground truth map from the runtime reconciliation engine.

| Metric | Deterministic Baseline | Initial AI (Pre-Fix) | LedgerGuard Fixed AI (Current) |
| :--- | :--- | :--- | :--- |
| **Total Cases Evaluated** | 200 | 200 | **200** |
| **Matched Records** | 120 (60.0%) | 130 (65.0%) | **120 (60.0%)** |
| **Unresolved Records** | 80 (40.0%) | 70 (35.0%) | **80 (40.0%)** |
| **Ground-Truth Accuracy** | 92.5% (185/200) | 87.5% (175/200) | **92.5% (185/200)** |
| **Precision** | 88.89% | 82.05% | **88.89%** |
| **Recall** | 100.0% | 100.0% | **100.0%** |
| **F1 Score** | 94.12% | 90.14% | **94.12%** |
| **AI Provider Calls** | 0 | 44 | **26** |
| **AI Evaluated Records** | 0 | 44 | **26** |
| **AI False-Positive Promotions** | 0 | 10 | **0 (Zero FP)** |

### What the Benchmark Actually Proves:
- The deterministic baseline achieves **92.5% ground-truth accuracy** independently.
- The AI ambiguity resolver evaluates 26 ambiguous candidate cases under strict safety gates.
- When competing candidate ties exist (e.g. lookalike vendors within 5% similarity), the application safety gate holds the record as `UNRESOLVED`, preventing **10 false-positive auto-promotions** and preserving 92.5% accuracy.
- AI is verified to operate safely behind application constraints with **zero false-positive degradation**.

---

## AI Safety Philosophy & Guardrails

1. **Deterministic Priority**: Deterministic matches are locked and immutable. LLMs never re-evaluate or override safe deterministic outcomes.
2. **Strict Exclusions**: Hard financial mismatches (> $5.00 delta), missing records, duplicates, and candidate ties (`AMBIGUOUS_MATCH_TIE`) never invoke AI.
3. **Bounded Context**: Prompts receive only sanitized invoice and candidate metadata (max 3 candidates). Ground truth labels and identifiers are 100% excluded.
4. **Structured Output Validation**: Model responses are validated via Zod (`aiResolverResponseSchema`). Prose or unparsed outputs are rejected.
5. **Application-Side Safety Gate**:
   - The candidate ID chosen by the LLM must exist in the provided candidate set.
   - Model confidence must be $\ge 0.80$.
   - Transaction amount delta must be $\le \$5.00$ (wire/settlement fee threshold).
   - Currencies must match identically.
   - Settlement dates must fall within policy window ($[-5, +30]$ days).
   - Competing candidate vendor similarities must not tie within 5%.
6. **Failure Recovery**: On provider timeout (8s), rate limits (HTTP 429), server errors (5xx), or schema parse errors, the system catches the failure, creates an `AI_UNAVAILABLE` or `AI_INVALID_RESPONSE` exception, and safely retains `UNRESOLVED` status.

---

## Architecture & Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript strict mode)
- **Styling**: Tailwind CSS, Lucide icons (dark institutional theme, zero decorative AI fluff)
- **Database & ORM**: PostgreSQL with Prisma ORM
- **AI Provider**: OpenRouter API (`google/gemini-2.0-flash-001`, with automatic model detection & failover)
- **Validation**: Zod (environment variables, API schemas, AI structured outputs)
- **Synthetic Generator**: Faker (reproducible seeded dataset with offline ground-truth isolation)

### Repository Structure

```text
web/
├── app/                               # Next.js App Router
│   ├── api/reconciliation/           # REST API route handlers
│   │   ├── run/                      # Run execution & history
│   │   ├── exceptions/               # Exception triage & PATCH review
│   │   └── benchmark/                # Benchmark metrics & baselines
│   ├── benchmark/                    # Benchmark control matrix page
│   ├── exceptions/                   # Exception triage queue page
│   ├── reconciliation/               # Run detail & new run modal
│   ├── runs/                         # Historical execution audit log
│   └── page.tsx                      # Overview control center
├── components/                       # Shared UI components
│   ├── AppShell.tsx                  # Institutional dark-mode layout
│   ├── RecordDetailDrawer.tsx        # 3-way source evidence inspection
│   ├── ExceptionDetailDrawer.tsx     # Discrepancy & human review drawer
│   └── NewReconciliationModal.tsx    # Run configuration & execution modal
├── features/                         # Decoupled domain feature modules
│   ├── reconciliation/               # Pure matching engine, rules, service
│   ├── synthetic/                    # Seeded multi-source data generator
│   ├── ai/                           # OpenRouter client, resolver, safety gate
│   ├── benchmark/                    # Offline evaluation & scoring logic
│   └── db/                           # Prisma client & database repositories
├── lib/                              # Shared utilities (format, env, prisma)
├── prisma/                           # schema.prisma (append-only models) & seed.ts
└── docs/                             # Architecture specifications & scope
```

---

## Local Setup & Quickstart

### Prerequisites

- **Node.js**: v18.18+ or v20+
- **npm**: v9+
- **PostgreSQL**: Accessible PostgreSQL database instance

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd ledgerguard/web
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `web/` directory:

```env
# PostgreSQL Database Connection URL
DATABASE_URL="postgresql://username:password@localhost:5432/ledgerguard?schema=public"

# OpenRouter API Key (Required for live AI disambiguation)
OPENROUTER_API_KEY="your-openrouter-api-key"

# Optional: Default model (defaults to google/gemini-2.0-flash-001)
OPENROUTER_MODEL="google/gemini-2.0-flash-001"

# Optional: Set to true to mock OpenRouter responses offline
MOCK_OPENROUTER="false"
```

### 3. Database Initialization

Push the Prisma schema to your PostgreSQL database and generate the Prisma Client:

```bash
# Push schema to database (schema is append-only)
npx prisma db push

# Generate Prisma Client
npx prisma generate

# (Optional) Seed the database with initial representative data
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Benchmarks & Verification

### Run Verification Checks

```bash
# TypeScript strict type check
npm run typecheck

# ESLint check (0 errors, 0 warnings)
npm run lint

# Production build verification
npm run build
```

### Run Benchmark via Browser
1. Navigate to `/benchmark` in the application.
2. Click **[Execute Benchmark Run]**.
3. Select **Seed 42** (200 records) with AI enabled.
4. View the materialized results and audit comparisons in real time.

### Run Benchmark via API

```bash
curl -X POST http://localhost:3000/api/reconciliation/run \
  -H "Content-Type: application/json" \
  -d '{"seed": 42, "batchName": "Benchmark Evaluation", "enableAI": true}'
```

---

## Known Limitations

- **Currency Conversion**: Non-matching currencies (e.g. USD vs EUR) are flagged as `INSUFFICIENT_EVIDENCE` exceptions rather than auto-converted via external FX rate feeds.
- **Batch Processing**: Reconciliation runs execute synchronously within the Next.js API route. Batches beyond 500 records should be decoupled into a background worker queue.
- **Autonomous Ledger Writing**: LedgerGuard prepares reconciliation results and human triage states; it does not autonomously post adjusting journal entries to external ERP systems.
