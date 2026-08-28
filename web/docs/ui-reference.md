# AI Finance Controller — Agent Brief

## Product

We are building **AI Finance Controller**, an AI-assisted financial reconciliation system.

The product closes one finance-ops loop:

> **Ingest financial records → reconcile them across sources → resolve what is safe to resolve → surface what cannot be resolved → report measurable results.**

The first and only core workflow is **multi-source reconciliation** across:

* Invoices
* Ledger entries
* Bank transactions

Use synthetic data with known ground truth so the system can be evaluated objectively across a meaningful batch, not demonstrated using cherry-picked examples.

The product must report:

* records processed
* matched records
* unresolved records
* resolution rate
* accuracy
* throughput
* processing time
* AI invocation count
* AI-assisted resolutions
* exception count

The product must maintain an honest exception list.

An unresolved case is a valid result. Never force a match just to increase the reported success rate.

---

## Core product philosophy

This is a **finance operations tool**, not a generic AI chatbot.

The primary user question is:

> **What reconciled, what did not, and what needs my attention?**

The visual and interaction hierarchy should therefore be:

**Run → Results → Exceptions → Evidence → Decision**

AI should be visible but secondary to the financial evidence.

---

## AI boundary

Do not send every financial record to the LLM.

Use the simplest reliable mechanism for every decision.

### Deterministic logic

Use normal application logic for:

* exact reference matching
* exact amount comparison
* currency comparison
* date tolerance
* arithmetic
* deterministic duplicate detection
* metrics
* benchmark scoring

### Fuzzy/normalized logic

Use normalization and bounded similarity for things like:

* vendor name variations
* reference formatting differences
* transaction descriptions

### AI

Use OpenRouter only when the evidence is genuinely ambiguous.

The AI should resolve a narrow question such as:

```text
MATCH
REJECT
UNRESOLVED
```

with:

```text
decision
confidence
reason
```

Validate all AI output using Zod.

Never let raw model prose determine application state.

Never treat model confidence as mathematically calibrated probability.

The application owns the final decision policy.

A result must record whether AI was used.

For example:

```text
Decision: MATCHED
Method: DETERMINISTIC
AI used: NO
Reason: Exact reference, amount and currency matched.
```

Choosing not to use AI is intentional product behavior and should be visible in the audit trail.

---

# UI direction

The UI should feel like a **credible finance operations control center**.

Do not build a generic "AI dashboard" with excessive gradients, glowing cards, robot graphics, or decorative AI elements.

Prioritize:

1. Financial numbers
2. Reconciliation status
3. Exceptions
4. Evidence
5. Actions
6. AI explanation

The product should optimize for **clarity and trust**, not visual novelty.

---

# Primary navigation

Use a simple application shell:

```text
AI Finance Controller

Overview
Reconciliation
Exceptions
Runs
```

A Benchmark area may be included if useful for demonstrating measured performance.

The exception count should be visible in navigation.

Avoid adding navigation items that do not support the core workflow.

---

# MVP screens

The initial UI should be designed around these screens:

## 1. Overview

Purpose:

> "What is the current reconciliation state?"

Show:

* records processed
* matched
* exceptions
* resolution rate
* latest run
* exception breakdown
* recent accuracy trend
* primary action: **Run Reconciliation**

Do not make charts the focus.

---

## 2. New Reconciliation

Let the user understand what will be processed before starting.

Show:

* dataset
* record counts
* available sources
* matching strategy
* selected OpenRouter model
* primary action: **Run Reconciliation**

Do not add unnecessary configuration.

---

## 3. Running Reconciliation

Show real progress based on actual processing state.

Example:

```text
Processing 128 / 200

Deterministic matches
Fuzzy matches
AI cases
Exceptions
```

Do not fake a long-running process with an artificial animation.

---

## 4. Reconciliation Results

This is the main work surface.

Header should show:

* run ID
* completion state
* records processed
* matched
* exceptions
* accuracy
* resolution rate
* throughput
* processing time

Then provide filters/tabs such as:

```text
All
Matched
AI-assisted
Exceptions
```

Main table should make the financial relationship obvious.

Useful columns:

* status
* invoice/reference
* vendor
* invoice amount
* matched transaction
* difference
* method
* confidence

Do not make every column visually equal.

Financial values and exception states should dominate.

---

## 5. Record Detail

Clicking a result should open a detail view, preferably a desktop side drawer.

Show:

### Decision

* MATCHED / MISMATCH / UNRESOLVED
* confidence where applicable
* method

### Source evidence

Invoice:

* vendor
* amount
* date
* reference

Bank:

* description
* amount
* date
* reference

Ledger where relevant.

### Explanation

Explain why the decision was reached.

### AI information

Only when AI was used:

* model
* decision
* confidence
* explanation

When AI was not used, explicitly show:

```text
AI used: No
```

with the deterministic reason.

The user should be able to reconstruct the decision from the evidence shown.

---

## 6. Exception Queue

This is a first-class product area.

The purpose is:

> **Show the records that require attention.**

Support filtering by:

* amount mismatch
* missing record
* duplicate
* ambiguous match
* AI unavailable
* other explicit system exceptions

Show enough information to triage quickly:

* reference
* exception type
* difference
* priority/status

Do not hide exceptions.

---

## 7. Exception Detail

Emphasize evidence over explanation.

Show:

```text
Expected
Observed
Difference
Evidence
Decision
Why unresolved
AI used or not used
```

Never invent a resolution.

A good unresolved state is better than a bad automatic match.

---

## 8. Runs

Show historical reconciliation runs.

