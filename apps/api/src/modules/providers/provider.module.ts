import { Module } from '@nestjs/common';

import { ProviderAdapterRegistry } from './provider-adapter-registry.service';
import { PROVIDER_ADAPTERS } from './provider-adapter';
import { ProviderHealthService } from './provider-health.service';
import { SmePlugAdapter } from './adapters/smeplug.adapter';
import { VTPassAdapter } from './adapters/vtpass.adapter';

@Module({
  providers: [
    VTPassAdapter,
    SmePlugAdapter,
    ProviderHealthService,
    {
      provide: PROVIDER_ADAPTERS,
      useFactory: (
        vtpass: VTPassAdapter,
        smeplug: SmePlugAdapter,
      ) => [vtpass, smeplug],
      inject: [VTPassAdapter, SmePlugAdapter],
    },
    ProviderAdapterRegistry,
  ],
  exports: [ProviderAdapterRegistry, ProviderHealthService],
})
export class ProviderModule {}
