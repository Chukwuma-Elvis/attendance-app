# Execution: PentAGI Security Hardening

The runbook for taking this change from its current state to production and into maintenance. Any human or agent can follow it. Generated from the artifacts below; update it whenever one of them changes. Progress against these steps, plus all decisions and conventions, is tracked in `WORKLOG.md` in this folder. Log each completed step there.

Change slug: `pentagi-security-hardening` · Last updated: 2026-11-17 · Current stage: Execution

## Artifact chain
| Stage | Artifact | Status | Owner | Approved by / date |
|-------|----------|--------|-------|--------------------|
| Plan | intent.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Design | spec.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Build | plan.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Build | AGENTS.md (repo) | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Test | test-plan.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Deploy | REVIEW.md (repo) | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Deploy | release.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |
| Maintain | monitoring.md | accepted | Antigravity | Tech Lead (User) · 2026-11-17 |

## Supporting skills
| Skill | Location | Version / date | Stages it shaped |
|-------|----------|----------------|------------------|
| modern-web-guidance | `C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md` | 2026 | Design, Build, Test |

Candidate skills to write:
- `nextjs-api-hardening`: reusable utility patterns for input sanitization, rate limiting, and defensive headers across Next.js App Router projects.

## Setup before automation starts
- [x] Review policy established in `REVIEW.md`.
- [x] Evaluation plan formulated in `test-plan.md`.
- [x] Rollback command defined (`git checkout HEAD~1 -- src/ next.config.mjs AGENTS.md`).

## Steps
1. **Implement `src/lib/validation.ts`** · agent · `spec.md` (R3, R4) → Implement `isValidId` and `safeErrorResponse` → `src/lib/validation.ts` · Gate: Syntax check
2. **Implement `src/lib/rate-limit.ts`** · agent · `spec.md` (R5) → Implement in-memory sliding window rate limiter → `src/lib/rate-limit.ts` · Gate: Syntax check
3. **Configure `next.config.mjs`** · agent · `spec.md` (R6) → Add `poweredByHeader: false` and OWASP defensive headers → `next.config.mjs` · Gate: Valid config syntax
4. **Harden `departments/route.ts`** · agent · `spec.md` (R1) → Redact `venueLatitude`, `venueLongitude`, `venueRadiusMeters`, drop `role` and `pinHash` query → `src/app/api/check-in/departments/route.ts` · Gate: Verify response shape
5. **Update `check-in/page.tsx`** · agent · `spec.md` (R2) → Adapt client UI to display venue verification status without requiring client-side coordinate proximity → `src/app/check-in/page.tsx` · Gate: TypeScript compilation
6. **Harden `src/app/api/biometrics/*`** · agent · `spec.md` (R3, R4, R5) → Enforce `isValidId`, rate limiting, and sanitized error responses across all biometric routes → Route handlers · Gate: Integration tests
7. **Harden `src/app/api/check-in/route.ts`** · agent · `spec.md` (R3, R4) → Add strict `employeeId` validation and sanitize error responses → `src/app/api/check-in/route.ts` · Gate: Check-in unit test
8. **Automated verification suite** · agent · `test-plan.md` → Create and run `scripts/security-audit-verify.mjs` → All tests pass · Gate: 100% test pass rate
9. **Build validation** · agent · `AGENTS.md` → Run `npm run build` → Zero errors · Gate: Exit code 0
10. **Final report & handoff** · agent · `release.md` → Present remediation summary to Tech Lead · Gate: Tech Lead acceptance

## Commands
```powershell
build:    npm run build
test:     node scripts/security-audit-verify.mjs
lint:     npm run lint
rollback: git checkout HEAD~1 -- src/ next.config.mjs AGENTS.md
```

## Parallel work
- Run at the same time:
  - Core utilities: `src/lib/validation.ts`, `src/lib/rate-limit.ts`
  - Server config: `next.config.mjs`
- Run in order:
  - Route handlers → Client updates → Verification suite → `npm run build`

## Human decision points
| Decision | Approver | Evidence they review |
|----------|----------|----------------------|
| Production Release Sign-off | Tech Lead (User) | `npm run build` output, security verification suite results, curl output |

## Unresolved questions
None. All questions from `intent.md` through `monitoring.md` have been resolved.
