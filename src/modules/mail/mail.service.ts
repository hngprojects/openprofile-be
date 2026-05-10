import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { renderVerificationOtpEmail } from './verifcation-otp.template';
import { Resend } from 'resend';

export const OTP_EMAIL_SUBJECT = 'Verify your Open Profile account';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY as string);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.resend.emails.send({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
    });

    this.logger.log(`Email sent to ${to} with subject "${subject}"`);
  }

  async sendVerificationOtp(
    toEmail: string,
    fullName: string,
    otp: string,
  ): Promise<void> {
    this.logger.log(`Sending OTP email to ${toEmail}`);

    await this.resend.emails.send({
      from: env.MAIL_FROM,
      to: toEmail,
      subject: OTP_EMAIL_SUBJECT,
      html: renderVerificationOtpEmail(fullName, otp),
    });

    this.logger.log(`OTP email delivered to ${toEmail}`);
  }
}
