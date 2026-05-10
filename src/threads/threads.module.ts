import { Module } from '@nestjs/common';
import { CodexModule } from '../codex/codex.module';
import { ThreadsController } from './threads.controller';
import { ThreadsGateway } from './threads.gateway';
import { ThreadsService } from './threads.service';

@Module({
  imports: [CodexModule],
  controllers: [ThreadsController],
  providers: [ThreadsService, ThreadsGateway],
  exports: [ThreadsService],
})
export class ThreadsModule {}
