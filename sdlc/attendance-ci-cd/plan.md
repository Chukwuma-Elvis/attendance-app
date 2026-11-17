# Plan: Attendance App CI/CD Pipeline

Derived from: intent.md (2026-11-17), spec.md (2026-11-17) · Status: accepted
Accepted by: Antigravity · Higher-risk sign-off: Tech Lead (User) (2026-11-17)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Files that change
| File | New / modified / deleted | Requirements covered |
|------|--------------------------|----------------------|
| `.github/workflows/ci.yml` | New | R1, R2, R3, R5, R6, R7 |
| `package.json` | Modified | R4 |
| `AGENTS.md` | Modified | Repo CI lifecycle conventions |

## Order of work
1. **Configure package script (`package.json`):** Add `"lint": "tsc --noEmit"` to provide a reliable, framework-independent lint and static analysis command that runs seamlessly in CI. (Covers R4)
2. **Implement GitHub Actions workflow (`.github/workflows/ci.yml`):**
   - Configure triggers: `push` on `main`, `pull_request` on `main`, and `workflow_dispatch`. (Covers R1)
   - Setup Node.js 20 with npm and Next.js Turbopack build cache. (Covers R2)
   - Enforce clean install (`npm ci`) and Prisma client generation (`npx prisma generate`). (Covers R3)
   - Execute static analysis (`npm run lint`). (Covers R4)
   - Execute security regression test suite (`npm test`). (Covers R5)
   - Execute Next.js production build (`npm run build`). (Covers R6)
   - Add gated `deploy` job for production on `main` push. (Covers R7)
3. **Verify pipeline commands locally:** Run `npm run lint`, `npm test`, and `npm run build` to confirm deterministic success before committing.
4. **Update `AGENTS.md`:** Document the CI pipeline commands and status checks.

## Parallelization
- Independent: `package.json` edits and `.github/workflows/ci.yml` creation.
- Sequential: Workflow creation → local command verification → git staging.

## Risks
| Risk | What it could break | Mitigation |
|------|---------------------|------------|
| Missing environment variables in CI runner | Build failure when Next.js checks database or JWT settings | Provide synthetic defaults (`DATABASE_URL`, `JWT_SECRET`) in workflow environment block. |
| Cache corruption between Next.js versions | Build artifacts mismatch in `.next/cache` | Cache key incorporates `package-lock.json` hash and OS runner identifier. |
| Runner permission escalation | Unauthorized edits by Actions token | Set top-level `permissions: contents: read`. |

**Riskiest step:** Step 2 (workflow syntax and environment setup). Verified by testing all pipeline commands locally and validating YAML structure.

## Alternatives considered
- **Using `next lint`:** Rejected because Next.js 16 deprecated/removed the legacy `next lint` CLI subcommand; `tsc --noEmit` provides strict static analysis and type-checking without deprecation risks.
- **Third-Party CI (CircleCI/Travis):** Rejected to keep all workflows natively integrated in GitHub without additional authentication credentials or costs.

## Proof
| Requirement | Test or check that proves it |
|-------------|------------------------------|
| R1 | Inspect `.github/workflows/ci.yml` `on:` block for `push`, `pull_request`, and `workflow_dispatch`. |
| R2 | Inspect workflow for `actions/setup-node@v4` with `cache: 'npm'` and `actions/cache@v4` for `.next/cache`. |
| R3 | Run `npm ci` and `npx prisma generate` locally. |
| R4 | Run `npm run lint` (`tsc --noEmit`); assert exit code 0. |
| R5 | Run `npm test`; assert all 46 assertions pass. |
| R6 | Run `npm run build`; assert exit code 0. |
| R7 | Inspect `deploy` job conditional: `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`. |

## Plan maintenance
If implementation departs from this plan, update this file in the same commit as the code.

## Measurement
- Leading: Clean execution of all steps without mid-flight architectural changes.
- Lagging: Zero workflow failures on GitHub Actions runner.
