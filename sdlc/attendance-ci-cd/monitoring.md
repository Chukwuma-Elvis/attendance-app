# Monitoring: Attendance App CI/CD Pipeline

Derived from: intent.md success criteria, release.md · Status: accepted
Service owner: Tech Lead (User) · On call: Tech Lead · Accepted: 2026-11-17
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Principle
Detection stays deterministic: GitHub Actions workflow run statuses, execution timings, and runner error logs monitor the health of the CI/CD pipeline without model speculation.

## Metrics
| Metric | Source | Baseline | Why it matters |
|--------|--------|----------|----------------|
| CI Failure Rate on `main` | GitHub Actions API / Logs | 0% | Any failure on `main` blocks releases and requires immediate investigation. |
| Workflow Duration | GitHub Actions Run Timers | < 180 seconds | Slow CI slows developer velocity and burns Actions runner quota. |
| Cache Hit Rate | `actions/cache` Logs | > 80% on warm builds | Misses indicate cache key drift or package lock file changes. |
| Test Failure Count | `npm test` Step Output | 0 | Any test assertion regression blocks the PR from merging. |

## Control bands and response tiers
```yaml
metric: workflow_duration_seconds
baseline: 120s
rules: threshold_exceeded
tiers:
  1sigma: { action: log, threshold: "> 180s" }
  2sigma: { action: diagnose, threshold: "> 240s", inspect: "cache_hits_and_download_times" }
  3sigma: { action: alert, threshold: "> 300s", routes: [notify_tech_lead] }

metric: ci_build_failures
baseline: zero_tolerance
rules: immediate_trigger
tiers:
  1sigma: { action: log }
  2sigma: { action: diagnose, inspect: "step_failure_output" }
  3sigma: { action: propose, routes: [create_hotfix_pr, block_main_merges] }
```

## Trigger layer
- GitHub Actions automated notifications (email, mobile push, and PR status checks).
- GitHub repository status badge on README.

## Closing the loop
1. When a CI run fails, the agent or developer inspects the specific failed step (lint, test, or build).
2. The failing step is reproduced locally using `npm run lint`, `npm test`, or `npm run build`.
3. A fix is committed to the PR branch; the pipeline automatically re-runs.
4. When the pipeline turns green, the PR is unblocked for merge.

## Pre-approved runbooks
| Runbook | When the agent may trigger it | Approved by |
|---------|-------------------------------|-------------|
| Local Reproduction (`npm ci && npx prisma generate && npm run lint && npm test && npm run build`) | On any failed CI run | Tech Lead |
| Re-run Failed Jobs in GitHub Actions | Transient runner / network errors | Tech Lead |
| Cache Reset | After major dependency upgrade (e.g. Next.js 17) | Tech Lead |

## Incident channel
- Channel: GitHub Pull Request status checks & Repository issues.
- Post-mortems: `lessons/ci-pipeline-incident.md`

## Measurement
- Leading: Time from workflow trigger to status check resolution.
- Lagging: Mean time to restore (MTTR) broken CI builds < 15 minutes.
