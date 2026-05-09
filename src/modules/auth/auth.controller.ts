import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { env } from '../../config/env';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { setAuthCookies } from './utils/cookie.utils';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { GoogleAuthRequest } from './interfaces/google.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with email and password' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    if ('httpStatus' in result) {
      const { httpStatus, ...body } = result;
      res.status(httpStatus);
      return body;
    }

    res.status(HttpStatus.CREATED);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
    return this.authService.login(dto, ip, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a new access token from a refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  logout(@CurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP for email verification' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto, res);

    if ('httpStatus' in result) {
      const { httpStatus, ...body } = result;
      res.status(httpStatus as number);
      return body;
    }

    res.status(HttpStatus.OK);
    return result;
  }

  // google routes
  @Public()
  @Get('google')
  @Throttle({
    default: {
      ttl: 900_000,
      limit: 10,
    },
  })
  @UseGuards(ThrottlerGuard, GoogleAuthGuard)
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @Throttle({
    default: {
      ttl: 900_000,
      limit: 10,
    },
  })
  @UseGuards(ThrottlerGuard, GoogleAuthGuard)
  async googleCallback(@Req() req: GoogleAuthRequest, @Res() res: Response) {
    try {
      /**
       * req.user comes from GoogleStrategy validate()
       * req.ip contains the client IP address
       */
      const response = await this.authService.loginGoogle(req.user, req.ip);

      /**
       * Set secure HTTP-only cookies for tokens
       */
      setAuthCookies(res, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      /**
       * Redirect to onboarding for new users, dashboard for returning users
       */
      const redirectUrl = response.isNewUser
        ? `${env.FRONTEND_URL}/onboarding`
        : `${env.FRONTEND_URL}/dashboard`;

      res.redirect(302, redirectUrl);
    } catch {
      /**
       * Redirect to frontend with error on OAuth failure
       */
      const errorUrl = `${env.FRONTEND_URL}/auth?error=AUTH_FAILED&message=Google%20authentication%20failed.%20Please%20try%20again.`;
      res.redirect(302, errorUrl);
    }
  }
}
