import { Inject } from '@nestjs/common';

import { REDLOCK_SERVICE } from '../redlock.constants';
import { RedlockService } from '../redlock.service';

export interface RedlockDecoratorOptions {
  duration: number;
}

export function WithRedlock(options: RedlockDecoratorOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    Inject(RedlockService)(target, REDLOCK_SERVICE);

    descriptor.value = async function (...args: any[]) {
      const redlockService = this[REDLOCK_SERVICE];
      const resourceName = `${target.constructor.name}:${propertyKey}`;
      return redlockService.withLock(resourceName, options.duration, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
