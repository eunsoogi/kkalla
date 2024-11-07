import { Injectable } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { typeORMConfig } from '@/databases/typeorm.config';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck(typeORMConfig.database as string)]);
  }
}
