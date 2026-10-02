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
export class VTPassAdapter implements ProviderAdapter {
  readonly code = 'VTPASS';

  async purchase(
    _request: ProviderPurchaseRequest,
  ): Promise<ProviderPurchaseResult> {
    throw new ProviderRequestNotSentError(
      'VTpass adapter is registered but not configured yet',
    );
  }

  async queryStatus(_providerReference: string): Promise<ProviderStatusResult> {
    throw new ProviderRequestNotSentError(
      'VTpass adapter is registered but not configured yet',
    );
  }

  async balance(): Promise<ProviderBalanceResult> {
    throw new ProviderRequestNotSentError(
      'VTpass adapter is registered but not configured yet',
    );
  }
}
