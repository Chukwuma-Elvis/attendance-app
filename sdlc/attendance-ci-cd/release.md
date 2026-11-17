# Release: Attendance App CI/CD Pipeline

Derived from: plan.md (2026-11-17), test-plan.md (2026-11-17) · Status: accepted
Release manager: Tech Lead (User) · Accepted: 2026-11-17
Change-management reference: `attendance-ci-cd`
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Governing rule
The agent may act up to the production gate and cannot pass it. The CI/CD pipeline enforces this deterministically by requiring all verification steps to pass before enabling the production deployment gate.

## Approval gates
Each gate is a deterministic pre-action check (allow / ask / block).
| Gate | Trigger | Decision | Approver | Where enforced |
|------|---------|----------|----------|----------------|
| CI Pipeline Success | Push or PR targeting `main` | Block merge if any check (lint/test/build) fails | Automated CI Runner | GitHub Branch Protection |
| Production Deployment | Push to `main` reaching `deploy` job | Block deployment without manual release sign-off | Tech Lead (User) | GitHub Environment (`production`) |
| Workflow Modifications | Edits to `.github/workflows/*.yml` | Require code review and approval | Tech Lead | Repository Rule |

## Environments and autonomy
| Environment | What the agent / CI may do | Human gate |
|-------------|----------------------------|------------|
| Development | Run local commands (`npm run lint`, `npm test`, `npm run build`) | None |
| CI (GitHub Actions) | Spin up runner, install dependencies, run full verification suite | Automated (Pass/Fail) |
| Production | Run pre-approved deployment actions only after approval | Tech Lead authorizes release |

## Pipeline
- CI/CD platform: GitHub Actions (`.github/workflows/ci.yml`).
- Read-only agent steps: Check runner logs, triage test/lint failure output, check build artifacts.
- Write steps: Trigger workflow execution via `git push` or `workflow_dispatch`.
- Execution: Sandboxed Ubuntu 24.04 runner, scoped read-only GitHub token (`permissions: contents: read`), synthetic non-production environment variables during build.

## Rollback
- Command: `git revert <commit-sha> -m 1` or `git checkout HEAD~1 -- .github/workflows/ci.yml package.json`
- Last rehearsed: 2026-11-17
- Rehearsal cadence: Verified on each workflow modification.

## Measurement
- Leading: Zero failed status checks on accepted PRs.
- Lagging: Zero unauthorized or unverified code pushed to production.
