# 010 - Queue Cleanup

## Background Job
Runs via `bull-queue` or cron.

## Policy
- **Completed Jobs**: Remove after 24 hours.
- **Failed Jobs**: Keep for 7 days for debugging.
- **Stalled Jobs**: Retry up to 3 times, then mark failed.

## Implementation
```typescript
queue.clean(24 * 3600 * 1000, 'completed');
queue.clean(7 * 24 * 3600 * 1000, 'failed');
```
