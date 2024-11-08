import { Module } from '@nestjs/common';

import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';

@Module({
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
