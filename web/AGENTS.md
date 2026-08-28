# AI Finance Controller

## What this is

An AI-powered finance-ops controller that closes one reconciliation loop across a batch of synthetic financial records.

The system ingests multiple financial sources, normalizes them, matches records using deterministic rules first, uses AI only for genuinely ambiguous cases, and produces an auditable result with match rate, resolution rate, throughput, and an explicit exception list.

The goal is not to make an LLM "do accounting." The goal is to automate a repetitive finance operation while knowing exactly what was resolved, what was not, why a decision was made, and how accurate the system actually was.

Read `scope.md` before building anything. It is the living implementation plan and the permanent record of decisions, tradeoffs, progress, benchmark results, and known limitations. Keep it current throughout the project. A new conversation should be able to continue from `scope.md` without needing the project explained again.

---

## How to work

Before building any feature, decide what is being built, why it belongs in the product, and how success will be measured. State that decision briefly before writing code. Do not begin implementation until that decision is approved.

Every feature follows the same sequence:

1. Decide the behavior and boundaries.
2. Record the decision in `scope.md`.
3. Build the feature.
4. Verify the real behavior.
5. Record the result, including failures and changed assumptions.

Do not ask questions for things that can reasonably be decided from the existing project direction.

Ask one question at a time only when there is a genuine product or architecture fork where two or three options are all reasonable and the choice materially affects the implementation.

Examples of real forks:

* Whether an unresolved match should remain pending or become a hard exception.
* Whether a confidence threshold should auto-resolve or require review.
* Whether a new source belongs in the first reconciliation loop.

Do not ask questions merely to avoid making ordinary engineering decisions.

If implementation exposes a contradiction in the plan, stop treating the plan as authoritative. Explain the contradiction, update `scope.md`, and then implement the corrected decision. Never quietly work around a conflict between the plan and the codebase.

When reporting completed work, keep the response short and actionable. Anything a person needs to do manually should be a concise checklist.

Detailed reasoning, benchmark observations, design decisions, failed approaches, and limitations belong in `scope.md`, not in repetitive status messages.

---

## Core product decision

This project closes one finance-ops loop:

**Multi-source financial reconciliation.**

The primary question is:

> Do records from different financial sources represent the same underlying transaction?

The first version should focus on reconciling synthetic records such as:

* invoices
* ledger entries
* bank transactions

Do not expand into tax automation, general finance chat, forecasting, or broad accounting functionality unless `scope.md` explicitly adds that work.

One reliable reconciliation loop is more valuable than several shallow finance features.

---

## Reconciliation philosophy

Financial decisions must be explainable and reproducible.

The system must use the simplest reliable mechanism capable of making a decision.

Decision order:

1. Exact deterministic match.
2. Normalized/fuzzy deterministic match.
3. AI-assisted reasoning for genuinely ambiguous candidates.
4. Explicit unresolved exception when confidence is insufficient.

Never call the AI model merely because the application contains an AI feature.

Never use an LLM for a decision that deterministic logic can make more reliably.

Never treat an LLM response as financial truth.

The AI is an ambiguity resolver, not the accounting engine.

---

## Ground truth and evaluation

Synthetic data must contain known ground truth.

Every benchmark record must have an objectively knowable expected outcome so the system can be evaluated independently of its own decisions.

The benchmark must include both normal and adversarial cases, including examples such as:

* exact matches
* vendor-name variations
* reference variations
* amount mismatches
* date mismatches
* missing records
* duplicate transactions
* multiple plausible candidates
* deliberately ambiguous cases

Never evaluate the system only on hand-picked successful examples.

Every meaningful run should report, at minimum:

* total records processed
* correct decisions
* incorrect decisions
* matched records
* unresolved records
* resolution rate
* throughput
* processing duration
* AI invocation count
* AI-assisted resolution count
* AI-rejected or AI-escalated count

Where meaningful, also report precision, recall, and F1 for exception detection or matching.

Do not hide poor results behind a single "accuracy" number.

---

## Rules

### Engineering

Functional style by default.

Prefer pure functions, immutable data, `const`, and `readonly`.

Keep side effects at system boundaries.

Use strict TypeScript.

Do not use `any`.

Organize code by feature rather than by large global layer folders.

Keep domain logic independent from UI and provider-specific code where practical.

Make reconciliation logic deterministic and unit-testable without calling the AI provider.

Fail fast when required environment variables are missing.

Do not silently fall back to an unavailable database, AI provider, or configuration.

