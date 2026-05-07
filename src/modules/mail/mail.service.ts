import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_PORT === 465,
      auth: {
        user: env.MAIL_USER,
        pass: env.MAIL_PASS,
      },
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }
}
