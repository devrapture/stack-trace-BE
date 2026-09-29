import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './register.dto.js';
import { RegistrationService } from './registration.service.js';

@Controller('auth')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}
  @Post('register')
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  async register(@Body() dto: RegisterDto) {
    return this.registrationService.register(dto);
  }
}
