import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    full_name!: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    company_name?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    phone_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    address?: string;

    // 0 = pending, 1 = active, 2 = inactive
    @IsIn(['0', '1', '2'])
    @IsOptional()
    status?: string;

    // Relative path returned by POST /api/uploads/image?folder=customers
    @IsString()
    @IsOptional()
    @MaxLength(255)
    license_image?: string;
}

export class UpdateCustomerDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    @IsOptional()
    full_name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    company_name?: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    phone_number?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    address?: string;

    @IsIn(['0', '1', '2'])
    @IsOptional()
    status?: string;

    // Empty string removes the uploaded license
    @IsString()
    @IsOptional()
    @MaxLength(255)
    license_image?: string;
}