---

### Financial correctness

Never silently alter financial values.

Use decimal-safe representations for monetary values. Do not use binary floating-point arithmetic for financial calculations.

Preserve source values and normalized values separately when normalization could affect interpretation.

Every reconciliation decision must retain enough evidence to reconstruct why it happened.

Never overwrite source records merely to make them match.

A mismatch is a valid outcome, not an error in the system.

Unknown, ambiguous, or conflicting information must remain explicitly unknown or unresolved.

---

### AI usage

OpenRouter is the AI provider abstraction.

Keep provider-specific code behind a small application interface so models can be changed without rewriting reconciliation logic.

AI calls must request structured output.

Validate every AI response with Zod before it enters domain logic or the database.

The AI must return, at minimum:

* decision
* confidence
* concise reason

Supported decisions should be finite and explicit, for example:

* `MATCH`
* `REJECT`
* `UNRESOLVED`

Do not parse free-form prose to infer financial decisions.

Never allow model output to bypass validation.

Never expose provider responses directly to users.

Never treat model confidence as mathematically calibrated probability. It is a model-produced signal used by our decision policy.

Confidence thresholds must be documented in `scope.md` and evaluated against the benchmark rather than chosen arbitrarily.

---

### Failure recovery

External AI calls are unreliable.

The application must handle:

* timeouts
* rate limits
* unavailable providers
* malformed responses
* schema validation failures
* transient network errors

Retry only when retrying is safe and useful.

Use bounded retries and exponential backoff where appropriate.

If AI resolution remains unavailable, the financial record must not disappear and must not be falsely marked as resolved.

Instead, preserve the candidate and create an explicit system exception such as `AI_UNAVAILABLE` or `AI_INVALID_RESPONSE`.

Provider failures must be translated into human-readable application states.

Never show raw stack traces, raw provider errors, or internal exception text to the user.

A failure should degrade into an auditable exception, not an invented answer.

---

### Data integrity

Every reconciliation run must have a persistent identity.

Every decision must be traceable to:

* the reconciliation run
* the source records considered
* the decision path
* whether AI was used
* the resulting status
* the explanation
* relevant confidence information
* timestamps

Never mutate historical reconciliation results merely because a later run produces a different answer.

A new run is a new observation.

---

### Accessibility

Every screen must support:

* readable contrast
* visible keyboard focus
* keyboard operation
* semantic controls
* meaningful labels
* accessible loading and error states

Do not use visual indicators as the only representation of match or exception status.

For example, an exception cannot be communicated only with a red icon.

---

### UI consistency

Shared spacing, typography, repeated visual patterns, and repeated controls belong in shared styling or components.

Do not copy the same UI pattern into multiple feature files.

Keep the visual language appropriate for a finance operations product: clear hierarchy, dense information where useful, obvious status, low ambiguity, and minimal decorative noise.

Do not imitate the generic "AI dashboard" aesthetic merely because the product uses AI.

---

### Verification

After every meaningful build or change:

* run the application
* typecheck
* lint
* run the production build
* exercise the changed behavior through a real browser or lightweight HTTP request
* inspect the actual result

Do not declare work complete because the code merely looks correct.

A passing typecheck is not proof that the feature works.

A successful AI API call is not proof that reconciliation is correct.

A pretty dashboard is not proof that the underlying numbers are trustworthy.

---

## Database

Use PostgreSQL with Prisma.

Prisma is the source of truth for the application's relational schema.

The schema should represent the finance domain explicitly rather than storing the entire application state in generic JSON blobs.

At minimum, the system should model:

* source financial records
* reconciliation runs
* reconciliation results
* exceptions
* AI decision metadata where needed for auditability

Prefer explicit relational fields for values the application queries, filters, sorts, aggregates, or validates.

Use JSON only for genuinely variable metadata that does not deserve a first-class schema field.

Database writes should preserve historical reconciliation evidence.

Do not destroy the original source data when creating normalized or reconciled representations.

---

## Synthetic data

Synthetic data is part of the product, not merely test scaffolding.

The generator must create realistic financial variation while maintaining known ground truth.

A benchmark should intentionally contain cases the system can:

* confidently resolve automatically
* resolve with AI
* correctly reject
* correctly escalate

Do not make the synthetic dataset artificially easy.

The dataset should contain enough records to demonstrate meaningful batch behavior, preferably well above the minimum 50-record requirement.

Keep the generation seed reproducible where practical so benchmark runs can be repeated.

