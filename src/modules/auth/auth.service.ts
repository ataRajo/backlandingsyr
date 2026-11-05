import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SuperAdminLoginDto } from './dto/superadmin-login.dto';

@Injectable()
export class AuthService {

  private readonly adminRoleNames = ['admin', 'super-admin'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) { }

  async login(loginDto: LoginDto) {
    const customer = await this.prisma.customers.findFirst({ where: { email: loginDto.email } });

    if (customer) {
      const isMatch = await bcrypt.compare(loginDto.password, customer.password!);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: customer.id.toString(), email: customer.email, account_type: 'customer' };
      const safeUser = this.serializeUser(customer);
      const access_token = await this.jwtService.signAsync(payload);
      return {
        user: { ...safeUser, account_type: 'customer' },
        access_token: access_token,
      };
    }

    const adminUser = await this.prisma.users.findFirst({ where: { email: loginDto.email } });

    if (!adminUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, adminUser.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isAdmin = await this.isAdminUser(adminUser.id);
    if (!isAdmin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: adminUser.id.toString(), email: adminUser.email, account_type: 'admin' };
    const safeUser = this.serializeUser(adminUser);
    const access_token = await this.jwtService.signAsync(payload);
    return {
      user: { ...safeUser, account_type: 'admin' },
      access_token: access_token,
    };
  }

  async register(registerDto: RegisterDto) {
    const existingCustomer = await this.prisma.customers.findFirst({ where: { email: registerDto.email } });
    const existingAdmin = await this.prisma.users.findFirst({ where: { email: registerDto.email } });

    if (existingCustomer || existingAdmin) {
      throw new HttpException('Email already in use', 400);
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const newUser = await this.prisma.customers.create({
      data: {
        full_name: registerDto.full_name,
        company_name: registerDto.company_name,
        phone_number: registerDto.phone_number,
        address: registerDto.address,
        work_type_id: registerDto.work_type_id,
        email: registerDto.email,
        password: hashedPassword,
        added_by_manager: false,
        created_at: new Date(),
      },
    });

    return this.serializeUser(newUser);
  }

  async superAdminLogin(superAdminLoginDto: SuperAdminLoginDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          process.env.SUPERADMIN_LOGIN_URL ?? 'https://tsyrback.addresses.sy/api/login',
          {
            username: superAdminLoginDto.username,
            password: superAdminLoginDto.password,
          },
        ),
      );

      const upstreamUser = response.data?.user ?? response.data?.data?.user ?? null;
      const upstreamToken = response.data?.access_token ?? response.data?.token ?? response.data?.data?.access_token ?? response.data?.data?.token ?? null;

      const payload = {
        sub: upstreamUser?.id?.toString?.() ?? superAdminLoginDto.username,
        username: upstreamUser?.username ?? superAdminLoginDto.username,
        email: upstreamUser?.email ?? null,
        account_type: 'superadmin',
        upstream_token: upstreamToken,
      };

      const access_token = await this.jwtService.signAsync(payload);

      return {
        user: {
          ...(upstreamUser ?? {}),
          username: upstreamUser?.username ?? superAdminLoginDto.username,
          account_type: 'superadmin',
        },
        access_token,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid superadmin credentials');
    }
  }

  private async isAdminUser(userId: bigint) {
    const roleAssignments = await this.prisma.model_has_roles.findMany({
      where: {
        model_id: userId,
        model_type: {
          in: [
            'App\\Models\\User',
            'App\\Models\\Admin',
            'users',
            'User',
          ],
        },
        roles: {
          name: {
            in: this.adminRoleNames,
          },
        },
      },
      include: {
        roles: true,
      },
    });

    return roleAssignments.length > 0;
  }

  private serializeUser(user: any) {
    if (!user) return user;
    const out: any = {};
    for (const k of Object.keys(user)) {
      const v = user[k];
      out[k] = typeof v === 'bigint' ? v.toString() : v;
    }
    delete out.password;
    delete out.fcm_token;
    return out;
  }
}
