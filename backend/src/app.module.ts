import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { getDbCredentialsFromSecretsManager } from './config/secrets-manager';
import { HealthController } from './health.controller';

// Business Modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { StorageModule } from './modules/storage/storage.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    // Config toàn cục
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const database =
          process.env.DB_CREDENTIALS_SOURCE === 'secrets-manager'
            ? await getDbCredentialsFromSecretsManager()
            : {
                host: config.get<string>('database.host') || 'localhost',
                port: config.get<number>('database.port') || 5432,
                username: config.get<string>('database.username') || 'postgres',
                password: config.get<string>('database.password') || 'postgres',
                name: config.get<string>('database.name') || 'electronics_shop',
              };

        return {
          type: 'postgres',
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.name,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: config.get('nodeEnv') !== 'production',
          logging: config.get('nodeEnv') === 'development',
        };
      },
      inject: [ConfigService],
    }),

    // Feature modules
    MetricsModule,
    StorageModule,
    AuthModule,
    UserModule,
    CatalogModule,
    CartModule,
    OrderModule,
    PaymentModule,
    InventoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
