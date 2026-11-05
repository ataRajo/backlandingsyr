import { IsNotEmpty, IsString } from "class-validator";

export class SeoDTO {
    @IsNotEmpty()
    @IsString()
    description!: string;
}
