import { Module } from '@nestjs/common';
import { AppLoggerModule } from './common/logging/logging.module.js';
import { PlatformConfigModule } from './config/platform-config.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    PlatformConfigModule,
    AppLoggerModule,
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
