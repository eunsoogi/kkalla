import { ModuleMetadata, Type } from '@nestjs/common';

export interface RedisOptions {
  host: string;
  port: number;
  password?: string;
}

export interface RedlockModuleOptions {
  redis: RedisOptions;
}

export interface RedlockLockStatus {
  locked: boolean;
  ttlMs: number | null;
}

export interface RedlockExecutionContext {
  signal: AbortSignal;
  assertLockOrThrow: () => void;
}

export interface RedlockOptionsFactory {
  createRedlockOptions(): Promise<RedlockModuleOptions> | RedlockModuleOptions;
}

export interface RedlockModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<RedlockOptionsFactory>;
  useClass?: Type<RedlockOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<RedlockModuleOptions> | RedlockModuleOptions;
  inject?: any[];
}
