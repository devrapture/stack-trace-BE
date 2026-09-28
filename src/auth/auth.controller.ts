import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { RegistrationService } from './registration.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly registrationService: RegistrationService) {}
  @Post('register')
  @HttpCode(202)
  async register(@Body() dto: RegisterDto) {
    return this.registrationService.register(dto);
  }
}
