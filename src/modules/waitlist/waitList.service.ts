import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WaitListModelAction } from './actions/waitList.action';
import { WaitList } from './entities/waitList.entity';

@Injectable()
export class WaitListService {
  constructor(
    private readonly waitListModelAction: WaitListModelAction,
    @InjectQueue('waitlist-email') private readonly waitListEmailQueue: Queue,
  ) {}

  async addToWaitlist(email: string): Promise<WaitList> {
    const waitListEntry = await this.waitListModelAction.create(email);

    await this.waitListEmailQueue.add('send-waitlist-email', {
      waitListId: waitListEntry.email,
      email: waitListEntry.email,
    });

    return waitListEntry;
  }

  async getAllWaitList() {
    return this.waitListModelAction.getAll();
  }
}
