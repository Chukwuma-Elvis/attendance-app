# Test plan: Attendance App CI/CD Pipeline

Derived from: spec.md (2026-11-17), plan.md (2026-11-17) · Status: accepted
Accepted by: Tech Lead (User) (2026-11-17)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Feedback loop
The agent runs these itself and iterates until they pass, before any human reviews the work.
| Check | Command | Passing looks like |
|-------|---------|--------------------|
| YAML Lint / Syntax | `node -e "require('fs').readFileSync('.github/workflows/ci.yml')"` | Valid file syntax, parses without error. |
| Lint & Static Analysis | `npm run lint` (`tsc --noEmit`) | TypeScript compiles with zero errors and exit code 0. |
| Test Suite | `npm test` | All 46 security assertions pass with exit code 0. |
| Production Build | `npm run build` | Next.js and Prisma generate and compile with code 0. |

## Done-targets
- Workflow file `.github/workflows/ci.yml` exists, is syntactically valid, and includes both `verify` and `deploy` jobs.
- `package.json` contains `"lint": "tsc --noEmit"` and `"test": "tsx scripts/security-audit-verify.ts"`.
- All pipeline commands run locally without error before committing.
- GitHub Actions runner succeeds on first push to `main`.

## Traceability
| Requirement | Test(s) | Type |
|-------------|---------|------|
| R1 (Triggers) | Verify `on:` block triggers for `push`, `pull_request`, and `workflow_dispatch`. | Config Audit |
| R2 (Caching) | Verify `setup-node` npm caching and `actions/cache` for `.next/cache`. | Config Audit |
| R3 (Dependencies & Prisma) | Run `npm ci` and `npx prisma generate` locally. | Integration |
| R4 (Linting & Types) | Run `npm run lint`; verify exit code 0. | Static Analysis |
| R5 (Security Tests) | Run `npm test`; verify 46/46 assertions pass. | Automated Unit/Integration |
| R6 (Production Build) | Run `npm run build`; verify exit code 0 and page optimization. | Build Verification |
| R7 (Deploy Gate) | Verify `deploy` job conditionals and `environment: production` definition. | Config Audit |

## Bug fixes: test first
1. If a step fails in CI, reproduce the exact failure command locally in a clean shell.
2. Fix the underlying configuration or code issue.
3. Verify all four checks in the Feedback loop pass before pushing.

## Protecting the loop
- Review rule: Reject any pull request that deletes or disables required CI status checks, relaxes `--noEmit`, or ignores failing test assertions.

## Evals (ongoing agent work)
- Suite location: `.github/workflows/ci.yml` and `scripts/security-audit-verify.ts`
- Cases: Automated execution on every commit and pull request.
- Gate: 100% pipeline success required for branch merge to `main`.

## Measurement
- Leading: Local feedback loop commands complete in < 20 seconds total.
- Lagging: GitHub Actions run duration < 3 minutes; zero broken commits on `main`.
