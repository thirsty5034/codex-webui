/** Swagger DTOs for OnlyOffice preview config generation. */
import { ApiProperty } from '@nestjs/swagger';

/** Response containing a signed OnlyOffice editor config and API script URL. */
export class OnlyOfficeConfigResponseDto {
  @ApiProperty()
  scriptUrl!: string;

  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;
}
