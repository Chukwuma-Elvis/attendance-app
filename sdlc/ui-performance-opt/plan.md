# Build Plan: UI Performance Optimization for Attendance App

## Derived from
[spec.md](spec.md)

## Files That Will Change

| Priority | File | Action | Description |
|----------|------|--------|-------------|
| 1 | `src/app/check-in/page.tsx` | Major refactor | Split into smaller components, add memoization |
| 2 | `src/app/admin/attendance/page.tsx` | Add optimizations | Memoize data, add virtualization support |
| 3 | `src/app/admin/month-summary/page.tsx` | Major refactor | Virtualize calendar grid, extract color logic |
| 4 | `src/app/admin/employees/EmployeeCalendarModal.tsx` | Major refactor | Split into tabs, lazy load heavy sections |
| 5 | `src/app/admin/WeeklyAttendanceTable.tsx` | Minor optimize | Memoize filtered rows |
| 6 | `src/app/admin/MobileSidebar.tsx` | Add caching | Cache session data, deduplicate fetches |
| 7 | `src/app/login/page.tsx` | Minor optimize | Optimize form submission |
| 8 | `src/lib/geo.ts` | Refactor | Extract and memoize distance calculations |

## Order of Work

```
1. Create shared utilities and hooks
2. Optimize check-in page (highest impact on mobile users)
3. Optimize attendance page
4. Optimize month summary page (largest table)
5. Optimize employee modal
6. Add virtualization support
7. Update styling/utilities
8. Test and verify
```

## Risks

1. **Breaking existing functionality** - Mitigated by comprehensive testing
2. **Increased complexity** - Mitigated by splitting into focused, smaller components
3. **Bundle size increase from virtualization** - Mitigated by using lightweight `@tanstack/react-virtual`

## Parallelizable Tasks

These can be worked on in isolated workspaces:
- Step 1: Create shared utilities (no file conflicts)
- Step 3: Optimize attendance page
- Step 5: Optimize employee modal

These must be sequential:
- Step 2 → Step 6 (check-in requires utilities)
- Step 4 → Step 6 (month summary requires utilities)
- Step 7 → Step 8 (style updates before testing)

## Verification

Each optimization must pass:
1. TypeScript compilation: `npx tsc --noEmit`
2. Build succeeds: `npm run build`
3. No console errors in dev mode
4. Manual verification on mobile device