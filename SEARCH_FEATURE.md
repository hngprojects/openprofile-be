# User Search & Discovery

## Overview
Adds `GET /users/search` to the existing Users module, enabling case-insensitive discovery of users by name with filtering, sorting, and pagination.

## Endpoint
GET /api/users/search

Public endpoint — no authentication required.

## Query Parameters

| Parameter | Type    | Required | Description                          |
|-----------|---------|----------|--------------------------------------|
| q         | string  | Yes      | Search term (2–100 chars)            |
| page      | integer | No       | Default: 1                           |
| limit     | integer | No       | Default: 20, Max: 50                 |
| verified  | boolean | No       | Filter to verified users only        |
| role      | string  | No       | Filter by role: `admin` or `user`    |
| sort      | string  | No       | `az`, `za`, `newest`, `oldest`       |

## Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fullName": "Calvin Iordye",
      "role": null,
      "isVerified": false,
      "createdAt": "2026-05-10T11:59:24.644Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

## What Changed

- `src/modules/users/dto/search-query.dto.ts` — new DTO with class-validator
- `src/modules/users/users.service.ts` — added `search()` method
- `src/modules/users/users.controller.ts` — added `GET /users/search` handler
- `src/modules/users/actions/user.action.ts` — exposed `createQueryBuilder()`

## Design Decisions

- Extends the existing Users module — no new module or infrastructure needed
- Uses PostgreSQL `ILIKE` for case-insensitive search on `fullName`
- `q` is trimmed before validation to prevent whitespace-only queries
- Sensitive fields (`email`, `password`, `otpHash`, `refreshTokenHash`) are never returned
- Soft-deleted users (`deletedAt IS NOT NULL`) are excluded from results
- Empty results return `data: []` — never a 404

## Error Responses

| Status | Condition |
|--------|-----------|
| 400    | `q` missing or less than 2 characters |
| 422    | Invalid parameter format |
| 429    | Rate limit exceeded |

## Testing
Tested manually via Swagger at `/docs`. All scenarios verified:
- Case-insensitive search
- Sorting (az, za, newest, oldest)
- Pagination
- Verified and role filters
- Empty results
- Sensitive field exclusion