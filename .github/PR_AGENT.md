# PR Code Review Agent Setup & Usage Guide

`LedgerGuard` is configured with an automated AI Pull Request Reviewer powered by **Qodo PR-Agent** via **OpenRouter**.

---

## 1. Required GitHub Repository Secret

To enable automated code review on Pull Requests:

1. Go to your GitHub repository: `https://github.com/G28I/LedgerGuard/settings/secrets/actions`
2. Click **New repository secret**.
3. Set **Name**: `OPENROUTER_API_KEY`
4. Set **Value**: *Your OpenRouter API Key* (e.g. `sk-or-v1-...`)
5. Click **Add secret**.

---

## 2. Automated Features

Whenever a Pull Request is **opened**, **re-opened**, or **updated** (`synchronize`):

* **Automated Code Review**: Analyzes PR diffs for TypeScript strictness, financial arithmetic correctness (cents vs floats), Zod schema safety, and security vulnerabilities.
* **Code Suggestions**: Generates actionable code improvement snippets directly on affected PR lines.
* **Security & Quality Audit**: Checks for forbidden `any` types, floating-point monetary operations, and missing error handlers.

