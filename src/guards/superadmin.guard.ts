import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class SuperAdminGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request & { user?: any }>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('Token not found in authorization header');
        }

        try {
            // إذا فشل هذا السطر، ينتقل الكود فوراً إلى catch
            const payload = await this.jwtService.verifyAsync(token);
            console.log('Decoded payload:', payload);

            if (payload?.account_type !== 'superadmin') {
                throw new UnauthorizedException('Access denied: User is not superadmin');
            }

            request['user'] = payload;
            return true;
        } catch (error) {
            // سيطبع لك السبب الدقيق للفشل في Terminal
            console.error('JWT Verification Error:', error.message);
            throw new UnauthorizedException();
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}