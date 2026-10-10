import { Global, Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';
import { PrismaService } from './prisma.service.js';
import { UNIT_OF_WORK } from './unit-of-work.js';

@Global()
@Module({
  imports: [PlatformConfigModule],
  providers: [
    PrismaService,
    {
      provide: UNIT_OF_WORK,
      useClass: PrismaUnitOfWork,
    },
  ],
  exports: [PrismaService, UNIT_OF_WORK],
})
export class PrismaModule {}
