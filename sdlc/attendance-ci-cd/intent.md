# Intent: Attendance App CI/CD Pipeline

Author: Antigravity (DevOps & CI/CD Engineer) · Product owner: Tech Lead (User) · Status: accepted
Created: 2026-11-17 · Accepted: 2026-11-17 by Tech Lead (User)
Source document: User brief: "set up a CI/CD pipeline for attendance app" · Entry route: idea / brief
Source of truth: repository
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Problem
Currently, the `attendance-app` repository relies on manual local verification. Build validation, TypeScript compilation, ESLint checks, and the 46-assertion security audit suite must be invoked manually on developer machines. Without an automated CI/CD pipeline on GitHub:
- Pull requests cannot enforce automated status gates, creating a risk that broken builds, TypeScript regressions, or security regressions merge to `main`.
- Prisma client generation steps or database schema mismatches may go unnoticed until deployment.
- Deployment lacks a deterministic, automated pre-release validation gate.

## Proposed outcome
An automated, reliable, and fast GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) that:
- Triggers automatically on every `pull_request` and push to `main`.
- Sets up Node.js with dependency caching (`actions/setup-node` + npm cache) and Next.js build caching.
- Generates the Prisma Client (`npx prisma generate`).
- Runs ESLint (`npm run lint`).
- Runs the full automated security audit test suite (`npm test`).
- Compiles the Next.js production build (`npm run build`).
- Provides a structured production deployment job gate requiring human authorization.

## Affected users and systems
- **Users:**
  - Tech Lead and developers submitting PRs and reviewing code.
- **Systems:**
  - GitHub Actions runners (`ubuntu-latest`).
  - Next.js build engine & Prisma ORM.
  - Repository branch protection rules.

## Constraints
- **Runner Compatibility:** Must execute reliably on free GitHub Actions hosted runners (`ubuntu-latest`) without requiring paid third-party CI services.
- **Speed & Caching:** Must leverage npm caching and Next.js build caching to complete within ~2-3 minutes.
- **Environment Isolation:** Must provide necessary dummy/test environment variables (`DATABASE_URL="file:./test.db"`, `JWT_SECRET="test-secret"`, etc.) so Prisma and Next.js compile in CI without requiring live production database connections.

## Out of scope
- Provisioning external cloud hosting infrastructure (AWS ECS, Kubernetes, etc.).
- Modifying business logic or application UI code.

## Success criteria
- `.github/workflows/ci.yml` created, syntactically valid, and configured with appropriate triggers.
- All pipeline steps (checkout, setup-node, npm ci, prisma generate, lint, test, build) execute deterministically with exit code 0.
- Workflow prevents PR merges when any test, lint, or build check fails.

## Open questions
None. All intake parameters were confirmed in Step 0.

## Measurement
- Leading: Time from intake to accepted workflow configuration.
- Lagging: Zero broken builds on `main`; 100% of pull requests verified by CI before merge.
