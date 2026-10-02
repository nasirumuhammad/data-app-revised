import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { ENTITIES } from './database/entities';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProviderModule } from './modules/providers/provider.module';
import { RoutingModule } from './modules/routing/routing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig],
    }),

    // Default per-IP limit for every route; auth routes set stricter ones.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    AuthModule,
    WalletModule,
    ProviderModule,
    RoutingModule,

    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (
        databaseEnv: ConfigType<NonNullable<typeof databaseConfig>>,
      ) => {
        const { database, host, password, port, username } = databaseEnv;
        return {
          type: 'postgres',
          host,
          port,
          username,
          password,
          database,

          entities: ENTITIES,

          //Schema changes will be handled through migrations.
          synchronize: false,
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
