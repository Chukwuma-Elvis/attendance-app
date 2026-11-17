# Monitoring: PentAGI Security Hardening

Derived from: intent.md success criteria, release.md · Status: accepted
Service owner: Tech Lead (User) · On call: Tech Lead · Accepted: 2026-11-17
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Principle
Detection stays deterministic: server logs and deterministic health/audit checks monitor endpoint behavior with zero model hallucination. An agent is invoked only when an anomaly threshold is breached.

## Metrics
| Metric | Source | Baseline | Why it matters |
|--------|--------|----------|----------------|
| Biometric 400 Spike | API Access Logs | < 1% of total biometric requests | Spikes indicate active input manipulation, fuzzing, or injection attempts. |
| Rate-Limit 429 Hits | Rate-limit counters / Logs | 0 under normal usage | Any elevation indicates brute-force enumeration probing of employee IDs. |
| Internal 500 Errors | Server error logs | 0 | Any 500 error triggers immediate triage to ensure error sanitization prevented leaks. |
| Geofence 403 Rejections | `/api/check-in` Logs | < 3% of check-in attempts | Indicates employees checking in outside venue boundaries or potential GPS spoofing. |

## Control bands and response tiers
```yaml
metric: biometric_validation_errors_400
baseline: rolling_7d
rules: western_electric
tiers:
  1sigma: { action: log, channel: console }
  2sigma: { action: diagnose, tools: "read-only logs inspection" }
  3sigma: { action: propose, routes: [alert_tech_lead, block_offending_ip] }

metric: server_500_errors
baseline: zero_tolerance
rules: immediate_spike
tiers:
  1sigma: { action: log }
  2sigma: { action: diagnose, inspect: "sanitized_response_compliance" }
  3sigma: { action: propose, routes: [alert_tech_lead] }
```

## Trigger layer
- Server console and Node.js process error logging.
- Regular security regression audit via `node scripts/security-audit-verify.mjs`.

## Closing the loop
1. When abnormal 400/429/500 error volumes are logged, the triage step verifies that responses remained strictly sanitized and zero stack traces escaped.
2. If new injection patterns bypass initial validation, an updated `intent.md` is drafted to extend `src/lib/validation.ts`.
3. An automated test case reproducing the new payload is added to `scripts/security-audit-verify.mjs`.

## Pre-approved runbooks
| Runbook | When the agent may trigger it | Approved by |
|---------|-------------------------------|-------------|
| Security Audit Verification (`node scripts/security-audit-verify.mjs`) | On any code change or build | Tech Lead |
| Rate Limit Reset | Server restart or cache flush | Tech Lead |

## Incident channel
- Channel: Repository issues / direct Tech Lead console alerts.
- Post-mortems: `lessons/security-audit-remediation.md`

## Measurement
- Leading: Immediate capture and blocking of malformed payloads via HTTP 400/429 without server crashes.
- Lagging: Zero security breaches or PII disclosure incidents in production logs.
