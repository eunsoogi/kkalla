import { Inject } from '@nestjs/common';

import { REDLOCK_SERVICE } from '../redlock.constants';
import { RedlockService } from '../redlock.service';

export interface RedlockDecoratorOptions {
  duration: number;
  resourceName?: string;
  compatibleResourceNames?: string[];
}

/**
 * Handles with redlock in the distributed lock workflow.
 * @param options - Configuration for the distributed lock flow.
 * @returns Result produced by the distributed lock flow.
 */
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

/**
 * Normalizes resource names for the distributed lock flow.
 * @param target - Input value for target.
 * @param propertyKey - Input value for property key.
 * @param options - Configuration for the distributed lock flow.
 * @returns Formatted string output for the operation.
 */
function resolveResourceNames(target: any, propertyKey: string, options: RedlockDecoratorOptions): string[] {
  const defaultResourceName = `${target.constructor.name}:${propertyKey}`;
  // Include legacy lock keys during migrations while avoiding duplicate lock attempts.
  return [options.resourceName ?? defaultResourceName, ...(options.compatibleResourceNames ?? [])]
    .filter((resourceName) => resourceName.length > 0)
    .filter((resourceName, index, values) => values.indexOf(resourceName) === index);
}

/**
 * Runs with sequential locks in the distributed lock workflow.
 * @param redlockService - Lock data used for concurrency control.
 * @param resourceNames - Input value for resource names.
 * @param duration - Input value for duration.
 * @param callback - Callback invoked within the workflow.
 * @returns Asynchronous result produced by the distributed lock flow.
 */
async function runWithSequentialLocks<T>(
  redlockService: RedlockService,
  resourceNames: string[],
  duration: number,
  callback: () => Promise<T>,
): Promise<T | undefined> {
  // Acquire all compatible lock names in order so old/new workers cannot overlap.
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
