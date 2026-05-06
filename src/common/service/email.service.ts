import { Resend } from 'resend';
import { Injectable } from '@nestjs/common';
import { env } from '../../config/env';

interface EmailResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;

  constructor() {
    const apiKey = env.RESEND_API_KEY;
    this.resend = new Resend(apiKey);
  }

  async sendWaitlistEmail(to: string): Promise<EmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'OpenProfile <no-reply@openprofile.com>',
        to,
        subject: "You're on the OpenProfile waitlist!",
        html: this.getWaitlistEmailHtml(),
      });
      return { success: true, data, error: error?.message };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send waitlist email';
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
