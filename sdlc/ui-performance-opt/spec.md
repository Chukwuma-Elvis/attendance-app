# Design Document: UI Performance Optimization for Attendance App

## Derived from
[intent.md](intent.md)

## Functional Requirements

### R1 - React Component Optimization
**Requirement:** Reduce unnecessary re-renders in all pages
**Acceptance Criteria:**
- Month summary grid with 50 employees and 30 days renders in < 500ms
- Check-in page state changes (location, PIN entry) trigger minimal re-renders
- Admin sidebar stays stable when navigating between pages

### R2 - Virtualization for Large Tables
**Requirement:** Implement virtualization for month grid view (30+ columns x 50+ rows)
**Acceptance Criteria:**
- Month summary page uses react-virtual for calendar grid
- Only visible rows rendered in DOM at any time
- Scroll performance remains smooth at 60fps

### R3 - Data Fetching Optimization
**Requirement:** Improve data fetching without adding new dependencies
**Acceptance Criteria:**
- API responses cached client-side for 5 minutes
- Duplicate requests deduplicated within same component lifecycle
- Loading states properly managed with race condition handling

### R4 - Mobile Performance
**Requirement:** Optimize mobile experience for check-in portal
**Acceptance Criteria:**
- Page load < 2 seconds on simulated 3G network
- FID < 100ms during initial render
- GPS/location prompt appears immediately on page load

### R5 - Bundle Size Reduction
**Requirement:** Reduce JavaScript bundle size by 15%
**Acceptance Criteria:**
- Tree-shaking properly configured for Tailwind
- Unused code paths removed
- Modal components lazy-loaded

## Non-Functional Requirements

### N1 - Performance Benchmarks
- Initial bundle size < 500KB gzipped
- Time to Interactive < 2 seconds on mobile 4G
- No memory leaks detected in React Profiler

### N2 - Code Quality
- All existing tests pass
- No TypeScript errors
- ESLint rules maintained (existing patterns)

### N3 - Accessibility
- All optimizations preserve existing accessibility
- No color/contrast changes that affect readability
- Keyboard navigation preserved

## Design Decisions

### Components to Optimize

1. **src/app/check-in/page.tsx**
   - Split into smaller components: LocationStatus, AuthModeTabs, CheckActionButtons, ResultNotification
   - Extract expensive calculations to useMemo/useCallback
   - Optimize GPS polling logic

2. **src/app/admin/attendance/page.tsx**
   - Add react-virtual for the employee list
   - Memoize filtered/sorted employee data
   - Optimize status dropdown rendering

3. **src/app/admin/month-summary/page.tsx**
   - Implement virtual calendar grid with react-virtual
   - Extract color logic to precomputed maps
   - Memoize calendar day calculations

4. **src/app/admin/employees/EmployeeCalendarModal.tsx**
   - Split into CalendarTab and SettingsTab components
   - Use lazy loading for heavy UI elements
   - Optimize state updates with batching

### Architecture Changes

1. **Utility Functions**
   - Move `formatCurrency`, `toISODateUTC` to shared utilities with memoization
   - Create `useIntersectionObserver` hook for lazy loading patterns

2. **Code Splitting Strategy**
   - Load EmployeeCalendarModal only when opened
   - Load month-summary page data on-demand for tabs

3. **Data Fetching Pattern**
   - Use AbortController for request cancellation
   - Implement simple in-memory cache for recently fetched data
   - Maintain existing fetch patterns (no new libraries)

### Areas of Concern

1. **Backward Compatibility** - Cannot change any API responses or data structures
2. **Mobile Constraints** - Must not increase bundle size on mobile devices
3. **Existing State** - All localStorage preferences must be preserved

## Unanswered Questions

Q1: Virtualization dependency - should we install `react-virtual` (small) or build custom?
  - Recommendation: Use `@tanstack/react-virtual` (lighter than `react-virtual`)

Q2: Should we implement server-side rendering optimizations?
  - The app already uses React Server Components for admin pages
  - Check-in page is client-only (WebAuthn requires it)