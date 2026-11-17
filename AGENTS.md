<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Attendance App (Next.js & Biometrics)

Context for AI agents and team members working in this repository.

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Lint: `npm run lint`

## Conventions
- Next.js 16 App Router, React 18, TypeScript strict, Prisma ORM.
- **Security Baseline:**
  - Strict primitive validation on all ID parameters (`isValidId`). Never pass unvalidated request objects directly into Prisma queries.
  - Never return raw `error.message` or stack traces in HTTP 500 responses; always use sanitized generic messages.
  - Never expose raw venue GPS coordinates, employee roles, or password/pin hashes on public unauthenticated endpoints.
  - Geofencing must be authoritatively verified on the server side (`POST /api/check-in`).

## Architecture
- `src/app/api/`: Next.js App Router route handlers.
- `src/app/check-in/`: Mobile employee geolocation & biometric/PIN check-in interface.
- `src/lib/`: Core utilities (`db.ts`, `geo.ts`, `webauthn.ts`, `pin.ts`, `validation.ts`, `rate-limit.ts`).
- `prisma/`: Database schema and migrations.

## Mistakes to avoid
- Passing raw request JSON bodies containing nested objects into Prisma `where` clauses (causes Prisma crashes and stack trace leaks).
- Relying on client-side geofencing distance calculations rather than server-side validation.

## Verifying your work
- `npm run build` (must finish with zero errors).

## Lifecycle work in progress
Per-change artifacts live in `sdlc/<change-slug>/`. Before doing any work on a change, read its `WORKLOG.md` first: it holds the current state, the next action, every decision made so far, and the agreed conventions. Continue from its "Resume here" section, follow its decisions and conventions, and update it as you work. Then read `intent.md`, `spec.md` and `plan.md` before changing code for that change.
Active change: `sdlc/attendance-ci-cd/WORKLOG.md`.
Completed changes: `sdlc/pentagi-security-hardening/WORKLOG.md`.
