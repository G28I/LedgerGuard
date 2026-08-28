# Coding Standards & Architecture Guidelines

## 1. TypeScript & Type Safety
- **Strict Mode**: `"strict": true` is enforced in `tsconfig.json` alongside `noImplicitReturns`, `noUnusedLocals`, and `noUnusedParameters`.
- **Zero `any`**: The use of `any` is strictly prohibited in application and domain code.
- **Boundary Validation**: External or untrusted data (AI API responses, HTTP payloads, external JSON) is typed as `unknown` at system boundaries and MUST be validated using Zod schemas before being passed to domain logic. Do not use unsafe type assertions (`as Type`) to bypass validation.

## 2. Immutability & Functional Style
- **TypeScript `readonly`**: Prefer `const` variables, `readonly` interface properties, and `ReadonlyArray<T>` / `readonly T[]` over runtime `Object.freeze`.
- **Pure Domain Logic**: Functions inside `features/reconciliation/` must be pure functions with explicit inputs and outputs, free of side-effects or external network calls.

## 3. Financial Arithmetic Rules
- **Decimal Precision**: Never perform financial calculations using IEEE 754 binary floating-point math (`0.1 + 0.2`).
- **Integer Cents**: All monetary values are represented as integer cents (e.g. `$100.50` is represented as `10050` cents) or handled with explicit decimal-safe abstractions.
- **Auditing Discrepancies**: Source financial amounts and normalized amounts must remain distinct. Discrepancies must be recorded explicitly rather than rounded away.

## 4. Module & Import Conventions
- **ESM Standard**: Standardized on ECMAScript Modules (`"type": "module"` in `package.json`).
- **Path Aliases**: Use `@/features/<feature-name>` and `@/lib/<util-name>` path aliases.
- **Feature Encapsulation**: Each feature (`features/reconciliation`, `features/synthetic`, `features/ai`, `features/benchmark`, `features/db`) exposes public APIs via `index.ts`. Internal implementation details must remain private to the feature directory.

## 5. Environment Configuration
- **Fast-Fail Validation**: All environment variables are validated at startup via `@/lib/env`.
- **No Unvalidated Direct Access**: Domain code must import `{ env }` from `@/lib/env` instead of accessing `process.env` directly.

## 6. Prisma & Data Layer
- **Singleton Access**: Always import the Prisma Client instance from `@/features/db` or `@/lib/prisma`.
- **Explicit Schema**: Domain entities (Invoices, Ledger Entries, Bank Transactions, Reconciliation Runs, Results, Exceptions) have first-class relational fields. Generic JSON fields are reserved exclusively for variable audit metadata.

## 7. Developer Verification Scripts
- `npm run typecheck`: Runs `tsc --noEmit` to verify type safety.
- `npm run lint`: Runs ESLint over the workspace.
- `npm run check`: Runs typecheck and linting in sequence.
- `npm run build`: Executes Next.js Turbopack production build.
