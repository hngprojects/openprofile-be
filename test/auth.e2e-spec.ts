import {
  INestApplication,
  ValidationPipe,
  UnprocessableEntityException,
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';

// ─── DTO (mirrors LoginDto) ───────────────────────────────────────────────────

class LoginTestDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  authProvider: 'email' | 'google';
  isVerified: boolean;
  onboardingComplete: boolean;
  role: string | null;
  lastLoginIp: string | null;
}

// ─── In-memory state (module-scoped so all helpers share the same maps) ───────

const userStore = new Map<string, MockUser>();
const failedAttempts = new Map<string, number>();
const lockedAccounts = new Set<string>();
const ipRequestCounts = new Map<string, number>();

const IP_RATE_LIMIT_MAX = 10;
const BRUTE_MAX_ATTEMPTS = 5;

function resetTransientState() {
  failedAttempts.clear();
  lockedAccounts.clear();
  ipRequestCounts.clear();
}

// ─── Inline controller (mirrors auth.service login logic) ────────────────────

@Controller('auth')
class MockLoginController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginTestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    // ── IP rate limit ─────────────────────────────────────────────────────────
    const ipCount = (ipRequestCounts.get(ip) ?? 0) + 1;
    ipRequestCounts.set(ip, ipCount);
    if (ipCount > IP_RATE_LIMIT_MAX) {
      throw new HttpException(
        {
          error: 'IP_RATE_LIMIT_EXCEEDED',
          message:
            'Too many requests. Please wait 15 minutes before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── User lookup ───────────────────────────────────────────────────────────
    const user = userStore.get(dto.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect.',
      });
    }

    // ── Provider check ────────────────────────────────────────────────────────
    if (user.authProvider !== 'email') {
      throw new BadRequestException({
        error: 'WRONG_PROVIDER',
        message: `This account was created with ${user.authProvider}. Please use the Continue with ${user.authProvider} button.`,
      });
    }

    // ── Email verification ────────────────────────────────────────────────────
    if (!user.isVerified) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        message: 'Please verify your email address before logging in.',
      });
    }

    // ── Account lock ──────────────────────────────────────────────────────────
    if (lockedAccounts.has(user.email)) {
      throw new HttpException(
        {
          error: 'ACCOUNT_LOCKED',
          message:
            'Your account has been temporarily locked after too many failed attempts. Please try again in 30 minutes or reset your password.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── Password check ────────────────────────────────────────────────────────
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const attempts = (failedAttempts.get(user.email) ?? 0) + 1;
      failedAttempts.set(user.email, attempts);
      if (attempts >= BRUTE_MAX_ATTEMPTS) {
        lockedAccounts.add(user.email);
        failedAttempts.delete(user.email);
      }
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect.',
      });
    }

    failedAttempts.delete(user.email);

    // ── Set auth cookies ──────────────────────────────────────────────────────
    res.cookie('access_token', 'mock-access-token', {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', 'mock-refresh-token', {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
      },
    };
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Auth Login (e2e)', () => {
  let app: INestApplication<App>;

  // ── Fixtures ─────────────────────────────────────────────────────────────────
  const VALID_PASSWORD = 'ValidP@ssw0rd1!';
  let verifiedUser: MockUser;
  let unverifiedUser: MockUser;
  let googleUser: MockUser;

  beforeAll(async () => {
    // Hash is async – do it once in beforeAll
    verifiedUser = {
      id: crypto.randomUUID(),
      email: 'verified@example.com',
      passwordHash: await argon2.hash(VALID_PASSWORD),
      authProvider: 'email',
      isVerified: true,
      onboardingComplete: false,
      role: 'user',
      lastLoginIp: null,
    };
    userStore.set(verifiedUser.email.toLowerCase(), verifiedUser);

    unverifiedUser = {
      id: crypto.randomUUID(),
      email: 'unverified@example.com',
      passwordHash: await argon2.hash(VALID_PASSWORD),
      authProvider: 'email',
      isVerified: false,
      onboardingComplete: false,
      role: 'user',
      lastLoginIp: null,
    };
    userStore.set(unverifiedUser.email.toLowerCase(), unverifiedUser);

    googleUser = {
      id: crypto.randomUUID(),
      email: 'google@example.com',
      passwordHash: '',
      authProvider: 'google',
      isVerified: true,
      onboardingComplete: false,
      role: 'user',
      lastLoginIp: null,
    };
    userStore.set(googleUser.email.toLowerCase(), googleUser);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MockLoginController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new UnprocessableEntityException(
            errors.map((e) => ({
              field: e.property,
              error: Object.values(e.constraints ?? {}).join(', '),
            })),
          ),
      }),
    );
    await app.init();
  });

  afterEach(() => {
    // Reset per-request transient state between tests (not the user store)
    resetTransientState();
  });

  afterAll(async () => {
    userStore.clear();
    await app.close();
  });

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('200 – returns user object and sets httpOnly cookies on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: verifiedUser.email, password: VALID_PASSWORD })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.user.id).toBe(verifiedUser.id);
      expect(res.body.user.email).toBe(verifiedUser.email);
      expect(res.body.user.role).toBe(verifiedUser.role);
      expect(typeof res.body.user.onboardingComplete).toBe('boolean');

      // Auth cookies must be present
      const cookies = res.headers['set-cookie'] as string | string[];
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toContain('access_token=');
      expect(cookieStr).toContain('refresh_token=');
    });

    it('200 – email matching is case-insensitive', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: verifiedUser.email.toUpperCase(),
          password: VALID_PASSWORD,
        })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.user.email).toBe(verifiedUser.email);
    });

    it('401 – INVALID_CREDENTIALS on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: verifiedUser.email, password: 'WrongP@ssw0rd!' })
        .expect(401);

      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('401 – INVALID_CREDENTIALS on non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: VALID_PASSWORD })
        .expect(401);

      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('403 – EMAIL_NOT_VERIFIED when the account has not been verified', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: unverifiedUser.email, password: VALID_PASSWORD })
        .expect(403);

      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
      expect(res.body.email).toBe(unverifiedUser.email);
    });

    it('400 – WRONG_PROVIDER when account was created with Google', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: googleUser.email, password: VALID_PASSWORD })
        .expect(400);

      expect(res.body.error).toBe('WRONG_PROVIDER');
    });

    it('422 – validation error when email field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: VALID_PASSWORD })
        .expect(422);

      const fields = (res.body.message as Array<{ field: string }>).map(
        (e) => e.field,
      );
      expect(fields).toContain('email');
    });

    it('422 – validation error when password field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: verifiedUser.email })
        .expect(422);

      const fields = (res.body.message as Array<{ field: string }>).map(
        (e) => e.field,
      );
      expect(fields).toContain('password');
    });

    it('422 – validation error when email is an invalid format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: VALID_PASSWORD })
        .expect(422);

      const fields = (res.body.message as Array<{ field: string }>).map(
        (e) => e.field,
      );
      expect(fields).toContain('email');
    });

    it('422 – validation error when body is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(422);

      const fields = (res.body.message as Array<{ field: string }>).map(
        (e) => e.field,
      );
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    });

    it('429 – ACCOUNT_LOCKED after 5 consecutive wrong-password attempts', async () => {
      // 5 failing requests trigger the brute-force lock
      for (let i = 0; i < BRUTE_MAX_ATTEMPTS; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: verifiedUser.email, password: 'WrongP@ssw0rd!' })
          .expect(401);
      }

      // Next request (even with correct password) hits the lock
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: verifiedUser.email, password: VALID_PASSWORD })
        .expect(429);

      expect(res.body.error).toBe('ACCOUNT_LOCKED');
    });

    it('429 – IP_RATE_LIMIT_EXCEEDED after reaching threshold', async () => {
      const testIp = '1.2.3.4';

      // Hit the limit using a controlled IP via header (decoupled from storage impl)
      for (let i = 0; i < IP_RATE_LIMIT_MAX; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('x-forwarded-for', testIp)
          .send({ email: verifiedUser.email, password: 'wrong' });
      }

      // The next request must be rejected regardless of credentials
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-forwarded-for', testIp)
        .send({ email: verifiedUser.email, password: VALID_PASSWORD })
        .expect(429);

      expect(res.body.error).toBe('IP_RATE_LIMIT_EXCEEDED');
    });
  });
});
