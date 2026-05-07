import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WaitListModelAction } from '../../waitlist/actions/waitList.action';
import { EmailService } from '../../../common/service/email.service';

@Processor('waitlist-email')
export class WaitlistEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(WaitlistEmailProcessor.name);

  constructor(
    private readonly waitlistModelAction: WaitListModelAction,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(
    job: Job,
  ): Promise<{ success: boolean; waitListId: string; email: string }> {
    try {
      const { waitListId } = job.data as { waitListId: string };
      this.logger.log(`Processing waitlist email for entry ${waitListId}`);

      const waitlistEntry =
        await this.waitlistModelAction.findByEmail(waitListId);
      if (!waitlistEntry) {
        throw new Error(`Waitlist entry ${waitListId} not found`);
      }

      const result = await this.emailService.sendWaitlistEmail(
        waitlistEntry.email,
      );
      if (!result.success) {
        throw new Error(`Failed to send email: ${result.error}`);
      }

      this.logger.log(`[EMAIL] Waitlist email sent to: ${waitlistEntry.email}`);
      await this.waitlistModelAction.markEmailSent(waitlistEntry.id);

      this.logger.log(`Waitlist email marked as sent for entry ${waitListId}`);
      return { success: true, waitListId, email: waitlistEntry.email };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to process waitlist email for job ${job.id}`,
        error.stack,
      );
      throw error;
    }
  }
}
