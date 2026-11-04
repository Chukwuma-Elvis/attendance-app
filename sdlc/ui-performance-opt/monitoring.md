# Maintenance Document: Performance Monitoring

## Derived from
[release.md](release.md)

## Metrics to Track

### Performance Bands
- **Target Bundle Size**: < 500KB gzipped
- **Target Check-in Load**: < 2 seconds on 3G
- **Target Re-render**: < 100ms per state change

### Control Bands
| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Bundle size | < 500KB | 500-600KB | > 600KB |
| Check-in load | < 2s | 2-3s | > 3s |
| Re-render time | < 100ms | 100-200ms | > 200ms |

## Response Tiers

### Tier 1: Logs Only
- Minor performance variance within normal band
- No user impact

### Tier 2: Read-only Diagnosis (Agent)
- User reports slow check-in page
- Agent profile: Use React DevTools to identify hot paths
- Action: Record findings in INCIDENT.md

### Tier 3: Agent Actions
- Bundle size > 600KB
- Requires opening a PR with optimization changes
- Must pass review before merge

## How to Create a New Intent

If performance degrades significantly:
1. Create issue: "Performance regression in check-in page"
2. Document symptoms, browser, network conditions
3. Include React Profiler screenshot
4. Use SDLC process with this as source: `SDLC` / start from problem description

## Incident Channel

- **Issue Track**: GitHub Issues (repo-based)
- **Post-mortems**: Will be written as `lessons/<date>-<slug>.md` if major regression

## Monitoring Methods

### Manual (No Automated Monitoring)
- This is a small internal app, no dedicated monitoring needed
- Performance checked during development and CI

### CI Integration (Future)
```json
// package.json script to measure bundle
"bundle:check": "size-limit --ci"
```

## Eval Suite

No automated eval suite currently exists. Future improvements:
- 20-50 real optimization tasks with accepted outcomes
- Run on schedule and on changes to AGENTS.md

## Maintenance Actions Log

| Date | Action | Why |
|------|--------|-----|
| 2026-11-04 | Initial setup | Performance optimization initiative |