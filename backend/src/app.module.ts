import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
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
      useFactory: (config: ConfigService) => {
        const dbConfig = {
          host: config.get('database.host'),
          port: config.get('database.port'),
          username: config.get('database.username'),
          database: config.get('database.name'),
        };

        console.log('TYPEORM_DB_CONFIG', dbConfig);

        return {
          type: 'postgres',
          host: config.get('database.host'),
          port: config.get('database.port'),
          username: config.get('database.username'),
          password: config.get('database.password'),
          database: config.get('database.name'),
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
