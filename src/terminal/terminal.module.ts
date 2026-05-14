import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { TerminalGateway } from './terminal.gateway';
import { TerminalService } from './terminal.service';

@Module({
  imports: [ConfigModule, FilesModule],
  providers: [TerminalService, TerminalGateway],
  exports: [TerminalService],
})
export class TerminalModule {}
