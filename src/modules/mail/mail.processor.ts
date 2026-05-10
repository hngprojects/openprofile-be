import { WorkerHost, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService, OTP_EMAIL_SUBJECT } from './mail.service';
import { Logger } from '@nestjs/common';
import {
  QUEUE_NAMES,
  QUEUE_JOB_NAMES,
} from '../queue/config/queue-names.constant';
import { resetPasswordEmailTemplate } from './reset-email.template';
import { PasswordChangedEmailData } from './interfaces/password-changed-email.interface';
import { ResetPasswordEmailData } from './interfaces/reset-password-email.interface';
import { AccountLockedEmailData } from './interfaces/account-locked-email.interface';
import { NewIpLoginEmailData } from './interfaces/new-ip-login-email.interface';
import { renderVerificationOtpEmail } from './verification-otp.template';

@Processor(QUEUE_NAMES.EMAIL)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET:
        await this.handleSendPasswordResetEmail(
          job.data as ResetPasswordEmailData,
        );
        break;

      case QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_CHANGED:
        await this.handleSendPasswordChangedEmail(
          job.data as PasswordChangedEmailData,
        );
        break;

      case QUEUE_JOB_NAMES.EMAIL.ACCOUNT_LOCKED:
        await this.handleAccountLockedEmail(job.data as AccountLockedEmailData);
        break;

      case QUEUE_JOB_NAMES.EMAIL.NEW_IP_LOGIN:
        await this.handleNewIpLoginEmail(job.data as NewIpLoginEmailData);
        break;
      case QUEUE_JOB_NAMES.EMAIL.SEND_OTP:
        await this.handleResendOTP(
          job.data as {
            to: string;
            otp: string;
            fullName: string;
          },
        );
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        break;
    }
  }

  private async handleSendPasswordResetEmail(data: ResetPasswordEmailData) {
    const { to, resetLink } = data;
    const subject = 'Reset your Open Profile password';
    const html = resetPasswordEmailTemplate({ resetUrl: resetLink });
    await this.mailService.sendEmail(to, subject, html);
  }

  private async handleSendPasswordChangedEmail(data: PasswordChangedEmailData) {
    const subject = 'Your Open Profile password has been changed';
    const html = `
      <p>Your password has been successfully changed.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `;
    await this.mailService.sendEmail(data.to, subject, html);
  }

  private async handleAccountLockedEmail(data: AccountLockedEmailData) {
    const { to, lockedUntil } = data;
    const subject = 'Unusual sign-in activity on your Open Profile account';
    const html = `
      <p>Your Open Profile account has been temporarily locked after multiple failed sign-in attempts.</p>
      <p>Your account will be automatically unlocked at <strong>${lockedUntil}</strong>.</p>
      <p>If you did not make these attempts, please reset your password immediately.</p>
      <p>The Open Profile Team</p>
    `;
    await this.mailService.sendEmail(to, subject, html);
  }

  private async handleNewIpLoginEmail(data: NewIpLoginEmailData) {
    const { to, ip, timestamp } = data;
    const subject = 'New sign-in to your Open Profile account';
    const html = `
      <p>A sign-in to your Open Profile account was detected from a new IP address.</p>
      <p><strong>IP address:</strong> ${ip}</p>
      <p><strong>Time:</strong> ${timestamp}</p>
      <p>If this was not you, please reset your password immediately.</p>
      <p>The Open Profile Team</p>
    `;
    await this.mailService.sendEmail(to, subject, html);
  }

  private async handleResendOTP(data: {
    to: string;
    otp: string;
    fullName: string;
  }) {
    const html = renderVerificationOtpEmail(data.otp, data.fullName);

    await this.mailService.sendEmail(data.to, OTP_EMAIL_SUBJECT, html);
  }

  @OnWorkerEvent('completed')
  handleCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully.`);
  }

  @OnWorkerEvent('failed')
  handleFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed with error: ${error.message}`,
      error.stack,
    );
  }
}
