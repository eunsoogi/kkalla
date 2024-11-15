import { Module } from '@nestjs/common';

import { SequenceModule } from '../sequence/sequence.module';
import { SlackModule } from '../slack/slack.module';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';

@Module({
  imports: [SequenceModule, SlackModule],
  controllers: [NotifyController],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
