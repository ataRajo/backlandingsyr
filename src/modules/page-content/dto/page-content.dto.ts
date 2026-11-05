import { IsBoolean, IsDefined, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const CONTENT_LOCALES = ['ar', 'en', 'tr'] as const;

// Reserved for images / structured lists (billboards, pricing, slides…).
// Only reachable through the superadmin /media endpoints.
export const MEDIA_SECTION = 'media';
export const MEDIA_LOCALE = 'global';

export class CreatePageContentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Matches(/^[A-Za-z0-9_-]+$/, { message: 'section may contain letters, numbers, _ and - only' })
    section: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    @Matches(/^[A-Za-z0-9_.-]+$/, { message: 'key may contain letters, numbers, ., _ and - only' })
    key: string;

    @IsString()
    @MaxLength(20000)
    value: string;

    @IsOptional()
    @IsIn(CONTENT_LOCALES as unknown as string[])
    locale?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdatePageContentDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Matches(/^[A-Za-z0-9_-]+$/, { message: 'section may contain letters, numbers, _ and - only' })
    section?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    @Matches(/^[A-Za-z0-9_.-]+$/, { message: 'key may contain letters, numbers, ., _ and - only' })
    key?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20000)
    value?: string;

    @IsOptional()
    @IsIn(CONTENT_LOCALES as unknown as string[])
    locale?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class SetMediaDto {
    /** Any JSON: an image URL string, an object or an array of items. */
    @IsDefined()
    value: any;
}
