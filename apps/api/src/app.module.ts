import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),

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

          autoLoadEntities: true,

          //Schema changes will be handled through migrations.
          synchronize: false,
        };
      },
    }),
  ],
})
export class AppModule {}
