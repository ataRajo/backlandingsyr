import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsDate, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";


class RoadSignDTO {
    @IsInt()
    @IsNotEmpty()
    road_sign_id!: number

    @IsInt()
    @IsNotEmpty()
    booking_faces!: number

    @IsInt()
    @IsNotEmpty()
    number_of_reserved_panels!: number

    @Type(() => Date)
    @IsNotEmpty()
    start_date!: Date

    @Type(() => Date)
    @IsNotEmpty()
    end_date!: Date
}

export class CreateBookingDto {
    @Type(() => Date)
    @IsNotEmpty()
    start_date?: Date;

    @Type(() => Date)
    @IsNotEmpty()
    @IsDate()
    end_date?: Date;

    @IsString()
    @IsOptional()
    notes?: string

    @IsInt()
    @IsNotEmpty()
    product_type!: number

    @IsInt()
    @IsNotEmpty()
    printing_id!: number

    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => RoadSignDTO)
    roadsigns!: RoadSignDTO[];


}