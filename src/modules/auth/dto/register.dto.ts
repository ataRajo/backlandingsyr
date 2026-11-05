import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty()
    @IsString()
    full_name!: string;

    @IsString()
    company_name?: string;

    @IsString()
    phone_number?: string;

    @IsString()
    address?: string;

    @IsNotEmpty()
    @Type(() => Number)
    work_type_id!: number;

    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password!: string;
}
