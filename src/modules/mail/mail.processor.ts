import { WorkerHost, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { Logger } from '@nestjs/common';
import {
  QUEUE_NAMES,
  QUEUE_JOB_NAMES,
} from '../queue/config/queue-names.constant';
import { resetPasswordEmailTemplate } from './reset-email.template';
import { PasswordChangedEmailData } from './interfaces/password-changed-email.interface';
import { ResetPasswordEmailData } from './interfaces/reset-password-email.interface';

@Processor(QUEUE_NAMES.EMAIL)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET:
        await this.handleSendPasswordResetEmail(job.data as ResetPasswordEmailData);
        break;

      case QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_CHANGED:
        await this.handleSendPasswordChangedEmail(job.data as PasswordChangedEmailData);
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
