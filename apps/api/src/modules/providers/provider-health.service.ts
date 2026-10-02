import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Provider } from '../../database/entities/provider.entity';
import { ProviderStatus } from '../../database/enums/provider-status.enum';

@Injectable()
export class ProviderHealthService {
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30_000;

  constructor(private readonly dataSource: DataSource) {}

  isHealthy(provider: Provider): boolean {
    if (provider.status !== ProviderStatus.ACTIVE || !provider.isEnabled) {
      return false;
    }

    if (!provider.circuitOpenedAt) {
      return true;
    }

    return Date.now() - provider.circuitOpenedAt.getTime() >= this.cooldownMs;
  }

  /**
   * Runs on every successful purchase, so it must be cheap: a single
   * conditional UPDATE that matches no row (and takes no lock) while the
   * provider is healthy.
   */
  async recordSuccess(providerId: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(Provider)
      .set({ consecutiveFailures: 0, circuitOpenedAt: null })
      .where('id = :providerId', { providerId })
      .andWhere('("consecutiveFailures" > 0 OR "circuitOpenedAt" IS NOT NULL)')
      .execute();
  }

  /**
   * Atomic increment: concurrent failures cannot overwrite each other, and
   * the circuit opens in the same statement that crosses the threshold.
   */
  async recordFailure(providerId: string): Promise<void> {
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `UPDATE "providers"
          SET "consecutiveFailures" = "consecutiveFailures" + 1,
              "lastFailureAt" = now(),
              "circuitOpenedAt" = CASE
                WHEN "consecutiveFailures" + 1 >= $2 THEN now()
                ELSE "circuitOpenedAt"
              END,
              "updatedAt" = now()
        WHERE "id" = $1`,
      [providerId, this.failureThreshold],
    );

    if (affected === 0) {
      throw new NotFoundException('Provider not found');
    }
  }
}
