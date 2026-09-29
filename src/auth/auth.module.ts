import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { EMAIL_VERIFICATION_REPOSITORY } from './email-verification/email-verification.repository.js';
import { OtpService } from './email-verification/otp.service.js';
import { PrismaEmailVerificationRepository } from './email-verification/prisma-email-verification.repository.js';
import { PASSWORD_CREDENTIALS_REPOSITORY } from './password/password-credentials.repository.js';
import { PasswordHasher } from './password/password.hasher.js';
import { PrismaPasswordCredentialsRepository } from './password/prisma-password-credentials.repository.js';
import { RegistrationController } from './registration/registration.controller.js';
import { RegistrationService } from './registration/registration.service.js';

@Module({
  imports: [PlatformConfigModule, UsersModule, EmailModule],
  providers: [
    PasswordHasher,
    {
      provide: PASSWORD_CREDENTIALS_REPOSITORY,
      useClass: PrismaPasswordCredentialsRepository,
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useClass: PrismaEmailVerificationRepository,
    },
    OtpService,
    RegistrationService,
  ],
  exports: [
    PasswordHasher,
    PASSWORD_CREDENTIALS_REPOSITORY,
    EMAIL_VERIFICATION_REPOSITORY,
  ],
  controllers: [RegistrationController],
})
export class AuthModule {}
