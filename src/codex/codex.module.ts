import { Module } from '@nestjs/common';
import { CodexProcessManager } from './codex-process-manager.service';

@Module({
  providers: [CodexProcessManager],
  exports: [CodexProcessManager],
})
export class CodexModule {}
