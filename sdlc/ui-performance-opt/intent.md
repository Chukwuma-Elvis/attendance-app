# Intent: UI Performance Optimization for Attendance App

## Source Document
- Date: 2026-11-04
- Originator: User (via Claude Code)
- Product Owner: User

## What is wanted
Optimize the attendance app to run faster and smoother with improved UI responsiveness across all screen sizes.

## Why
The current app has performance and UI responsiveness issues that affect user experience:
- Check-in page: ~1200 lines of heavy client-side code
- Month summary page: ~900 lines with complex calendar/grid calculations
- Employee modal: ~1350 lines with multiple tabs and state
- Missing memoization causing unnecessary re-renders
- Large tables may benefit from virtualization

## Under which constraints
1. **No new dependencies** - Keep bundle size minimal (no React Query/SWR)
2. **Maintain existing functionality** - All features must work exactly as before
3. **Mobile-first** - Critical path is employee check-in on phones
4. **React 18 + Next.js 16** - Use current stack features
5. **Tailwind CSS** - Keep styling approach consistent
6. **PostgreSQL/Prisma** - Database queries already optimized
7. **WebAuthn biometrics** - Cannot change authentication flow

## Success criteria (measurable)
- Page load time < 2 seconds on 3G network
- First Input Delay (FID) < 100ms on mobile devices
- Bundle size reduction: at least 15% smaller
- Eliminate unnecessary re-renders (React Profiler)
- Calendar month view renders in < 500ms with 50+ employees
- No console warnings or performance warnings

## Open questions (UNRESOLVED)
1. Should we implement virtualization for large tables? (needs user answer)
2. Which performance metrics should we prioritize? (needs user answer)
3. Any specific pain points the user has experienced?