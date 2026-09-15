# LedgerGuard: System Architecture Design

LedgerGuard is an institutional finance-ops workstation engineered for multi-source reconciliation across invoices, bank transactions, and general ledger journal entries. It implements a deterministic-first engine with strictly bounded AI disambiguation and auditable human-in-the-loop exception triage.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph UI["Institutional Presentation Tier (Next.js 15 App Router)"]
        DASH["Overview Dashboard (/)"]
        RUNS["Run Inspector (/reconciliation/[id])"]
        QUEUE["Exception Triage Queue (/exceptions)"]
        BENCH["Benchmark Control Matrix (/benchmark)"]
    end

    subgraph API["API & Orchestration Layer (Route Handlers)"]
        R_RUN["/api/reconciliation/run"]
        R_EXC["/api/reconciliation/exceptions"]
        R_BENCH["/api/reconciliation/benchmark"]
        R_OVER["/api/reconciliation/overview"]
    end

    subgraph SERVICE["Domain Core (features/reconciliation)"]
        SVC["ReconciliationService (Orchestrator)"]
        NORM["Normalization Layer (Vendor, Tokens, UTC)"]
        CAND["Multi-Index Candidate Generator"]
    end

    subgraph ENGINE["Tiered Matching Engine"]
        L1["Level 1: Exact Deterministic Rules"]
        L2["Level 2: Bounded Fuzzy & Fee Rules"]
        SAFETY["Safety Invariant Checks (Ties, Limits)"]
    end

    subgraph AI["Bounded AI Ambiguity Resolver (features/ai)"]
        PAYLOAD["Sanitized Context Builder (Ground-Truth Stripped)"]
        OPENROUTER["OpenRouter Gateway (Gemini 2.0 Flash / Qwen Fallback)"]
        VALID["Zod Schema Validator (Structured Output)"]
        GATE["Application-Side Safety Gate (Confidence, Delta, Separation)"]
    end

    subgraph DATA["Persistence Tier (PostgreSQL + Prisma ORM)"]
        DB_RUN["ReconciliationRun"]
        DB_RES["ReconciliationResult"]
        DB_EXC["Exception (Human Triage)"]
        DB_AUD["AuditLog (Append-Only)"]
        DB_SRC["Source Tables (Invoice, BankTx, Ledger)"]
    end

    subgraph BENCHMARK["Evaluation Tier (features/benchmark)"]
        SYNTH["Synthetic Generator (Seed 42)"]
        ISOLATION{{"Ground-Truth Air Gap Boundary"}}
        SCORER["Benchmark Scorer (Accuracy, Precision, Recall, F1)"]
    end

    UI --> API
    API --> SERVICE
    SERVICE --> NORM
    NORM --> CAND
    CAND --> ENGINE
    L1 -->|Unmatched| L2
    L2 -->|Ambiguous Only| SAFETY
    SAFETY -->|Eligible| AI
    PAYLOAD --> OPENROUTER
    OPENROUTER --> VALID
    VALID --> GATE
    GATE -->|Matched| DB_RES
    GATE -->|Rejected / Tie| DB_EXC

    ENGINE --> DB_RES
    ENGINE --> DB_EXC
    SERVICE --> DB_RUN
    SERVICE --> DB_AUD

    SYNTH -.->|Isolated Metadata| ISOLATION
    ISOLATION -.-> SCORER
    DB_RES -.-> SCORER
