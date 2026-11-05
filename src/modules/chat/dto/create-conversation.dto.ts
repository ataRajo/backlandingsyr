import { IsOptional, Matches } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @Matches(/^[0-9]+$/, { message: 'customer_id must be a numeric string' })
  customer_id?: string;
}