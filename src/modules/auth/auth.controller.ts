import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto'; import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/superadmin-login.dto';
;

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('superadmin/login')
  superAdminLogin(@Body() superAdminLoginDto: SuperAdminLoginDto) {
    return this.authService.superAdminLogin(superAdminLoginDto);
  }
}
