import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { env } from '../../config/env';
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
import { ResetPasswordEmailData } from '../mail/interfaces/reset-password-email.interface';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { MailService } from '../mail/mail.service';
import { otpEmailTemplate } from '../mail/otp-email.template';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from './redis.provider';
import Redis from 'ioredis';
import * as argon2 from 'argon2';
import { HttpException, HttpStatus } from '@nestjs/common';

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
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
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

  async resendOtp(dto: ResendOtpDto): Promise<{ status: string; message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { status: 'success', message: 'A new verification code has been sent to your email address.' };
    }

    if (user.isVerified) {
      throw new HttpException('This account is already verified. Please log in.', HttpStatus.CONFLICT);
    }

    const rateLimitKey = `rate_limit:resend_otp:${dto.email}`;
    const requestsCount = await this.redisClient.incr(rateLimitKey);
    
    if (requestsCount === 1) {
      await this.redisClient.expire(rateLimitKey, 3600); // 60 minutes
    }

    if (requestsCount > 3) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'RESEND_LIMIT_EXCEEDED',
          message: 'You have requested too many codes. Please wait 60 minutes before trying again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Invalidate previous OTP and generate new
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.usersService.updateOtp(user.id, otpHash, otpExpiresAt);

    const subject = 'Your new Open Profile verification code';
    const html = otpEmailTemplate({ otp });

    try {
      await this.mailService.sendEmail(user.email, subject, html);
    } catch {
      // Revert the rate limit count
      await this.redisClient.decr(rateLimitKey);
      throw new HttpException('We had trouble sending your code. Please try again in a moment', HttpStatus.ACCEPTED);
    }

    return { status: 'success', message: 'A new verification code has been sent to your email address.' };
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