```

---

## 2. Detailed Reconciliation Pipeline Flow

```mermaid
flowchart TD
    START(["Start Reconciliation Run"]) --> INGEST["Ingest Source Records (Invoices, Bank Tx, Ledger)"]
    INGEST --> NORMALIZE["Normalize Vendors, References & UTC Timestamps"]
    NORMALIZE --> CANDIDATES["Generate Multi-Index Candidate Pairs"]

    CANDIDATES --> L1_CHECK{"Level 1: Exact Match?"}
    L1_CHECK -- "Exact Ref + Amount + Date" --> L1_MATCH["MATCHED: DETERMINISTIC"]
    
    L1_CHECK -- "No Exact Match" --> L2_CHECK{"Level 2: Fuzzy Rule Match?"}
    L2_CHECK -- "Vendor >= 0.85 + Date Window + Fee <= $5.00" --> L2_MATCH["MATCHED: FUZZY"]

    L2_CHECK -- "Unmatched" --> SAFETY_CHECK{"Safety Invariant Check"}
    SAFETY_CHECK -- "Hard Delta > $5.00 or Duplicate or Missing" --> EXCEPTION_HARD["UNRESOLVED: Flag Exception"]
    SAFETY_CHECK -- "Candidate Tie (Similarity diff < 5%)" --> EXCEPTION_TIE["UNRESOLVED: AMBIGUOUS_MATCH_TIE"]

    SAFETY_CHECK -- "Genuine Memo Ambiguity" --> AI_BUILD["Sanitize Prompt (Max 3 Candidates, No GT)"]
    AI_BUILD --> AI_CALL["Invoke OpenRouter (8s Timeout, Auto Failover)"]
    
    AI_CALL --> AI_RESP{"Provider Success & Valid JSON?"}
    AI_RESP -- "Timeout / Error / Invalid Schema" --> AI_FALLBACK["UNRESOLVED: AI_UNAVAILABLE / INVALID"]
    
    AI_RESP -- "Valid Zod Output" --> GATE_CHECK{"Application Financial Safety Gate"}
    GATE_CHECK -- "Confidence >= 0.80, Delta <= $5, Separation > 5%" --> AI_MATCH["MATCHED: AI_RESOLVED"]
    GATE_CHECK -- "Failed Gate Rules" --> AI_HOLD["UNRESOLVED: Safety Gate Rejection"]

    L1_MATCH --> PERSIST["Persist Run, Results, and Audit Trail to DB"]
    L2_MATCH --> PERSIST
    AI_MATCH --> PERSIST
    EXCEPTION_HARD --> PERSIST
    EXCEPTION_TIE --> PERSIST
    AI_FALLBACK --> PERSIST
    AI_HOLD --> PERSIST

    PERSIST --> COMPLETE(["Run Completed (Triaged to Human Queue)"])
```

---

## 3. Ground Truth Isolation & Benchmark Evaluation Boundary

To prevent synthetic data leakage and ensure scientific evaluation integrity, LedgerGuard maintains a strict architectural air-gap between ground truth metadata and the matching engine:

```mermaid
flowchart LR
    subgraph BENCHMARK_GEN["Synthetic Batch Generator"]
        GEN["Generator (Faker Seed 42)"]
        GT_MAP[("Hidden Ground Truth Map\n(GT-PAIR-001 -> BankTx-9901)")]
        SRC_DATA["Sanitized Sources\n(Invoices, Bank Transactions, Ledger)"]
    end

    subgraph ENGINE_TIER["Runtime Reconciliation Engine"]
        MATCH_LOGIC["Matching Engine\n(Deterministic, Fuzzy, AI Resolver)"]
        OUTPUT_DECISIONS[("Reconciliation Decisions\n(Matched Pairs, Unresolved)")]
    end

    subgraph EVAL_TIER["Benchmark Scorer"]
        SCORING["Confusion Matrix Evaluator"]
        METRICS["Benchmark Metric Artifact\n(Accuracy: 92.5%, Precision: 88.89%, Recall: 100%, F1: 94.12%)"]
    end

    GEN --> GT_MAP
    GEN --> SRC_DATA

    SRC_DATA -->|Raw Financial Fields Only| MATCH_LOGIC
    GT_MAP -.->|AIR GAP: NEVER PASSED TO ENGINE| MATCH_LOGIC

    MATCH_LOGIC --> OUTPUT_DECISIONS

    OUTPUT_DECISIONS --> SCORING
    GT_MAP --> SCORING
    SCORING --> METRICS
```

---

## 4. Key Architectural Pillars

### 1. Deterministic-First Philosophy
- **Zero AI on clear paths**: Exact reference, amount, and date matches are resolved deterministically in microseconds with zero LLM operational overhead or latency.
- **Immutable outcomes**: Once a record matches deterministically, downstream heuristics and LLMs are never permitted to alter or re-evaluate the decision.

### 2. Guarded AI Disambiguation
- **Isolation to genuine ambiguity**: AI is invoked only when candidate options are available but heuristics cannot distinguish truncated memos or naming variations.
- **Strict Hard Exclusions**: Hard amount mismatches ($> \$5.00$), missing records, and lookalike ties are held as `UNRESOLVED` without burning LLM tokens.
- **Application-Side Safety Gate**: Even if an LLM asserts 100% confidence, the application verifies:
  1. Selected ID belongs to the supplied candidate set.
  2. Currency identity is preserved.
  3. Fee delta $\le \$5.00$.
  4. Date window within $[-5, +30]$ days.
  5. Top-candidate separation margin $> 5\%$.

### 3. Human-in-the-Loop Exception Triage
- Every record that fails matching or gate checks is categorized into an explicit financial exception category (`AMOUNT_MISMATCH`, `DATE_MISMATCH`, `AMBIGUOUS_MATCH`, `DUPLICATE`, `MISSING_RECORD`, `INSUFFICIENT_EVIDENCE`).
- Human controllers can inspect source evidence side-by-side and execute signed override decisions with append-only audit trail logging.
