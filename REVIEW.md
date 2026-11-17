# Review instructions

Applied to every pull request or security patch, whether a human or an agent reviews it. Findings inform the decision; the Tech Lead approves the merge. The agent that wrote a change never approves it.

## Passes
Run these passes and tag each finding with its pass:
- **Bugs**: logic errors, broken check-in edge cases, clock/geofence discrepancies.
- **Security**: 
  - Input validation: ensure no raw objects are passed to Prisma `where` clauses.
  - Information disclosure: ensure no raw GPS coordinates, pin hashes, or employee roles are exposed publicly.
  - Error hygiene: ensure no internal stack traces or file system paths are returned in HTTP 500 responses.
  - Rate limiting: verify rate limiting is present on brute-forceable authentication/biometric endpoints.
- **Compliance**: the change matches `sdlc/pentagi-security-hardening/spec.md` and `plan.md`. Flag any drift.
- **Performance**: ensure validation and rate limiting overhead remains < 5ms.

## Severity
- **Important**: would break behavior, leak sensitive metadata, or breach security baseline. Must be resolved before merge.
- **Nit**: style, naming, minor readability.

## Cap the nits
Report at most 5 nits per review; summarize the rest as a count.

## Do not report
- Generated files under `.next/` or `node_modules/`.
- Next.js development banner blocks managed automatically by Next.js.

## Feedback into AGENTS.md
When a review flags the same mistake for the second time, add the correction to `AGENTS.md` in the same commit.

## Tuning
The Tech Lead rates findings and adjusts this file periodically.
