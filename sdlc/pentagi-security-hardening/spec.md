# Spec: PentAGI Security Hardening

Derived from: intent.md (2026-11-17) · Status: accepted
Product owner: Tech Lead (User) · Technical sign-off: Tech Lead (User) · Accepted: 2026-11-17
Policies applied: modern-web-guidance, Assumed Security Baseline (OWASP Top 10)
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Summary
Remediates all critical, medium, and low vulnerabilities identified in the PentAGI Security Assessment Report (`PENTAGI_SECURITY_REPORT.md`). The changes redact venue GPS coordinates and employee roles from public endpoints, enforce strict primitive type validation to prevent Prisma ORM crashes and internal path leakage, sanitize all error responses, implement in-memory rate limiting against biometric enumeration, and configure comprehensive OWASP security headers while suppressing framework fingerprinting.

## Functional requirements
| ID | Requirement | Acceptance criterion (measurable) |
|----|-------------|-----------------------------------|
| R1 | Redact Venue GPS & Sensitive Metadata in `GET /api/check-in/departments` | Response omits raw coordinates (`venueLatitude: null`, `venueLongitude: null`, `venueRadiusMeters: 0`), omits employee `role` and queries referencing `pinHash`. Returns only `hasVenueLocation: boolean`, department name/id, shift windows, and active employee IDs/names. |
| R2 | Mobile Check-In Graceful Handling (`src/app/check-in/page.tsx`) | The mobile check-in UI operates cleanly without client-side venue coordinate dependency. Indicates "Venue Geofencing Active" when `hasVenueLocation` is true; relies on server-side `POST /api/check-in` validation for authoritative distance verification and displays server response if out of range. |
| R3 | Primitive Input Validation Across Biometrics & Check-In APIs | `POST /api/biometrics/auth-options`, `register-options`, `register-verify`, `request-reset`, and `POST /api/check-in` validate that `employeeId` is a non-empty string conforming to valid ID patterns (alphanumeric/hyphen/underscore). Reject object injections (e.g. `{"$gt": ""}`) with HTTP 400 Bad Request before invoking Prisma. |
| R4 | Sanitized Error Handling & Path Masking | All API route handlers catch unhandled exceptions, log the real error on the server console, and return a sanitized, generic error message (`{ "error": "Internal server error" }` or specific client-safe failure message). Responses must contain zero stack traces, Prisma AST structures, or local file paths (`C:\...`). |
| R5 | Rate Limiting & Anti-Enumeration Defense | Sensitive biometric endpoints (`/api/biometrics/*`) enforce in-memory rate limiting per client IP (e.g., 20 requests/minute burst threshold), returning HTTP 429 Too Many Requests when exceeded to prevent automated employee ID probing. |
| R6 | OWASP Security Headers & Framework Cloaking | `next.config.mjs` sets `poweredByHeader: false` (removing `X-Powered-By: Next.js`) and injects defensive headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`. |

## Non-functional requirements
| ID | Category | Requirement | Acceptance criterion |
|----|----------|-------------|----------------------|
| N1 | Security | Zero Information Disclosure | No confidential PII (roles, pinHash, GPS coordinates, stack traces, file system paths) leaked in responses to unauthenticated users. |
| N2 | Performance | Negligible Latency Overhead | Validation and rate-limiting processing adds < 5ms to route handler execution time. |
| N3 | Reliability | Zero Workflow Regressions | Legitimate employees can continue checking in via Biometrics or PIN, registering passkeys, and submitting device reset requests. |
| N4 | Maintainability | Modular Security Utilities | Common validation rules and rate-limiting mechanisms reside in dedicated utilities (`src/lib/validation.ts` and `src/lib/rate-limit.ts`) for consistent reuse across routes. |

## Design

### Components and responsibilities
1. **Validation Utility (`src/lib/validation.ts`):**
   - Provides `isValidId(value: unknown): value is string` and `sanitizeError(error: unknown, fallbackMessage: string): string`.
   - Ensures any input intended as an identifier is strictly a non-empty string with safe characters (alphanumeric, hyphen, underscore, max length 64), immediately rejecting objects, arrays, and injection operators.
2. **Rate Limiting Utility (`src/lib/rate-limit.ts`):**
   - Lightweight, in-memory sliding window rate limiter keyed by client IP and route path.
   - Cleans up stale entries periodically; returns rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
3. **Department Check-In Route (`src/app/api/check-in/departments/route.ts`):**
   - Drops `pinHash` from Prisma `select`.
   - Drops `role` from employee selection.
   - Sets `venueLatitude: null`, `venueLongitude: null`, and `venueRadiusMeters: 0` in public output, preserving only `hasVenueLocation: boolean` to signal geofence enforcement.
4. **Client Mobile Check-In (`src/app/check-in/page.tsx`):**
   - Updates distance display logic: if `hasVenueLocation` is true, informs user that geofence location is required and verified upon submission.
   - Coordinates are transmitted in `POST /api/check-in` where the server verifies distance against the database venue coordinates.
5. **Biometric Route Handlers (`src/app/api/biometrics/*`):**
   - Guarded with `isValidId(employeeId)`. Returns HTTP 400 for malformed payloads.
   - Rate limited with `checkRateLimit(req, 20, 60000)`.
   - Wrapped in sanitized error handling that logs details server-side and emits safe messages.
6. **Next.js Configuration (`next.config.mjs`):**
   - Injects `poweredByHeader: false`.
   - Injects HTTP security headers on all routes via `headers()` configuration.

### Data flow
```
[Client / PentAGI Swarm]
        │
        ▼ (HTTP Request)
[next.config.mjs] ──────────► Injects OWASP Security Headers, Strips X-Powered-By
        │
        ▼
[Route Handler]
        │
        ├─► [src/lib/rate-limit.ts] ──(Exceeded?)──► HTTP 429 Too Many Requests
        │
        ├─► [src/lib/validation.ts] ──(Invalid?)───► HTTP 400 Bad Request
        │
        ▼
[Prisma ORM Query (Safe parameterized string)]
        │
        ▼
[Response Formatter] ───────► Redacts GPS / Roles; Sanitizes 500 error messages
        │
        ▼
[Sanitized Response to Client]
```

### Interfaces and contracts
- `GET /api/check-in/departments`:
  - Returns `DepartmentInfo[]` where `venueLatitude` is `null`, `venueLongitude` is `null`, and `role` is omitted from employee records.
- `POST /api/biometrics/*`:
  - Body: `{ employeeId: string, ... }`.
  - Non-string or malformed `employeeId` returns: `HTTP 400 { "error": "Invalid employee identifier." }`.
  - Internal error returns: `HTTP 500 { "error": "An unexpected error occurred while processing your request." }`.
- `Rate Limit Exceeded`:
  - Returns: `HTTP 429 { "error": "Too many requests. Please try again shortly." }`.

### UI / UX
- `src/app/check-in/page.tsx`:
  - When `activeDept.hasVenueLocation` is true: Displays "Venue Geofence: Active (Verified on check-in)" instead of calculating client-side distance from secret coordinates.
  - If user submits check-in outside venue: The server responds with `HTTP 403` and the exact distance message, which the existing notification toast (`setResultMessage`) renders clearly.

### Integration with the existing system
- Fully backwards compatible with existing Prisma database schema (no migration required).
- Existing valid employees, admin portal sessions, and WebAuthn authenticators continue operating without modification.

## Policy compliance
| Policy | How the design satisfies it | Status |
|--------|-----------------------------|--------|
| OWASP A01:2021 (Broken Access Control) | Moves geofence enforcement entirely to server-side check-in validation; strips confidential metadata from public endpoints. | Compliant |
| OWASP A03:2021 (Injection / ORM Manipulation) | Strict primitive validation rejects object injection before ORM invocation. | Compliant |
| OWASP A04:2021 (Insecure Design) | In-memory rate limiting stops brute-force enumeration of employee IDs and biometric passkeys. | Compliant |
| OWASP A05:2021 (Security Misconfiguration) | Injects CSP/HSTS/Frame/Sniff headers; removes `X-Powered-By: Next.js`. | Compliant |

## Areas of concern
| # | Concern | Policy owner | Resolution | Status |
|---|---------|--------------|------------|--------|
| 1 | Client-side distance display in check-in UI expects `venueLatitude` & `venueLongitude`. | Tech Lead | Update `check-in/page.tsx` to display venue verification status rather than computing distance client-side; server `POST /api/check-in` returns distance on error. | Resolved (D5) |
| 2 | Rate-limiting in multi-instance environments. | Tech Lead | Current deployment is single-instance Node.js server; in-memory sliding window provides immediate protection without external Redis dependency. | Resolved |

## Open questions carried from intent.md
- [x] Redaction strategy for departments endpoint: Resolved in D5.

## Measurement
- Leading: Time from intent acceptance to spec acceptance.
- Lagging: Zero security regressions or bug reports during testing.
