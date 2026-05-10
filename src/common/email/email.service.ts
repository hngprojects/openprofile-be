import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { renderTemplate } from './utils/template-renderer.js';

interface EmailResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;

  constructor() {
    this.transporter = createTransport<SMTPTransport.SentMessageInfo>(
      new SMTPTransport({
        host: env.MAIL_HOST,

        port: env.MAIL_PORT,

        secure: env.MAIL_PORT === 465,

        auth: {
          user: env.MAIL_USER,
          pass: env.MAIL_PASS,
        },
      }),
    );

    this.logger.log('EmailService initialized with SMTP transport');
  }

  async sendWaitlistEmail(to: string): Promise<EmailResult> {
    try {
      const info: SMTPTransport.SentMessageInfo =
        await this.transporter.sendMail({
          from: `OpenProfile <${env.MAIL_FROM}>`,

          to,

          subject: "You're on the OpenProfile wait list!",

          html: renderTemplate('waitlist-confirmation'),
        });

      this.logger.log(`Waitlist email sent to ${to}`);

      return {
        success: true,
        data: info,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send waitlist email';

      this.logger.error(`Failed to send email to ${to}:`, message);

      return {
        success: false,
        error: message,
      };
    }
  }

  async sendVerificationEmail(
    to: string,
    verificationUrl: string,
  ): Promise<EmailResult> {
    try {
      const info: SMTPTransport.SentMessageInfo =
        await this.transporter.sendMail({
          from: `OpenProfile <${env.MAIL_FROM}>`,

          to,

          subject: 'Verify Your OpenProfile Account',

          html: renderTemplate('verify-email', {
            verificationUrl,
          }),
        });

      this.logger.log(`Verification email sent to ${to}`);

      return {
        success: true,
        data: info,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send verification email';

      this.logger.error(`Failed to send email to ${to}:`, message);

      return {
        success: false,
        error: message,
      };
    }
  }
}