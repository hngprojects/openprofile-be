import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env.js';
import { createTransport, Transporter } from 'nodemailer';
import { MailService } from '../../modules/mail/mail.service.js';

interface EmailResult {
  success: boolean;
  data?: SMTPTransport.SentMessageInfo;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;
  private readonly logger = new Logger(EmailService.name);
  private readonly mailService: MailService;

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
      const html = this.getWaitlistEmailHtml();

      await this.mailService.sendEmail(to, '', html);

      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send waitlist email';
      this.logger.error(`Failed to send email to ${to}:`, message);
      return { success: false, error: message };
    }
  }

  private getWaitlistEmailHtml(): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome to the OpenProfile Waitlist!</h1>
            <p>You've been added to our waitlist. We'll notify you as soon as we launch!</p>
            <p>Thank you for your interest,<br>The OpenProfile Team</p>
          </div>
        </body>
      </html>
    `;
  }
}
