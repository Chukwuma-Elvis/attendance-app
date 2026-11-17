# Release: PentAGI Security Hardening

Derived from: plan.md (2026-11-17), test-plan.md (2026-11-17) · Status: accepted
Release manager: Tech Lead (User) · Accepted: 2026-11-17
Change-management reference: `PENTAGI_SECURITY_REPORT.md`
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Governing rule
The agent may act up to the production gate and cannot pass it. All production deployments require explicit human Tech Lead authorization.

## Approval gates
Each gate is a deterministic pre-action check (allow / ask / block).
| Gate | Trigger | Decision | Approver | Where enforced |
|------|---------|----------|----------|----------------|
| Production deploy | Deploy command or Git push to main | Block without release authorization | Tech Lead (User) | Org-managed |
| Database schema modifications | Edits to `prisma/schema.prisma` | Block (no schema changes permitted in this patch) | Tech Lead | Repository rule |
| Biometric security modifications | Edits to `@simplewebauthn` cryptographic parameters | Block without security review | Tech Lead | Repository rule |

## Environments and autonomy
| Environment | What the agent may do | Human gate |
|-------------|-----------------------|------------|
| Development | Edit code, run `npm run build`, execute verification tests | None |
| Staging / Local Test | Start test server, run injection suite, verify headers | None |
| Production | Prepare patch, build, and report verification results | Tech Lead authorizes release |

## Pipeline
- CI/CD platform: Local / Git-based workflow.
- Read-only agent steps: Triage security scan results, verify TypeScript compilation, inspect HTTP response headers.
- Write steps: Implement input validation, rate limiting, error sanitizers, header configurations, and client component updates.
- Execution: Sandboxed workspace, local verification commands.

## Rollback
- Command: `git checkout HEAD~1 -- src/ next.config.mjs AGENTS.md`
- Last rehearsed: 2026-11-17
- Rehearsal cadence: Pre-deployment verification on each release.

## Measurement
- Leading: Zero failed test assertions during pre-release audit verification.
- Lagging: Zero security regressions or vulnerabilities reported in production monitoring.
