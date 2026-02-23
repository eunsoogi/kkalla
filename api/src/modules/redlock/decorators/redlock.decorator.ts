import { Inject } from '@nestjs/common';

import { REDLOCK_SERVICE } from '../redlock.constants';
import { RedlockService } from '../redlock.service';

export interface RedlockDecoratorOptions {
  duration: number;
  resourceName?: string;
  compatibleResourceNames?: string[];
}

export function WithRedlock(options: RedlockDecoratorOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    Inject(RedlockService)(target, REDLOCK_SERVICE);

    descriptor.value = async function (...args: any[]) {
      const redlockService: RedlockService = this[REDLOCK_SERVICE];
      const resourceNames = resolveResourceNames(target, propertyKey, options);

      return runWithSequentialLocks(redlockService, resourceNames, options.duration, () =>
        originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}

function resolveResourceNames(target: any, propertyKey: string, options: RedlockDecoratorOptions): string[] {
  const defaultResourceName = `${target.constructor.name}:${propertyKey}`;
  return [options.resourceName ?? defaultResourceName, ...(options.compatibleResourceNames ?? [])]
    .filter((resourceName) => resourceName.length > 0)
    .filter((resourceName, index, values) => values.indexOf(resourceName) === index);
}

async function runWithSequentialLocks<T>(
  redlockService: RedlockService,
  resourceNames: string[],
  duration: number,
  callback: () => Promise<T>,
): Promise<T | undefined> {
  const withLockAt = async (index: number): Promise<T | undefined> => {
    const resourceName = resourceNames[index];
    if (!resourceName) {
      return undefined;
    }

    return redlockService.withLock(resourceName, duration, async ({ assertLockOrThrow }) => {
      assertLockOrThrow();

      if (index >= resourceNames.length - 1) {
        return callback();
      }

      return withLockAt(index + 1);
    });
  };

  return withLockAt(0);
}
