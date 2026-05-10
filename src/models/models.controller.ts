/**
 * REST controller for model listing.
 */
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ModelsService } from './models.service';

@ApiTags('models')
@ApiBearerAuth()
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List available models' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listModels(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.modelsService.listModels({
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
