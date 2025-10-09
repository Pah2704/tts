import { Controller, Get } from '@nestjs/common';
import { HealthPayload, HealthService } from './health.service';

@Controller('healthz')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthPayload> {
    return this.health.check();
  }
}
