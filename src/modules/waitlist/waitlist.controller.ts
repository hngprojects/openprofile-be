import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitListService } from './waitList.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitListService: WaitListService) {}

  @Post()
  async addToWaitlist(@Body() dto: CreateWaitlistDto) {
    try {
      const result = await this.waitListService.addToWaitlist(dto.email);
      return {
        success: true,
        message: 'Email added to waitlist successfully',
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add to waitlist';

      throw new HttpException({ message }, HttpStatus.BAD_REQUEST);
    }
  }
}
