# Profile Search

## Overview

Adds the public landing-page search endpoint:

```txt
GET /search?q={query}
```

The endpoint searches published profiles by full name and username using PostgreSQL `pg_trgm`, then returns the profile-card fields needed by the frontend.

## Endpoint

```txt
GET /search
```

Public endpoint. No authentication is required.

The app normally prefixes routes with `/api`, but `search` is excluded from the global prefix so the public route is exactly `/search`.

## Query Parameters

| Parameter | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| q         | string | Yes      | Search term. Minimum 2 characters. |

## Response

The service returns:

```json
{
  "results": [
    {
      "username": "adebayo",
      "fullName": "Adebayo Johnson",
      "bio": "Backend engineer and product builder.",
      "photoUrl": "https://example.com/adebayo.jpg",
      "isVerified": false
    }
  ],
  "total": 1
}
```

In the running app, the global response interceptor wraps this as:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "username": "adebayo",
        "fullName": "Adebayo Johnson",
        "bio": "Backend engineer and product builder.",
        "photoUrl": "https://example.com/adebayo.jpg",
        "isVerified": false
      }
    ],
    "total": 1
  }
}
```

If no profiles match, the endpoint returns HTTP `200` with:

```json
{
  "results": [],
  "total": 0
}
```

wrapped by the same global interceptor.

## Search Logic

- Searches `full_name` and `username`.
- Uses PostgreSQL `pg_trgm` with the trigram `%` operator.
- Orders exact username matches above partial matches.
- Orders remaining results by highest trigram similarity score.
- Includes only profiles where `is_published = true`.
- Excludes soft-deleted profiles where `deleted_at IS NOT NULL`.
- Limits responses to 20 results.
- Truncates `bio` to 120 characters.
- Uses parameterized query values to prevent SQL injection.

## Schema Changes

Profile search fields were added to the existing `users` table:

- `username`
- `bio`
- `photo_url`
- `is_published`

The migration also installs `pg_trgm`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

and creates trigram indexes:

```sql
CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
ON users USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_username_trgm_idx
ON users USING GIN (username gin_trgm_ops);
```

## Files Changed

- `src/modules/search/search.module.ts`
- `src/modules/search/search.controller.ts`
- `src/modules/search/search.service.ts`
- `src/modules/search/dto/search-query.dto.ts`
- `src/modules/users/entities/user.entity.ts`
- `src/database/migrations/1778520370661-AddProfileSearchFields.ts`
- `src/app.module.ts`
- `src/main.ts`

The old users search DTO was removed:

- `src/modules/users/dto/search-query.dto.ts`

## Error Responses

| Status | Condition                                     |
| ------ | --------------------------------------------- |
| 400    | `q` is missing, blank, or under 2 characters. |
| 429    | Rate limit exceeded.                          |

Short queries return:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Please enter at least 2 characters to search."
}
```

## Rate Limiting

The search endpoint is limited to 60 requests per minute per IP:

```ts
@Throttle({ default: { ttl: 60_000, limit: 60 } })
```

Swagger/manual testing confirmed the response includes:

```txt
x-ratelimit-limit: 60
```

## Verification

Manual Swagger tests:

- `GET /search?q=ade` returns a published matching profile.
- `GET /search?q=q` returns HTTP `400` with `Please enter at least 2 characters to search.`
- Empty search results return HTTP `200` with `{ results: [], total: 0 }` inside the app response wrapper.

Build verification:

```bash
npm run format
npm run build
```

Local latency sample:

```json
{
  "total": 50,
  "concurrency": 5,
  "statuses": {
    "200": 50
  },
  "p95_ms": 96.02
}
```

This local sample is under the 200ms p95 target. Production-like p95 should still be validated in staging with realistic data volume.
