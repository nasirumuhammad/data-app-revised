import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ProviderAdapter,
  PROVIDER_ADAPTERS,
} from './provider-adapter';

@Injectable()
export class ProviderAdapterRegistry {
  private readonly adaptersByCode: ReadonlyMap<string, ProviderAdapter>;

  constructor(
    @Inject(PROVIDER_ADAPTERS) adapters: ProviderAdapter[],
  ) {
    this.adaptersByCode = new Map(adapters.map((adapter) => [adapter.code, adapter]));
  }

  get(code: string): ProviderAdapter {
    const adapter = this.adaptersByCode.get(code);

    if (!adapter) {
      throw new NotFoundException(`No adapter registered for provider: ${code}`);
    }

    return adapter;
  }
}
