import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2FADto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class Verify2FADto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

