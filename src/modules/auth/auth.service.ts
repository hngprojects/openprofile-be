import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { env } from '../../config/env';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';
import { User } from '../users/entities/user.entity';
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
import { PasswordChangedEmailData } from '../mail/interfaces/password-changed-email.interface';
import { ResetPasswordEmailData } from '../mail/interfaces/reset-password-email.interface';

const FORGOT_PASSWORD_GENERIC_MSG =
  'If an account exists for this email, a reset link has been sent.';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<User, 'password' | 'refreshTokenHash' | 'deletedAt'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly queueService: QueueService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
    });
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
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

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<Record<string, string>> {
    const rateLimitKey = `forgot-password:${dto.email}`;
    const allowed = await this.rateLimiterService.isAllowed(rateLimitKey, 3, 3600);

    if (!allowed) {
      throw new HttpException(
        'You have requested too many reset links. Please wait 60 minutes before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.usersService.findByEmail(dto.email);

    if (user && user.password) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenSelector = crypto.createHash('sha256').update(rawToken).digest('hex');
      const tokenHash = await argon2.hash(rawToken);
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await this.usersService.setPasswordResetToken(user.id, tokenSelector, tokenHash, expires);

      const payload: ResetPasswordEmailData = {
        to: user.email,
        resetLink: `https://openprofile.com/reset-password?token=${rawToken}`,
      };

      await this.queueService.addJob<ResetPasswordEmailData>(
        QUEUE_NAMES.EMAIL,
        QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET,
        payload,
      );
    }

    return { status: 'success', message: FORGOT_PASSWORD_GENERIC_MSG };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<Record<string, string>> {
    const tokenSelector = crypto.createHash('sha256').update(dto.token).digest('hex');
    const resetRecord = await this.usersService.findResetTokenBySelector(tokenSelector);

    if (!resetRecord) {
      throw new HttpException(
        { errorCode: 'TOKEN_INVALID', message: 'This reset link is invalid. Please request a new one.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await argon2.verify(resetRecord.tokenHash, dto.token);
    if (!isValid) {
      throw new HttpException(
        { errorCode: 'TOKEN_INVALID', message: 'This reset link is invalid. Please request a new one.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (new Date() > resetRecord.expiresAt) {
      throw new HttpException(
        { errorCode: 'TOKEN_EXPIRED', message: 'This reset link has expired. Please request a new password reset link.' },
        HttpStatus.GONE,
      );
    }

    if (resetRecord.used) {
      throw new HttpException(
        { errorCode: 'TOKEN_USED', message: 'This reset link has already been used. Please request a new one.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.usersService.findOne(resetRecord.userId);
    await this.usersService.updatePassword(user.id, dto.newPassword);
    await this.usersService.markPasswordResetAsUsed(resetRecord.id);
    await this.usersService.setRefreshTokenHash(user.id, null);

    await this.queueService.addJob<PasswordChangedEmailData>(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_CHANGED,
      { to: user.email },
    );

    return { status: 'success', message: 'Your password has been updated. Please log in with your new password.' };
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const tokens = await this.signTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, deletedAt, ...safeUser } = user;

    return { ...tokens, user: safeUser };
  }

  private async signTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
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
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setRefreshTokenHash(userId, hash);
  }
}
