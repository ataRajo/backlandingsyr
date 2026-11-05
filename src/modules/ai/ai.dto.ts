import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiChatDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    message!: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    session_id?: string;
}
