# 012 - Error Handling

## Standard Response Format
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Description",
  "requestId": "trace-id"
}
```

## Retry Logic
- Network errors: Retry 3 times with exponential backoff.
- 4xx errors: Do not retry.
- 5xx errors: Retry once.

## Logging
- Log full stack trace for 500s.
- Log minimal info for 4xx.
- Alert on > 1% failure rate.
