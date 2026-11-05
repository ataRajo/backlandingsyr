import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SocketSendMessageDto {
  @IsOptional()
  @Matches(/^[0-9]+$/, { message: 'conversationId must be a numeric string' })
  conversationId?: string;

  @IsOptional()
  @Matches(/^[0-9]+$/, { message: 'customer_id must be a numeric string' })
  customer_id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}