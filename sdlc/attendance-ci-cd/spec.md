# Spec: Attendance App CI/CD Pipeline

Derived from: intent.md (2026-11-17) · Status: accepted
Product owner: Tech Lead (User) · Technical sign-off: Tech Lead (User) · Accepted: 2026-11-17
Policies applied: modern-web-guidance, Assumed CI/CD Baseline (GitHub Actions Best Practices)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Summary
Defines the architectural specification for an automated, secure, and fast GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`) for the Next.js attendance and biometric application. The pipeline automates dependency installation, Prisma client generation, TypeScript static analysis, automated security audit suite execution (46 assertions), and production build compilation, terminating in an authorized deployment release gate.

## Functional requirements
| ID | Requirement | Acceptance criterion (measurable) |
|----|-------------|-----------------------------------|
| R1 | Multi-Trigger Execution | Pipeline triggers automatically on all `pull_request` events targeting `main`, `push` events to `main`, and manual executions via `workflow_dispatch`. |
| R2 | Environment & Caching Setup | Runs on `ubuntu-latest` with Node.js 20. Restores and saves npm dependencies cache (`actions/setup-node` with `cache: 'npm'`) and Next.js Turbopack build cache (`.next/cache`). |
| R3 | Deterministic Installation & Prisma Client | Executes `npm ci` for clean reproducible installs, followed by `npx prisma generate` to create the typed Prisma Client before code analysis. |
| R4 | Static Analysis & Linting | Configures `"lint": "tsc --noEmit"` in `package.json` and executes `npm run lint` in CI; fails the build if any TypeScript or syntax error is present. |
| R5 | Security Audit Test Suite | Executes `npm test` (`tsx scripts/security-audit-verify.ts`); asserts that all 46 security checks pass (input validation, sanitization, rate limiting, zero GPS leakage, defensive headers). |
| R6 | Production Build Compilation | Executes `npm run build` in CI with synthetic environment variables (`DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`); asserts exit code 0. |
| R7 | Production Deployment Gate | Defines a downstream `deploy` job that triggers only on `push` to `main` after the `verify` job succeeds, gated by GitHub environment protection (`production`). |

## Non-functional requirements
| ID | Category | Requirement | Acceptance criterion |
|----|----------|-------------|----------------------|
| N1 | Performance | Pipeline Duration < 3 Minutes | Total workflow execution time remains under 180 seconds on cached runs. |
| N2 | Reliability | Zero External Database Dependency | Uses synthetic/mock environment variables (`DATABASE_URL="file:./dev.db"`) during build so CI never requires a live production database connection. |
| N3 | Security | Least-Privilege GitHub Permissions | Workflow specifies explicit `permissions: contents: read` to prevent unauthorized repository modifications. |
| N4 | Maintainability | Standardized Workflow Structure | Clean, modular YAML adhering to GitHub Actions standards with clear step names. |

## Design

### Components and responsibilities
1. **GitHub Workflow (`.github/workflows/ci.yml`):**
   - The declarative workflow file orchestrating jobs, steps, environment secrets, and artifact caches.
2. **Package Scripts (`package.json`):**
   - `"lint": "tsc --noEmit"` ensures standard static analysis without third-party CLI incompatibilities.
   - `"test": "tsx scripts/security-audit-verify.ts"` runs the regression test suite.
   - `"build": "prisma generate && next build"` generates Prisma client and compiles the Next.js app.
3. **Prisma Schema (`prisma/schema.prisma`):**
   - Generates client statically during the CI run so all App Router routes have access to Prisma models during typecheck and build.

### Data flow
```
[Developer Push / Pull Request]
              │
              ▼
    [GitHub Actions Trigger]
              │
              ▼
   ┌──────────────────────────────────────────────┐
   │ Job: verify (ubuntu-latest)                  │
   ├──────────────────────────────────────────────┤
   │ 1. actions/checkout@v4                       │
   │ 2. actions/setup-node@v4 (node-version: 20)  │
   │ 3. Restore .next/cache (actions/cache@v4)    │
   │ 4. npm ci                                    │
   │ 5. npx prisma generate                       │
   │ 6. npm run lint (tsc --noEmit)               │
   │ 7. npm test (scripts/security-audit-verify)  │
   │ 8. npm run build                             │
   └──────────────────────────────────────────────┘
              │
       (Success & on main?)
         ┌────┴────┐
         │         │
       [Yes]      [No] ──► (PR Status Check: Green)
         │
         ▼
   ┌──────────────────────────────────────────────┐
   │ Job: deploy (Environment: production)        │
   ├──────────────────────────────────────────────┤
   │ Gate: Requires Tech Lead Release Sign-off    │
   │ Status: Ready for Production Rollout         │
   └──────────────────────────────────────────────┘
```

### Interfaces and contracts
- `.github/workflows/ci.yml`:
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    name: Verify & Build
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
      DATABASE_URL: "file:./dev.db"
      JWT_SECRET: "ci-testing-jwt-secret-key-32chars"
      NEXT_PUBLIC_APP_URL: "http://localhost:3000"
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Cache Next.js build
        uses: actions/cache@v4
        with:
          path: ${{ github.workspace }}/.next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}-

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run TypeScript & Lint checks
        run: npm run lint

      - name: Run Security Audit Test Suite
        run: npm test

      - name: Compile Next.js Production Build
        run: npm run build

  deploy:
    name: Production Release Gate
    needs: verify
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Log Deployment Readiness
        run: |
          echo "Production deployment gate reached."
          echo "Commit ${{ github.sha }} verified successfully across lint, security audit, and build."
```

## Policy compliance
| Policy | How the design satisfies it | Status |
|--------|-----------------------------|--------|
| OWASP CI/CD Best Practices | Read-only runner permissions, deterministic `npm ci`, zero production credentials exposed in logs. | Compliant |
| Next.js Production Deployment | Turbopack caching, Prisma pre-generation, production build verification. | Compliant |
| Automated Governance | Full security audit assertions executed on every PR prior to merge. | Compliant |

## Areas of concern
| # | Concern | Policy owner | Resolution | Status |
|---|---------|--------------|------------|--------|
| 1 | `next lint` is deprecated in Next.js 16 (`next@16.3.4`). | Tech Lead | Define `"lint": "tsc --noEmit"` in `package.json` to perform authoritative strict TypeScript static analysis without relying on obsolete CLI subcommands. | Resolved |
| 2 | Prisma build failure if `DATABASE_URL` is missing during build. | Tech Lead | Supply synthetic `DATABASE_URL="file:./dev.db"` in workflow environment block so build compiles cleanly. | Resolved |

## Open questions carried from intent.md
None. All open questions resolved.

## Measurement
- Leading: Time from intent acceptance to committed workflow.
- Lagging: CI pipeline runtime < 3 minutes; 100% build health on `main`.
