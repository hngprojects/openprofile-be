import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';
import { mailConfig } from './config/mail.config';
import { renderVerificationOtpEmail } from './verifcation-otp.template';

export const OTP_EMAIL_SUBJECT = 'Verify your Open Profile account';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    @Inject(mailConfig.KEY)
    private readonly mail: ConfigType<typeof mailConfig>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.mail.host,
      port: this.mail.port,
      secure: this.mail.secure,
      auth: {
        user: this.mail.user,
        pass: this.mail.pass,
      },
      dnsLookup: (hostname, options, callback) =>
        dns.lookup(hostname, { ...options, family: 4 }, callback),
    } as nodemailer.TransportOptions);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.mail.from,
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
 
    await this.transporter.sendMail({
      to: toEmail,
      subject: OTP_EMAIL_SUBJECT,
      html: renderVerificationOtpEmail(fullName, otp),
    });
 
    this.logger.log(`OTP email delivered to ${toEmail}`);
  }
}
