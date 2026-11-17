# Plan: PentAGI Security Hardening

Derived from: intent.md (2026-11-17), spec.md (2026-11-17) · Status: accepted
Accepted by: Antigravity · Higher-risk sign-off: Tech Lead (User) (2026-11-17)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Files that change
| File | New / modified / deleted | Requirements covered |
|------|--------------------------|----------------------|
| `src/lib/validation.ts` | New | R3, R4 |
| `src/lib/rate-limit.ts` | New | R5 |
| `next.config.mjs` | Modified | R6 |
| `src/app/api/check-in/departments/route.ts` | Modified | R1 |
| `src/app/check-in/page.tsx` | Modified | R2 |
| `src/app/api/biometrics/auth-options/route.ts` | Modified | R3, R4, R5 |
| `src/app/api/biometrics/register-options/route.ts` | Modified | R3, R4, R5 |
| `src/app/api/biometrics/register-verify/route.ts` | Modified | R3, R4 |
| `src/app/api/biometrics/request-reset/route.ts` | Modified | R3, R4, R5 |
| `src/app/api/check-in/route.ts` | Modified | R3, R4 |
| `AGENTS.md` | Modified | Repo lifecycle context & verification |

## Order of work
1. **Create validation utility (`src/lib/validation.ts`):** Implement `isValidId` primitive checking (rejecting non-strings, objects, length > 64, illegal characters) and `safeErrorResponse` to emit sanitized 400/500 errors without leaking stack traces or file paths. (Covers R3, R4)
2. **Create rate-limiting utility (`src/lib/rate-limit.ts`):** Implement an in-memory sliding window rate limiter keyed by client IP and route path to prevent burst brute-force enumeration. (Covers R5)
3. **Configure Next.js defensive headers (`next.config.mjs`):** Add `poweredByHeader: false` and inject OWASP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`). (Covers R6)
4. **Harden department check-in endpoint (`src/app/api/check-in/departments/route.ts`):** Redact raw GPS coordinates (`venueLatitude: null`, `venueLongitude: null`, `venueRadiusMeters: 0`), remove employee `role`, remove `pinHash` from Prisma select, and provide `hasVenueLocation: boolean`. (Covers R1)
5. **Update mobile check-in UI (`src/app/check-in/page.tsx`):** Adjust client geofence display to indicate "Venue Location Enforced" when `hasVenueLocation` is true without computing client-side distance from secret coordinates; rely on server-side `POST /api/check-in` validation for authoritative distance verification. (Covers R2)
6. **Harden biometric route handlers (`src/app/api/biometrics/*`):** Apply `isValidId`, rate limiting, and sanitized error handling across `auth-options`, `register-options`, `register-verify`, and `request-reset`. (Covers R3, R4, R5)
7. **Harden check-in processing endpoint (`src/app/api/check-in/route.ts`):** Apply strict `isValidId` validation on `employeeId` and sanitize all unhandled error responses. (Covers R3, R4)
8. **Update repo-level `AGENTS.md`:** Document commands, architecture conventions, security mistakes to avoid, and lifecycle work pointer.
9. **Build & verify:** Run `npm run build` and run test verification suite confirming all vulnerabilities are patched with zero regressions.

## Parallelization
- **Independent tasks:**
  - Task A: `src/lib/validation.ts` and `src/lib/rate-limit.ts`
  - Task B: `next.config.mjs`
- **Sequential tasks:**
  - Tasks A & B → Route handlers (`/api/biometrics/*`, `/api/check-in`)
  - Department route changes (`departments/route.ts`) → Client adaptations (`check-in/page.tsx`)

## Risks
| Risk | What it could break | Mitigation |
|------|---------------------|------------|
| Client check-in UI expects numerical coordinates | Check-in page crash or false out-of-range warnings | Update `check-in/page.tsx` types and distance checks to safely check `hasVenueLocation` before reading coordinates; verify with TypeScript build. |
| In-memory rate limiting false positives | Legitimate mobile users sharing NAT/Wi-Fi IPs hitting rate limit | Set burst threshold to 30 requests/minute per IP; exempt static assets and non-sensitive routes. |
| Overly restrictive CSP breaking WebAuthn | Biometric registration or login failing in mobile browsers | Focus headers on framing (`X-Frame-Options`), content sniffing, and referrer policy; avoid restrictive custom script CSPs that block Next.js chunks. |

**Riskiest step:** Step 5 (`src/app/check-in/page.tsx` adaptations). We must ensure that legitimate employees on mobile devices can seamlessly submit check-ins and receive clear toast messages if they are physically outside venue bounds.

## Alternatives considered
- **External Redis Rate Limiting:** Rejected because it introduces an external infrastructure dependency and network hop for a single-node application. In-memory sliding window provides immediate protection without external configuration.
- **Requiring Full Authentication on `GET /api/check-in/departments`:** Rejected because the attendance app is intentionally designed for rapid kiosk/mobile selection where employees select their department and name before authenticating with WebAuthn or PIN. Redacting coordinates and roles achieves privacy without disrupting the kiosk user journey.

## Proof
| Requirement | Test or check that proves it |
|-------------|------------------------------|
| R1 | `curl -s http://localhost:3000/api/check-in/departments` confirms `venueLatitude` is null/omitted and employee objects have no `role` property. |
| R2 | Check-in portal renders without JavaScript errors; submitting within venue succeeds, submitting out-of-bounds shows server distance error. |
| R3 | `curl -X POST -H "Content-Type: application/json" -d '{"employeeId": {"$gt": ""}}' http://localhost:3000/api/biometrics/auth-options` returns HTTP 400 Bad Request. |
| R4 | Triggering error returns HTTP 500 with generic JSON `{ "error": "Internal server error" }` and 0 file system paths or stack traces. |
| R5 | Burst of 35 requests to `/api/biometrics/auth-options` returns HTTP 429 Too Many Requests. |
| R6 | `curl -I http://localhost:3000` confirms absence of `x-powered-by` and presence of `x-content-type-options: nosniff`, `x-frame-options: DENY`. |
| Zero Regression | `npm run build` completes with exit code 0. |

## Plan maintenance
If implementation departs from this plan, update this file in the same commit as the code.

## Measurement
- Leading: Clean execution of all steps without mid-flight architectural changes.
- Lagging: Zero security warnings on repeated automated PentAGI audit scans.
