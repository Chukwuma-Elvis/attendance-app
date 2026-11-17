# Execution: Attendance App CI/CD Pipeline

The runbook for taking this change from its current state to production and into maintenance. Any human or agent can follow it. Generated from the artifacts below; update it whenever one of them changes. Progress against these steps, plus all decisions and conventions, is tracked in `WORKLOG.md` in this folder. Log each completed step there.

Change slug: `attendance-ci-cd` · Last updated: 2026-11-17 · Current stage: Execution

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

## Setup before automation starts
- [x] Review policy established in `REVIEW.md`.
- [x] Evaluation plan formulated in `test-plan.md`.
- [x] Rollback command defined (`git revert HEAD`).

## Steps
1. **Configure `"lint": "tsc --noEmit"` in `package.json`** · agent · `plan.md` → Edit `package.json` scripts → `package.json` · Gate: Verify `npm run lint` exits with code 0.
2. **Implement `.github/workflows/ci.yml`** · agent · `spec.md` → Create workflow YAML with `verify` and `deploy` jobs → `.github/workflows/ci.yml` · Gate: Verify YAML structure & parser.
3. **Run Local Verification Feedback Loop** · agent · `test-plan.md` → Execute `npm run lint`, `npm test`, `npm run build` → All steps pass · Gate: Zero errors across all checks.
4. **Update `AGENTS.md` and `WORKLOG.md`** · agent · `plan.md` → Document CI/CD commands and record completion → `AGENTS.md`, `WORKLOG.md` · Gate: Clean file states.
5. **Stage, Commit, and Deploy** · agent & Tech Lead · `release.md` → `git add` + `git commit` + `git push origin main` → Workflow live on GitHub · Gate: Tech Lead authorization.

## Commands
```powershell
lint:     npm run lint
test:     npm test
build:    npm run build
deploy:   git push origin main
rollback: git checkout HEAD~1 -- .github/workflows/ci.yml package.json
```

## Parallel work
- Independent: Step 1 (`package.json`) and Step 2 (`.github/workflows/ci.yml`).
- Sequential: Steps 1 & 2 → Step 3 (Verification) → Step 4 (Docs) → Step 5 (Commit & Push).

## Human decision points
| Decision | Approver | Evidence they review |
|----------|----------|----------------------|
| Commit and Push to `main` | Tech Lead (User) | Local verification results (`npm run lint`, `npm test`, `npm run build`, and workflow YAML contents). |

## Unresolved questions
None. All questions from `intent.md` through `monitoring.md` have been resolved.
