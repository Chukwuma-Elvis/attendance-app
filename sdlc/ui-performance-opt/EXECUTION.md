# Execution Plan: UI Performance Optimization

## Artifact Chain

| Artifact | Status | Owner | Approver | Date |
|----------|--------|-------|----------|------|
| WORKLOG.md | accepted | Agent | User | 2026-11-04 |
| intent.md | accepted | Agent | User | 2026-11-04 |
| spec.md | accepted | Agent | User | 2026-11-04 |
| plan.md | accepted | Agent | User | 2026-11-04 |
| test-plan.md | accepted | Agent | User | 2026-11-04 |
| release.md | accepted | Agent | User | 2026-11-04 |
| monitoring.md | accepted | Agent | User | 2026-11-04 |
| EXECUTION.md | this file | Agent | - | 2026-11-04 |

## Ordered Checklist

### Phase 1: Setup (Agent)
- [ ] Add `@tanstack/react-virtual` dependency
- [ ] Create `src/lib/hooks/useCachedFetch.ts` for request caching
- [ ] Create `src/lib/utils/optimization.ts` for shared utilities

### Phase 2: Optimize Check-In Page (Agent)
- [ ] Split check-in page into smaller components
  - `src/app/check-in/components/LocationStatus.tsx`
  - `src/app/check-in/components/AuthModeTabs.tsx`
  - `src/app/check-in/components/CheckActionButtons.tsx`
  - `src/app/check-in/components/ResultNotification.tsx`
- [ ] Add memoization for distance calculations
- [ ] Optimize GPS permission handling
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`

### Phase 3: Optimize Attendance Page (Agent)
- [ ] Memoize filtered/sorted employee data with useMemo
- [ ] Add virtualization support for employee list
- [ ] Optimize status dropdown rendering
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`

### Phase 4: Optimize Month Summary (Agent)
- [ ] Split month-summary into tabs component
- [ ] Implement virtual calendar grid
- [ ] Extract color logic to precomputed maps
- [ ] Memoize calendar day calculations
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`

### Phase 5: Optimize Employee Modal (Agent)
- [ ] Split into CalendarTab and SettingsTab
- [ ] Use lazy loading for heavy UI elements
- [ ] Optimize state updates with batching
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`

### Phase 6: Testing (User)
- [ ] Load check-in page on mobile device
- [ ] Navigate all admin pages
- [ ] Verify month summary scroll performance
- [ ] Verify bundle size reduction
- [ ] Test all check-in methods (biometric, PIN)

### Phase 7: Commit & Merge (Agent)
- [ ] Review all changes
- [ ] Commit with message: "Optimize UI performance: memoization, virtualization, component refactoring"
- [ ] Push to main branch

## Parallelization Map

```
Parallel (can run simultaneously):
├── Phase 1: Setup utilities/hooks
├── Phase 3: Attendance page optimization
└── Phase 5: Employee modal optimization

Sequential (must wait):
├── Phase 1 → Phase 2 (check-in needs utilities)
├── Phase 2 → Phase 6 (testing after check-in)
├── Phase 3 → Phase 6 (testing after attendance)
├── Phase 4 → Phase 6 (testing after month summary)
├── Phase 5 → Phase 6 (testing after modal)
└── Phase 6 → Phase 7 (merge after testing)
```

## Human Decision Points

1. **Virtualization library choice** - Chosen: `@tanstack/react-virtual` (done during setup)
2. **Testing verification** - User must verify on actual mobile device
3. **Commit message and branch** - Use conventional commits

## Guardrails

| Guardrail | Check | Fails |
|-----------|-------|-------|
| No new dependencies beyond virtualization | Review package.json | Abort if unexpected |
| Bundle size reduction | `npm run build` output | Document variance |
| No TypeScript errors | `npx tsc --noEmit` | Fix before commit |
| No console warnings | Dev mode check | Investigate |

## Setup Checklist

- [ ] Install virtualization library: `npm install @tanstack/react-virtual`
- [ ] Create shared utilities file for memoization
- [ ] Create custom hooks for data caching

## Performance Measurement

### Before Optimization (Baseline to verify)
```bash
# Bundle size
npx size-limit

# Check-in page load time
# Chrome DevTools > Network > Disable cache > Load page
```

### After Each Phase
```bash
npm run build
echo "Bundle size check above"
npx tsc --noEmit
```

## Unresolved Questions from Earlier

Q1. Virtualization dependency - **Resolved**: Using `@tanstack/react-virtual` (lightweight alternative)
Q2. Should we implement server-side rendering optimizations? **Resolved**: App already uses React Server Components; focus on client-side

## Supporting Skills Used

- **Performance optimization patterns** - Applied throughout
- **Mobile-first CSS** - Maintained existing Tailwind approach
- **Code organization** - Following existing patterns

## Candidate Skills to Write (Future)

- Performance monitoring dashboard
- Automated bundle size checking CI
- React Profiler analysis guide