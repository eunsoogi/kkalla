import { DynamicModule, Global, Module } from '@nestjs/common';

import { REDLOCK_OPTIONS } from './redlock.constants';
import { RedlockModuleOptions } from './redlock.interface';
import { RedlockModuleAsyncOptions } from './redlock.interface';
import { RedlockService } from './redlock.service';

@Global()
@Module({})
export class RedlockModule {
  static forRoot(options: RedlockModuleOptions): DynamicModule {
    return {
      module: RedlockModule,
      providers: [
        {
          provide: REDLOCK_OPTIONS,
          useValue: options,
        },
        RedlockService,
      ],
      exports: [RedlockService],
    };
  }

  static forRootAsync(options: RedlockModuleAsyncOptions): DynamicModule {
    return {
      module: RedlockModule,
      imports: options.imports || [],
      providers: [
        {
          provide: REDLOCK_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        RedlockService,
      ],
      exports: [RedlockService],
    };
  }
}
