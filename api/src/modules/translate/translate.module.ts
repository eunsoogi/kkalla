import { Module } from '@nestjs/common';

import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import path from 'path';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ko',
      loaderOptions: {
        path: path.join(__dirname, '../../i18n/'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver, new HeaderResolver(['x-lang'])],
    }),
  ],
})
export class TranslateModule {}
