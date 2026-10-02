import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProviderCapabilityEntity } from '../../database/entities/provider-capability.entity';
import { ProviderModule } from '../providers/provider.module';
import { RoutingService } from './routing.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderCapabilityEntity]), ProviderModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
