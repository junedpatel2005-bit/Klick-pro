# Servio API contract

The browser must call versioned URLs under `/api/v1`. The compatibility rewrite in
`next.config.ts` routes existing version-one calls to the current handlers while the
application is migrated to physical versioned route folders.

## Response format

New and migrated endpoints use one consistent envelope:

```json
{ "data": {} }
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A title is required.",
    "details": { "field": "title" }
  }
}
```

## Access groups

| Area                   | Prefix                                 | Intended caller                          |
| ---------------------- | -------------------------------------- | ---------------------------------------- |
| Authentication         | `/api/v1/auth/*`                       | Public/current session                   |
| Client workspace       | `/api/v1/client/*`                     | Client account                           |
| Professional workspace | `/api/v1/professional/*`               | Professional account                     |
| Shared project portal  | `/api/v1/portal/*`                     | Project client or professional           |
| Marketplace            | `/api/v1/marketplace/*`                | Public/authenticated marketplace visitor |
| Administration         | `/api/v1/admin/*`                      | Administrator only                       |
| Public website         | `/api/v1/website/*`, `/api/v1/contact` | Public website visitor                   |

## Route inventory

The executable route inventory is in `app/api/**/route.ts`; `openapi.yaml` documents
the stable, externally consumed endpoints. Before adding an endpoint, add its method,
authorization requirement, request schema, successful response, and error responses to
`openapi.yaml`, then add an automated test for its permission boundary.

## Production requirements

- Set `AUTH_SECRET`.
- Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` to enable server and browser reporting.
- Set `FILE_STORAGE_PROVIDER=s3` plus bucket credentials before accepting production files.
- Do not expose direct database URLs, SMTP credentials, storage credentials, or admin
  bootstrap credentials to browser code.
