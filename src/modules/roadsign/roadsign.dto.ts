import { Transform, Type } from "class-transformer";
import dayjs from 'dayjs';
import { IsDate, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class RoadsignDto {
    @Type(() => Date)
    @IsOptional()
    @IsDate()
    start_date?: Date;

    @Type(() => Date)
    @IsOptional()
    @IsDate()
    end_date?: Date;

    @Type(() => Number)
    @IsNumber()
    @IsNotEmpty()
    city_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    region_id?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    template_id?: number;
}