When benchmark distributions change, document why in `scope.md`.

---

## Architecture

The preferred processing flow is:

```text
Source data
    ↓
Ingestion
    ↓
Normalization
    ↓
Candidate generation
    ↓
Deterministic matching
    ↓
Fuzzy matching where justified
    ↓
AI resolution for ambiguity
    ↓
Confidence / policy gate
    ↓
Matched / rejected / unresolved
    ↓
Persist result + evidence
    ↓
Metrics + exception report
```

Keep the layers conceptually separate:

```text
UI
 ↓
Application workflow
 ↓
Reconciliation domain logic
 ↓
Rules / candidate matching
 ↓
AI resolver
 ↓
Persistence
```

Do not bury financial reconciliation decisions inside React components or API route handlers.

Do not make the UI responsible for deciding whether transactions match.

---

## AI boundary

The following should generally NOT require AI:

* exact ID equality
* exact reference equality
* exact currency equality
* exact amount comparison
* explicit date tolerance checks
* deterministic duplicate detection
* arithmetic
* metrics
* benchmark scoring

The following MAY justify AI:

* interpreting inconsistent descriptions
* resolving messy vendor naming
* choosing between genuinely plausible candidates
* explaining ambiguous record relationships

When AI is not needed, the system should record that fact.

For example:

```text
Decision: MATCH
Method: DETERMINISTIC
AI used: NO
Reason: Exact reference and amount match
```

Choosing not to use AI is an intentional product decision and should be visible in the audit trail.

---

## Exceptions

Exceptions are first-class product output.

Do not treat unresolved records as embarrassing failures to hide.

An exception should communicate:

* what record is affected
* what was expected
* what was observed
* why it could not be resolved
* what evidence was considered
* whether human review is appropriate

Potential exception categories include:

* amount mismatch
* date mismatch
* missing record
* duplicate candidate
* ambiguous match
* AI unavailable
* AI response invalid
* insufficient evidence

The system must never silently discard an exception.

---

## Design

The visual direction for the application lives in `scope.md`.

Read the design feature there before changing UI styling.

Do not invent a visual system independently in individual screens.

Finance operations require information clarity over visual novelty.

The main dashboard should make these things immediately understandable:

* what was processed
* how much matched
* how much was unresolved
* whether AI was used
* how long the run took
* where the exceptions are

---

## Demo principles

The demo must show a full batch, not a single hand-picked success.

The preferred demonstration flow is:

```text
Load benchmark
    ↓
Run reconciliation
    ↓
Show progress / processing state
    ↓
Show summary metrics
    ↓
Inspect matched records
    ↓
Inspect AI-assisted decisions
    ↓
Inspect unresolved exceptions
    ↓
Show evidence for a decision
```

The demo should intentionally include failure cases.

Do not hide provider failures, malformed records, or unresolved matches from the demonstration if they are relevant to proving the system's robustness.

A system that openly reports uncertainty is preferable to one that claims 100% success through aggressive guessing.

---

## What "done" means

A feature is not done when:

* the code compiles
* the page renders
* the API responds
* the AI returns an answer

A feature is done when:

* its behavior matches the decision recorded in `scope.md`
* its domain logic works on representative data
* failure states are handled
* its output is persisted correctly where required
* its UI is usable and accessible
* typecheck passes
* lint passes
* production build passes
* the real user flow has been exercised
* known limitations are documented

---

## Scope discipline

Do not add features merely because they sound impressive.

The first priority is a trustworthy reconciliation loop across a meaningful batch.

Potential future features such as forecasting, settlement Q&A, tax matching, approvals, notifications, or autonomous accounting actions should remain out of scope until the core loop is demonstrably reliable.

More AI is not automatically more product.

More screens are not automatically more value.

A smaller system that produces measurable, explainable, recoverable results is the target.

---

## Context files

Nested context files, if created for a specific part of the codebase, are listed here.

Keep this section updated whenever a feature-specific agent or context file is introduced.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version may contain breaking changes — APIs, conventions, and file structure may differ from training-data assumptions.

Before writing Next.js-specific code, read the relevant guide in:

`node_modules/next/dist/docs/`

Resolve it from this file's directory. In a monorepo, confirm that the installed `next` package is actually the one used by the application.

Heed deprecation notices and current framework conventions.

This block is maintained by the installed Next.js tooling. Do not remove it from the file unless the tooling itself requires that change.

<!-- END:nextjs-agent-rules -->
