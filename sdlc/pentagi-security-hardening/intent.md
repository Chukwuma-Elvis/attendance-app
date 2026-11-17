# Intent: PentAGI Security Hardening

Author: Antigravity (Security Swarm Remediator) · Product owner: Tech Lead (User) · Status: accepted
Created: 2026-11-17 · Accepted: 2026-11-17 by Tech Lead (User)
Source document: `PENTAGI_SECURITY_REPORT.md` · Entry route: incident / security audit report
Source of truth: repository
Supporting skills: modern-web-guidance (`C:\Users\CHUKWUMA\.gemini\config\plugins\modern-web-guidance-plugin\skills\modern-web-guidance\SKILL.md`)

## Problem
An independent automated penetration test and security audit conducted by PentAGI Autonomous Multi-Agent Swarm identified four security vulnerability classes across the Next.js attendance application:
1. **Critical PII & GPS Metadata Exposure (`GET /api/check-in/departments`):** An unauthenticated public endpoint returns sensitive organizational metadata, including exact venue GPS coordinates (`venueLatitude`, `venueLongitude`, `venueRadiusMeters`), shift boundaries, and full employee rosters containing internal roles (e.g. Models, Dancers) and queries referencing `pinHash`.
2. **Medium Prisma ORM Query Manipulation & Path Disclosure (`POST /api/biometrics/*`):** Endpoints (`auth-options`, `register-options`, `request-reset`) lack primitive type validation on `employeeId`. Injecting object payloads (e.g. `{"$gt": ""}`) triggers unhandled Prisma query exceptions resulting in HTTP 500 Internal Server Errors that leak verbose stack traces, raw query structures, and internal Windows paths (e.g., `C:\Users\CHUKWUMA\projects\attendance-app\.next\...`).
3. **Medium Employee Enumeration & Biometric Oracle:** Unauthenticated, un-rate-limited callers can probe arbitrary employee IDs to discover valid employees and their biometric registration states.
4. **Low Missing Security Headers & Framework Fingerprinting:** The application lacks defensive headers (`Content-Security-Policy`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) and exposes `X-Powered-By: Next.js`.

## Proposed outcome
A hardened, attack-resilient attendance application where:
- Unauthenticated endpoints do not disclose confidential venue GPS coordinates, employee roles, or internal credential flags.
- Geofencing verification remains enforced server-side upon check-in submission (`POST /api/check-in`) without requiring client-side coordinate leakage.
- All API route boundaries enforce strict primitive schema validation (rejecting unexpected objects/arrays) and return sanitized, generic error responses that never leak internal stack traces or filesystem paths.
- Biometric endpoints implement anti-enumeration defenses and rate limiting.
- The application emits OWASP-recommended defensive security headers and suppresses framework fingerprinting.

## Affected users and systems
- **Users:**
  - Employees performing mobile check-in and biometric/PIN registration.
  - Organization administrators managing venues, shifts, and biometric reset approvals.
- **Systems:**
  - Route handlers: `src/app/api/check-in/departments/route.ts`, `src/app/api/check-in/route.ts`, and `src/app/api/biometrics/*`.
  - Client interface: `src/app/check-in/page.tsx`.
  - Next.js server configuration: `next.config.mjs`.

## Constraints
- **Zero Functionality Regression:** Existing valid employee check-in (WebAuthn biometric passkey, PIN fallback, geofence radius validation, custom shift windows) must continue to function seamlessly.
- **No External Paid Infrastructure:** Security controls, validation, and rate limiting must execute in-process within Next.js / Node.js without requiring external paid cloud services.
- **Strict TypeScript & Build Integrity:** Must compile cleanly with `npm run build` and `npx tsc --noEmit`.

## Out of scope
- Complete visual UI overhaul of the attendance dashboard or check-in screen.
- Replacing Prisma ORM or the underlying SQLite/Postgres database engine.
- Modifying WebAuthn cryptography or replacing `@simplewebauthn` libraries.

## Success criteria
- `GET /api/check-in/departments` strips raw latitude, longitude, and internal employee roles from public responses.
- Malformed payloads (such as `{"employeeId": {"$gt": ""}}`) submitted to `/api/biometrics/*` return clean HTTP 400 Bad Request responses with sanitized error messages.
- HTTP 500 responses return generic sanitized strings (e.g. `Internal Server Error`) and zero file system paths or stack traces in responses.
- `next.config.mjs` disables `poweredByHeader` and injects defensive headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
- Clean build passes (`npm run build`).

## Open questions
- [x] Should `GET /api/check-in/departments` retain minimal public data (department name, employee name/id for dropdown selection) with GPS coordinates and roles stripped, while keeping client check-in frictionless? · answered: Yes, redact coordinates (`venueLatitude: null`, `venueLongitude: null`, `venueRadiusMeters: 0`) and roles; let server validate geofence strictly during check-in submission (`POST /api/check-in`). Resolved in D5.

## Measurement
- Leading: Time from intake to accepted `intent.md`.
- Lagging: 100% pass rate on a reproducible verification test suite executing injection attacks, unauthenticated enumeration, and header inspections.
