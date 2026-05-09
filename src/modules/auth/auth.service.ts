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
import { GoogleUser } from './interfaces/google.interface';
import { AuthProvider } from '../users/entities/user.entity';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<User, 'password' | 'refreshTokenHash' | 'deletedAt'>;
}

export interface GoogleAuthResponse extends AuthTokens {
  user: Omit<User, 'password' | 'refreshTokenHash' | 'deletedAt'>;
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly queueService: QueueService,
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

  async validateGoogleUser(
    googleUser: GoogleUser,
  ): Promise<{ user: User; isNewUser: boolean }> {
    let user = await this.usersService.findByEmail(googleUser.email);
    let isNewUser = false;

    if (user) {
      /**
       * Link google account if not already linked (email account exists)
       */
      if (user.authProvider === AuthProvider.EMAIL) {
        await this.usersService.linkGoogleAccount(user.id);
        user = await this.usersService.findOne(user.id);
      }

      return { user, isNewUser };
    }

    /**
     * If user does not exist, create a new Google user with is_verified = true and onboardingComplete = false
     */
    const created = await this.usersService.createGoogleUser({
      email: googleUser.email,
      fullName: googleUser.fullName,
      isVerified: true,
      onboardingComplete: false,
    });

    isNewUser = true;
    return { user: created, isNewUser };
  }

  async loginGoogle(
    user: User,
    ipAddress: string,
  ): Promise<GoogleAuthResponse> {
    /**
     * Log the OAuth login with timestamp, IP, and user ID
     */
    this.usersService.logOAuthLogin(user.id, ipAddress, 'google');

    /**
     * Generate tokens with full payload: sub, email, role, onboardingComplete
     */
    const tokens = await this.signGoogleTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, deletedAt, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
      isNewUser: !user.onboardingComplete,
    };
  }

  private async signGoogleTokens(user: User): Promise<AuthTokens> {
    const payload = {
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
}
