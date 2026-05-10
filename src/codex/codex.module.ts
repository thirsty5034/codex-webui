import { Module } from '@nestjs/common';
import { CodexProcessManager } from './codex-process-manager.service';
import { CodexService } from './codex.service';

@Module({
  providers: [CodexProcessManager, CodexService],
  exports: [CodexProcessManager, CodexService],
})
export class CodexModule {}
