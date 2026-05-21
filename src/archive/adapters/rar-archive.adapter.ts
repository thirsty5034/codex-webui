/** RAR archive adapter using unrar-async worker-thread extraction. */
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { archiveEntryName, normalizeArchiveEntryPath } from '../archive-path';
import type { ArchiveAdapter, ArchiveEntry } from '../archive.types';

interface RarFileHeader {
  name: string;
  unpSize?: number;
  flags?: {
    directory?: boolean;
    encrypted?: boolean;
  };
}

interface RarExtractedFile {
  fileHeader: RarFileHeader;
  extraction?: Readable;
}

interface RarExtractResult {
  fileHeaders: RarFileHeader[];
  files: AsyncIterable<RarExtractedFile>;
}

interface RarExtractor {
  extract(options?: {
    files?: string[] | ((fileHeader: RarFileHeader) => boolean);
  }): Promise<RarExtractResult>;
}

interface RarExtractorFactory {
  fromFile(
    archivePath: string,
    options?: { idleTimeoutMs?: number; outputSizeLimitFactor?: number },
  ): Promise<RarExtractor>;
}

interface RarModule {
  RarExtractor?: RarExtractorFactory;
  RARExtractor?: RarExtractorFactory;
}

@Injectable()
export class RarArchiveAdapter implements ArchiveAdapter {
  readonly label = 'rar';

  /** Returns true for RAR archives. */
  supports(archivePath: string): boolean {
    return archivePath.toLowerCase().endsWith('.rar');
  }

  /** Lists RAR file headers without materializing file bodies. */
  async list(archivePath: string): Promise<ArchiveEntry[]> {
    const extractor = await this.createExtractor(archivePath);
    const result = await extractor.extract({ files: () => false });
    return result.fileHeaders.map((header) => this.toEntry(header));
  }

  /** Opens one RAR entry stream by normalized archive path. */
  async openEntryStream(
    archivePath: string,
    entryPath: string,
  ): Promise<Readable> {
    const extractor = await this.createExtractor(archivePath);
    const result = await extractor.extract({
      files: (fileHeader: RarFileHeader) =>
        normalizeArchiveEntryPath(fileHeader.name) === entryPath,
    });
    for await (const file of result.files) {
      const normalized = normalizeArchiveEntryPath(file.fileHeader.name);
      if (normalized !== entryPath) continue;
      if (file.fileHeader.flags?.encrypted) {
        throw new BadRequestException('Encrypted files are not supported');
      }
      if (!file.extraction)
        throw new BadRequestException('RAR entry has no readable stream');
      return file.extraction;
    }
    throw new BadRequestException('RAR entry not found');
  }

  /** Creates an unrar-async extractor with worker idle safeguards. */
  private async createExtractor(archivePath: string): Promise<RarExtractor> {
    const module = (await import('unrar-async')) as RarModule;
    const factory = module.RarExtractor ?? module.RARExtractor;
    if (!factory)
      throw new BadRequestException('unrar-async extractor is unavailable');
    return factory.fromFile(archivePath, {
      idleTimeoutMs: 60_000,
      outputSizeLimitFactor: 2,
    });
  }

  /** Converts a RAR file header to the shared archive entry shape. */
  private toEntry(header: RarFileHeader): ArchiveEntry {
    const normalized = normalizeArchiveEntryPath(header.name);
    if (!normalized) throw new BadRequestException('Unsafe RAR entry path');
    const isDirectory = header.flags?.directory ?? false;
    return {
      name: archiveEntryName(normalized),
      path: normalized,
      type: isDirectory ? 'directory' : 'file',
      size: isDirectory ? undefined : header.unpSize,
      encrypted: header.flags?.encrypted ?? false,
    };
  }
}
