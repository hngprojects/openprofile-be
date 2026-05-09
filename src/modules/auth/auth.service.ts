import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { env } from '../../config/env';
import { AuthProvider, User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { QueueService } from '../queue/queue.service';
import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../queue/config/queue-names.constant';
import { ResetPasswordEmailData } from '../mail/interfaces/reset-password-email.interface';
import { AccountLockedEmailData } from '../mail/interfaces/account-locked-email.interface';
import { NewIpLoginEmailData } from '../mail/interfaces/new-ip-login-email.interface';
import { RedisService } from '../../common/redis/redis.service';
import type { Response } from 'express';

const BRUTE_MAX_ATTEMPTS = 5;
const BRUTE_LOCKOUT_SECONDS = 30 * 60;
const IP_RATE_LIMIT_MAX = 10;
const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<User, 'password' | 'refreshTokenHash' | 'deletedAt'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
    });
    return this.issueTokens(user);
  }

  async login(
    dto: LoginDto,
    ip: string,
    res: Response,
  ): Promise<{
    status: string;
    user: {
      id: string;
      email: string;
      role: string;
      onboardingComplete: boolean;
    };
  }> {
    const ipKey = `ip_rate:${ip}`;
    const ipCount = await this.redisService.increment(
      ipKey,
      IP_RATE_LIMIT_WINDOW_SECONDS,
    );
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

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect.',
      });
    }

    if (user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException({
        error: 'WRONG_PROVIDER',
        message: `This account was created with ${user.provider === AuthProvider.GOOGLE ? 'Google' : user.provider}. Please use the Continue with ${user.provider === AuthProvider.GOOGLE ? 'Google' : user.provider} button.`,
      });
    }

    if (!user.isVerified) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        message: 'Please verify your email address before logging in.',
      });
    }

    const lockKey = `lock:${user.email}`;
    const attemptsKey = `attempts:${user.email}`;
    const isLocked = await this.redisService.get(lockKey);
    if (isLocked) {
      throw new HttpException(
        {
          error: 'ACCOUNT_LOCKED',
          message:
            'Your account has been temporarily locked after too many failed attempts. Please try again in 30 minutes or reset your password.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      const attempts = await this.redisService.increment(
        attemptsKey,
        BRUTE_LOCKOUT_SECONDS,
      );
      if (attempts >= BRUTE_MAX_ATTEMPTS) {
        await this.redisService.set(lockKey, '1', BRUTE_LOCKOUT_SECONDS);
        await this.redisService.del(attemptsKey);
        const lockedUntil = new Date(
          Date.now() + BRUTE_LOCKOUT_SECONDS * 1000,
        ).toUTCString();
        void this.queueService.addJob<AccountLockedEmailData>(
          QUEUE_NAMES.EMAIL,
          QUEUE_JOB_NAMES.EMAIL.ACCOUNT_LOCKED,
          { to: user.email, lockedUntil },
        );
      }
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect.',
      });
    }

    await this.redisService.del(attemptsKey);

    const isNewIp = user.lastLoginIp !== ip;
    if (isNewIp && user.lastLoginIp !== null) {
      void this.queueService.addJob<NewIpLoginEmailData>(
        QUEUE_NAMES.EMAIL,
        QUEUE_JOB_NAMES.EMAIL.NEW_IP_LOGIN,
        { to: user.email, ip, timestamp: new Date().toUTCString() },
      );
    }

    this.logger.log(
      `Login: userId=${user.id} ip=${ip} time=${new Date().toISOString()}`,
    );
    await this.usersService.updateLastLoginIp(user.id, ip);

    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    const isProd = env.NODE_ENV === 'production';
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
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

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async getProfile(userId: string): Promise<User> {
    return this.usersService.findOne(userId);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<Record<string, string> | undefined> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.usersService.setPasswordResetToken(
        user.id,
        tokenHash,
        expires,
      );

      const payload: ResetPasswordEmailData = {
        to: user.email,
        resetLink: env.APP_URL + '/reset-password?token=' + rawToken,
      };

      await this.queueService.addJob<ResetPasswordEmailData>(
        QUEUE_NAMES.EMAIL,
        QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET,
        payload,
      );
    }

    return {
      message: 'A password reset link has been sent to the provided email',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const result = await this.usersService.findByValidResetToken(tokenHash);

    if (!result) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const { user, resetPassword } = result;
    await this.usersService.updatePassword(user.id, dto.password);
    await this.usersService.markPasswordResetAsUsed(resetPassword.id);
    await this.usersService.clearPasswordResetToken(user.id);
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, deletedAt, ...safeUser } = user;

    return { ...tokens, user: safeUser };
  }

  private async signTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await argon2.hash(refreshToken);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }
}
