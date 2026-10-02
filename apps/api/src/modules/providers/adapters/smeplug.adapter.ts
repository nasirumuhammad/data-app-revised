import { Injectable } from '@nestjs/common';
import {
  ProviderAdapter,
  ProviderBalanceResult,
  ProviderPurchaseRequest,
  ProviderPurchaseResult,
  ProviderRequestNotSentError,
  ProviderStatusResult,
} from '../provider-adapter';

@Injectable()
export class SmePlugAdapter implements ProviderAdapter {
  readonly code = 'SMEPLUG';

  async purchase(
    _request: ProviderPurchaseRequest,
  ): Promise<ProviderPurchaseResult> {
    throw new ProviderRequestNotSentError(
      'Smeplug adapter is registered but not configured yet',
    );
  }

  async queryStatus(_providerReference: string): Promise<ProviderStatusResult> {
    throw new ProviderRequestNotSentError(
      'Smeplug adapter is registered but not configured yet',
    );
  }

  async balance(): Promise<ProviderBalanceResult> {
    throw new ProviderRequestNotSentError(
      'Smeplug adapter is registered but not configured yet',
    );
  }
}
