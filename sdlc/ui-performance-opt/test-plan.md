# Test Plan: UI Performance Optimization

## Derived from
[plan.md](plan.md)

## Feedback Loop

### Build Check
```bash
npm run build
# Expected: All builds pass without errors, ~15% bundle size reduction
```

### Type Check
```bash
npx tsc --noEmit
# Expected: No TypeScript errors
```

### Lint Check
```bash
npx eslint src/**/*.ts* --fix
# Expected: No lint errors (existing patterns maintained)
```

## Verification Commands

### Manual Verification Steps
1. Load check-in page - should show immediately with GPS prompt
2. Navigate between admin pages - no flash of unstyled content
3. Month summary grid - scroll smoothly with 50+ employees
4. Toggle filters/sorting - immediate update, no jank

### Performance Metrics (Manual)
| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Bundle size (gzipped) | ~587KB | < 500KB | `npm run build` output |
| Check-in page load | TBD | < 2s (3G) | Chrome DevTools Network tab |
| Re-renders (check-in) | Multiple | Minimal | React DevTools Profiler |
| Month grid scroll | May jank | Smooth 60fps | Manual scrolling |

## Requirement-to-Test Traceability

| Requirement ID | Test |
|---------------|------|
| R1 | React Profiler: verify minimal re-renders after memoization |
| R2 | Scroll through month summary with 50+ employees - should be smooth |
| R3 | Check network tab - no duplicate simultaneous requests |
| R4 | Simulated 3G: check-in page loads in < 2s |
| R5 | `npm run build`: verify bundle size reduction |

## Test Files
No test files exist in this project (per codebase analysis). All verification will be manual and through build checks.

## Regression Tests
1. All admin pages render correctly after optimization
2. Employee check-in works with biometric auth
3. PIN check-in function works
4. Attendance marking saves correctly
5. Month summary exports Excel/PDF correctly