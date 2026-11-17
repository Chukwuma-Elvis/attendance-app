# Test plan: PentAGI Security Hardening

Derived from: spec.md (2026-11-17), plan.md (2026-11-17) · Status: accepted
Accepted by: Tech Lead (User) (2026-11-17)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Feedback loop
The agent runs these itself and iterates until they pass, before any human reviews the work.
| Check | Command | Passing looks like |
|-------|---------|--------------------|
| Build | `npm run build` | Next.js compilation succeeds with zero TypeScript errors and code 0. |
| Test | `node scripts/security-audit-verify.mjs` | All 6 security test cases pass (R1 through R6). |
| Lint | `npm run lint` | ESLint completes with zero errors. |
| Headers | `curl -I http://localhost:3000` | Headers include `x-content-type-options: nosniff`, `x-frame-options: DENY`; `x-powered-by` absent. |

## Done-targets
- `npm run build` completes cleanly with 0 type errors.
- Automated security audit script `scripts/security-audit-verify.mjs` passes 100% of vulnerability verification tests.
- Re-testing PentAGI findings shows all 4 vulnerability domains resolved:
  1. No GPS coordinates or employee roles exposed on `GET /api/check-in/departments`.
  2. No 500 error cascades or Prisma exceptions on malformed object payloads (`{"$gt": ""}`).
  3. Biometric rate limiting triggers HTTP 429 when threshold exceeded.
  4. Defensive headers active, `X-Powered-By: Next.js` eliminated.

## Traceability
| Requirement | Test(s) | Type |
|-------------|---------|------|
| R1 (Redact GPS & Roles) | `testDepartmentsRedaction`: verifies `venueLatitude` is null/omitted, `role` is absent in all employee entries. | Integration |
| R2 (Mobile Check-in) | `testMobileCheckInFlow`: verifies check-in interface handles null coordinates and triggers server geofence validation. | Integration / E2E |
| R3 (Primitive Validation) | `testBiometricInputValidation`: sends `{"employeeId": {"$gt": ""}}` and `{"employeeId": 12345}` to `/api/biometrics/*`; asserts HTTP 400 Bad Request. | Unit / Integration |
| R4 (Sanitized 500 Errors) | `testSanitizedErrorResponses`: simulates failure and asserts zero stack traces, Prisma ASTs, or Windows paths (`C:\...`) in response body. | Security Integration |
| R5 (Rate Limiting) | `testBiometricRateLimiting`: sends 35 consecutive requests; asserts HTTP 429 Too Many Requests with rate limit headers. | Security Integration |
| R6 (Security Headers) | `testSecurityHeaders`: inspects HTTP headers; asserts presence of `x-content-type-options`, `x-frame-options`, `referrer-policy`, and absence of `x-powered-by`. | Header Verification |

## Bug fixes: test first
1. Script `scripts/security-audit-verify.mjs` records the vulnerable behavior (500 on object injection, GPS coordinates leaked).
2. Code fixes are implemented in route handlers, config, and utilities.
3. Verification script re-executed against the live or simulated handlers to confirm 100% pass rate without altering assertions.

## Protecting the loop
- Review rule: Reject any diff that weakens validation checks, bypasses rate limiting, or suppresses security test assertions.

## Evals (ongoing agent work)
- Suite location: `scripts/security-audit-verify.mjs`
- Cases: 6 automated vulnerability reproduction and verification test suites.
- Runs: Can be executed locally via Node.js before deployment or during CI build.
- Gate: 100% pass rate required for release.

## Measurement
- Leading: Clean first-pass execution of `node scripts/security-audit-verify.mjs` and `npm run build`.
- Lagging: Zero security regressions or vulnerabilities reported by future PentAGI multi-agent audit scans.
