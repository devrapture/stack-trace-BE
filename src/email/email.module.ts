import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { EMAIL_PROVIDER } from './email-provider.js';
import { ResendEmailProvider } from './resend-email.provider.js';

@Module({
  imports: [PlatformConfigModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: ResendEmailProvider,
    },
  ],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
