import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

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
import { TransactionStatus } from 'src/database/enums/transaction-status.enum';
import { Transaction } from 'src/database/entities/transaction.entity';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @InjectRepository(ProviderCapabilityEntity)
    private readonly capabilityRepository: Repository<ProviderCapabilityEntity>,
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly providerHealth: ProviderHealthService,
    private readonly dataSource: DataSource,
  ) {}

  async purchase(input: RoutePurchaseInput): Promise<RoutePurchaseResult> {
    const { onAttemptStart, onAttemptComplete, ...purchaseRequest } = input;

    const candidates = await this.getCandidates({
      serviceType: input.serviceType,
      productCode: input.productCode,
    });

    if (candidates.length === 0) {
      return {
        providerCode: '',
        result: {
          status: ProviderOperationStatus.FAILED,
          retryable: false,
          message: `No provider available for ${input.serviceType}`,
        },
        attempts: [],
      };
    }

    const attempts: RoutePurchaseAttempt[] = [];

    for (const [index, candidate] of candidates.entries()) {
      const provider = candidate.provider;
      const adapter = this.adapterRegistry.get(provider.code);

      const attemptNumber = index + 1;
      const startedAt = new Date();

      /*
       * Persist the attempt BEFORE contacting the provider.
       *
       * If our process dies while the external provider request is
       * in progress, reconciliation can see that this provider was
       * already contacted.
       */
      await onAttemptStart?.({
        providerId: provider.id,
        providerCode: provider.code,
        attemptNumber,
        startedAt,
      });

      let result: ProviderPurchaseResult;

      try {
        result = await adapter.purchase(purchaseRequest);
      } catch (error) {
        const completedAt = new Date();

        const message =
          error instanceof Error ? error.message : 'Unknown provider error';

        /*
         * We only fail over when we know the request was never
         * sent to the provider.
         *
         * For an ordinary timeout/network error, the provider may
         * have received and processed the request, so the result
         * is UNKNOWN and must be reconciled.
         */
        if (error instanceof ProviderRequestNotSentError) {
          result = {
            status: ProviderOperationStatus.FAILED,
            retryable: true,
            message,
          };
        } else {
          result = {
            status: ProviderOperationStatus.UNKNOWN,
            retryable: false,
            message,
          };
        }

        await onAttemptComplete?.({
          providerId: provider.id,
          providerCode: provider.code,
          attemptNumber,
          startedAt,
          completedAt,
          result,
          error: message,
        });

        attempts.push({
          providerId: provider.id,
          providerCode: provider.code,
          attemptNumber,
          startedAt,
          completedAt,
          result,
          error: message,
        });

        /*
         * The request definitely did not reach this provider.
         *
         * Therefore it is safe to try the next provider.
         */
        if (error instanceof ProviderRequestNotSentError) {
          await this.safely(() =>
            this.providerHealth.recordFailure(provider.id),
          );

          continue;
        }

        /*
         * We don't know whether the provider received it.
         *
         * NEVER fail over here because that could create two
         * successful purchases for one wallet debit.
         */
        return {
          providerCode: provider.code,
          result,
          attempts,
        };
      }

      const completedAt = new Date();

      await onAttemptComplete?.({
        providerId: provider.id,
        providerCode: provider.code,
        attemptNumber,
        startedAt,
        completedAt,
        result,
      });

      attempts.push({
        providerId: provider.id,
        providerCode: provider.code,
        attemptNumber,
        startedAt,
        completedAt,
        result,
      });

      /*
       * SUCCESS:
       *
       * The purchase is complete. Do not try another provider.
       */
      if (result.status === ProviderOperationStatus.SUCCESS) {
        await this.safely(() => this.providerHealth.recordSuccess(provider.id));

        return {
          providerCode: provider.code,
          result,
          attempts,
        };
      }

      /*
       * PENDING:
       *
       * The provider accepted the request but has not
       * given us a final result.
       *
       * Do not fail over.
       *
       * Reconciliation will query this provider later.
       */
      if (result.status === ProviderOperationStatus.PENDING) {
        await this.safely(() => this.providerHealth.recordSuccess(provider.id));

        return {
          providerCode: provider.code,
          result,
          attempts,
        };
      }

      /*
       * UNKNOWN:
       *
       * We don't know whether the provider processed
       * the request.
       *
       * Do not fail over and do not refund.
       *
       * Reconciliation owns this transaction.
       */
      if (result.status === ProviderOperationStatus.UNKNOWN) {
        return {
          providerCode: provider.code,
          result,
          attempts,
        };
      }

      /*
       * FAILED:
       *
       * The provider explicitly told us that the purchase
       * failed.
       *
       * If retryable, try the next provider.
       *
       * If not retryable, stop immediately.
       */
      if (result.status === ProviderOperationStatus.FAILED) {
        if (result.retryable) {
          await this.safely(() =>
            this.providerHealth.recordFailure(provider.id),
          );

          continue;
        }

        return {
          providerCode: provider.code,
          result,
          attempts,
        };
      }
    }

    /*
     * Every candidate failed in a way that was safe to
     * fail over.
     *
     * At this point no provider has accepted the purchase,
     * so the PurchaseService can safely reverse the wallet
     * debit.
     */
    return {
      providerCode: '',
      result: {
        status: ProviderOperationStatus.FAILED,
        retryable: false,
        message: `All providers failed for ${input.serviceType}`,
      },
      attempts,
    };
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
  async updateSettlement(input: {
    transactionId: string;
    status: TransactionStatus;
    providerId?: string | null;
    providerReference?: string | null;
    failureReason?: string | null;
  }): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);

      const transaction = await repository
        .createQueryBuilder('transaction')
        .setLock('pessimistic_write')
        .where('transaction.id = :id', { id: input.transactionId })
        .getOne();

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (
        transaction.status === TransactionStatus.SUCCESS &&
        input.status !== TransactionStatus.SUCCESS
      ) {
        return transaction;
      }

      transaction.status = input.status;

      if (input.providerId !== undefined) {
        transaction.providerId = input.providerId;
      }

      if (input.providerReference !== undefined) {
        transaction.providerReference = input.providerReference;
      }

      if (input.failureReason !== undefined) {
        transaction.failureReason = input.failureReason;
      }

      if (
        input.status === TransactionStatus.SUCCESS ||
        input.status === TransactionStatus.FAILED ||
        input.status === TransactionStatus.REVERSED
      ) {
        transaction.completedAt = new Date();
      }

      return repository.save(transaction);
    });
  }
}
