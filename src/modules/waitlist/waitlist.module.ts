import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WaitlistEmailProcessor } from '../queue/processors/waitlist-email.processor';
import { WaitlistController } from './waitlist.controller';
import { WaitListModelAction } from './actions/waitList.action';
import { WaitListService } from './waitList.service';
import { WaitList } from './entities/waitList.entity';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitList]),
    BullModule.registerQueue({
      name: 'waitlist-email',
    }),
    EmailModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitListModelAction, WaitlistEmailProcessor, WaitListService],
  exports: [WaitListService, WaitListModelAction],
})
export class WaitlistModule {}