Useful columns:

* run ID
* date
* records
* accuracy
* exceptions
* status

Selecting a run returns to its saved results.

Historical runs should remain auditable.

---

## 9. Benchmark

If included, show:

* benchmark dataset
* record count
* ground-truth availability
* accuracy
* precision/recall/F1 where meaningful
* resolution rate
* AI utilization
* processing duration
* throughput

This screen exists to prove that the product was evaluated on the whole batch rather than a single successful example.

---

# Interaction principle

The core pattern throughout the product is:

## Summary → Evidence → Decision

For a successful record:

```text
MATCHED
↓
Why?
↓
Invoice + Bank + Ledger evidence
↓
Method
↓
Audit information
```

For an exception:

```text
EXCEPTION
↓
Why?
↓
Expected vs observed
↓
Evidence
↓
Human review
```

Keep this pattern consistent across screens.

---

# Visual references

Use external reconciliation/fintech products as **reference material, not templates to clone**.

### Credrails

Primary product/architecture reference.

Borrow:

* reconciliation-oriented information hierarchy
* source comparison
* operational metrics
* exception visibility
* three-source reconciliation thinking

### Agicap

Primary reference for the matching workspace.

Borrow:

* dense financial tables
* source-to-source comparison
* filtering
* reconciliation actions
* transaction workflow

### Cointab

Primary reference for exceptions.

Borrow:

* matched/unmatched states
* reconciliation summary
* discrepancy visibility
* exception-heavy operational views

### Stripe

Primary reference for financial data tables.

Borrow:

* table density
* information hierarchy
* filters
* statuses
* transaction detail presentation

### Mercury

Reference for overall polish.

Borrow:

* calm financial-product feel
* restrained presentation
* clarity around balances and transactions

### Reconly

Reference for modern AI-fintech polish only.

Do not copy its AI-heavy visual treatment or allow AI branding to dominate the finance workflow.

---

# Reference weighting

When making UI decisions, use this approximate priority:

```text
Credrails   40%
Stripe      20%
Agicap      15%
Cointab     15%
Mercury      5%
Reconly      5%
```

The product should still have its own visual identity.

These references are useful because they solve parts of the same UX problem, not because we want to reproduce them.

---

# Layout direction

Desktop is the primary experience because reconciliation requires dense financial information.

Preferred desktop structure:

```text
┌────────────┬──────────────────────────────────────┐
│ Sidebar    │ Top bar                              │
│            ├──────────────────────────────────────┤
│ Overview   │                                      │
│ Recon      │ Main content                         │
│ Exceptions │                                      │
│ Runs       │                                      │
│            │                                      │
└────────────┴──────────────────────────────────────┘
```

For detail inspection, prefer a right-side drawer so the user can inspect a transaction without losing the table context.

On mobile, do not compress desktop tables unnaturally. Convert records into readable cards and preserve the same evidence hierarchy.

---

# Status language

Use consistent operational terminology:

```text
MATCHED
MISMATCH
UNRESOLVED
AI-ASSISTED
RUNNING
COMPLETED
```

Avoid vague labels such as:

* Good
* Bad
* Perfect Match
* AI Approved
* Needs AI

---

# Color semantics

Use color intentionally.

* Neutral → normal information
* Success → successfully reconciled
* Warning → unresolved / review required
* Error → actual system/provider failure
* Accent → interactive controls and selected states

Do not use color merely as decoration.

A status must never be communicated by color alone.

---

# Failure states

The UI must always translate technical failure into a human-readable operational state.

Example:

```text
Reconciliation couldn't complete.

We couldn't finish processing this run.
Your source records are safe.

[Retry]
```

For AI failure:

```text
AI resolution unavailable.

The record was kept unresolved
and added to the exception queue.

[View exception]
```

Never expose raw:

* stack traces
* provider errors
* database errors
* HTTP error messages

Those belong in logs.

---

# Trust requirements

The UI should make it easy to answer:

* What records were compared?
* What was the decision?
* Why?
* Which method produced it?
* Was AI involved?
* What evidence supported it?
* What remains unresolved?

Every important decision should be inspectable.

---

# What not to do

Do not:

* turn the product into a general finance chatbot
* send every record through the LLM
* fabricate confidence
* hide unresolved cases
* invent successful matches
* create charts that do not support an operator decision
* add unnecessary pages
* optimize for visual flash over financial clarity
* copy a reference product directly

The product is judged on:

**Problem Taste**
→ Does this solve a real finance-ops problem?

**Build Quality**
→ Does it run, remain structured, and inspire trust?

**AI Judgment**
→ Was AI used where it genuinely adds value, and deliberately avoided where it doesn't?

**Failure Recovery**
→ Does the system fail safely and make failures visible?

---

# Implementation order

Do not design and build everything at once.

Work in thin slices:

```text
1. Foundation
2. Data model
3. Synthetic benchmark
4. Deterministic reconciliation
5. Thin end-to-end reconciliation flow
6. AI ambiguity resolver
7. Results UI
8. Exception UI
9. Audit trail and benchmark metrics
10. Failure recovery and hardening
```

The first working slice should prove:

```text
Synthetic data
↓
Reconciliation
↓
Persist result
↓
Display result
```

before adding sophistication.

Before each build step:

1. State what is being built.
2. State why it is being built.
3. Record the decision in `scope.md`.
4. Build it.
5. Run the application.
6. Typecheck.
7. Lint.
8. Production build.
9. Exercise the real flow.
10. Update `scope.md`.

If the implementation disproves the plan, update the plan instead of silently working around it.
