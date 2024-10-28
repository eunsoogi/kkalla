import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApikeyModule } from './modules/apikey/apikey.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { InferenceModule } from './modules/inference/inference.module';
import { NewsModule } from './modules/news/news.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { typeORMConfig } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    ApikeyModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    InferenceModule,
  ],
})
export class AppModule {}
