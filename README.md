# OpenProfile Backend - OTP Verification Implementation

## Summary

Added OTP verification and resend functionality to the authentication module.

## What changed and why

### 1. Created new DTOs
- `src/modules/auth/dto/verify-otp.dto.ts`: Defines the structure for OTP verification requests (email and 6-digit OTP)
- `src/modules/auth/dto/resend-otp.dto.ts`: Defines the structure for OTP resend requests (email only)

### 2. Enhanced AuthService
- Added `verifyOtp()` method that implements the complete OTP verification flow:
  - Validates email exists (case-insensitive)
  - Checks if account is already verified (returns 409 if true)
  - Verifies OTP hasn't expired (returns 410 if expired)
  - Validates OTP against stored hash using bcrypt (returns 400 if invalid)
  - Clears OTP data and marks account as verified on success
  - Generates and sets JWT access (15min) and refresh (7day) tokens as HTTP-only cookies
  - Returns user data (id, email, role, onboardingComplete) in response body
  
- Added `resendOtp()` method that implements OTP resend functionality:
  - For security, always returns 200 regardless of email existence (prevents enumeration)
  - Returns 409 if account already verified
  - Implements rate limiting (3 requests per 60 minutes per email) using Redis via @nest-lab/throttler-storage-redis
  - Invalidates previous OTP before generating new one
  - Generates new 6-digit OTP, hashes it, and stores with 5-minute expiry
  - Sends OTP via email service

### 3. Enhanced AuthController
- Added POST `/auth/verify-otp` endpoint that delegates to AuthService.verifyOtp()
- Added POST `/auth/resend-otp` endpoint that delegates to AuthService.resendOtp()

### 4. Updated User Entity
- Added `onboardingComplete: boolean` column to user.entity.ts to track onboarding status

### 5. Added Redis Service
- Created `src/common/service/redis.service.ts` for direct Redis operations
- Created `src/common/common.module.ts` to export the RedisService
- Added Redis configuration through existing environment variables

### 6. Updated Module Imports
- Added RedisService to CommonModule
- Added CommonModule to AppModule imports
- Enhanced AuthModule with ThrottlerModule and ThrottlerStorageRedisService for rate limiting

## Related issues

- Implements OTP verification and resend functionality as specified in requirements

## Checklist

- [x] `npm run lint` passes
- [x] `npm run build` passes
- [ ] Tests added or updated (TODO: Add unit and integration tests)
- [x] Documentation updated (this README)

## Notes

- The implementation follows security best practices:
  - Passwords and OTP hashes are bcrypt hashed
  - OTP verification is case-insensitive for email
  - Rate limiting prevents abuse of resend endpoint
  - HTTP-only, Secure, SameSite=Strict cookies are used for tokens
  - Account enumeration is prevented via consistent responses in resend endpoint
  - OTP data is cleared after successful verification to prevent reuse
- The rate limiting implementation uses @nest-lab/throttler-storage-redis which integrates with NestJS Throttler
- Tokens are set as cookies rather than returned in response body for improved security