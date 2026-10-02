import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProviderCapabilityEntity } from '../../database/entities/provider-capability.entity';
import { ProviderCapability } from '../../database/enums/provider-capability.enum';
import { ServiceType } from '../../database/enums/service-type.enum';
import { ProviderAdapterRegistry } from '../providers/provider-adapter-registry.service';
import {
  ProviderOperationStatus,
  ProviderPurchaseResult,
  ProviderRequestNotSentError,
} from '../providers/provider-adapter';
import { ProviderHealthService } from '../providers/provider-health.service';
import {
  RoutePurchaseAttempt,
  RoutePurchaseInput,
  RoutePurchaseResult,
} from './routing.types';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @InjectRepository(ProviderCapabilityEntity)
    private readonly capabilityRepository: Repository<ProviderCapabilityEntity>,
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly providerHealth: ProviderHealthService,
  ) {}

  async purchase(input: RoutePurchaseInput): Promise<RoutePurchaseResult> {
    const candidates = await this.getCandidates(input.serviceType);
    const attempts: RoutePurchaseAttempt[] = [];

    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        `No healthy provider is available for ${input.serviceType}`,
      );
    }

    for (const capability of candidates) {
      const provider = capability.provider;
      const adapter = this.adapterRegistry.get(provider.code);

      // Only the adapter call is guarded. Health bookkeeping below must never
      // turn an already-completed provider call into a different outcome.
      let result: ProviderPurchaseResult;

      try {
        result = await adapter.purchase(input);
      } catch (error) {
        const message = this.getErrorMessage(error);
        attempts.push({ providerCode: provider.code, error: message });
        await this.safely(() => this.providerHealth.recordFailure(provider.id));

        if (error instanceof ProviderRequestNotSentError) {
          // The provider never received the order, so failing over is safe.
          continue;
        }

        // Timeout, dropped connection, 5xx, unparsable body...: the provider
        // may have fulfilled the order. Do not try another provider; hand the
        // ambiguity back so the purchase flow can reconcile via queryStatus.
        return {
          providerCode: provider.code,
          result: { status: ProviderOperationStatus.UNKNOWN, message },
          attempts,
        };
      }

      attempts.push({ providerCode: provider.code, result });

      if (result.status === ProviderOperationStatus.FAILED) {
        if (result.retryable) {
          await this.safely(() =>
            this.providerHealth.recordFailure(provider.id),
          );
          continue;
        }

        // A business failure such as an invalid recipient is not evidence
        // that the provider is unhealthy, so do not trip the circuit or
        // send the same invalid purchase to another provider.
        return { providerCode: provider.code, result, attempts };
      }

      // SUCCESS, PENDING and UNKNOWN all mean the request reached the
      // provider. Do not send the same purchase to another provider after
      // an UNKNOWN response: that can create a duplicate purchase.
      await this.safely(() => this.providerHealth.recordSuccess(provider.id));

      return { providerCode: provider.code, result, attempts };
    }

    throw new ServiceUnavailableException({
      message: `All providers failed for ${input.serviceType}`,
      attempts,
    });
  }

  private async getCandidates(
    serviceType: ServiceType,
  ): Promise<ProviderCapabilityEntity[]> {
    const capabilities = await this.capabilityRepository.find({
      where: {
        capability: serviceType as unknown as ProviderCapability,
        isEnabled: true,
        provider: {
          isEnabled: true,
        },
      },
      relations: {
        provider: true,
      },
    });

    return capabilities
      .filter((capability) =>
        this.providerHealth.isHealthy(capability.provider),
      )
      .sort((a, b) => {
        const aCost =
          a.cost === null ? Number.POSITIVE_INFINITY : Number(a.cost);
        const bCost =
          b.cost === null ? Number.POSITIVE_INFINITY : Number(b.cost);

        return aCost - bCost || a.priority - b.priority;
      });
  }

  /** Health bookkeeping is best-effort; it must not affect the purchase. */
  private async safely(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.warn(
        `Provider health update failed: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown provider error';
  }
}
