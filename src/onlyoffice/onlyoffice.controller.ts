/** Generates read-only OnlyOffice Docs config for workspace file previews. */
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { ApiErrorResponseDto } from '../common/dto/api-responses.dto';
import { FilesService } from '../files/files.service';
import { GENERAL_SETTING_KEYS } from '../settings/settings.definitions';
import { SettingsService } from '../settings/settings.service';
import { OnlyOfficeConfigResponseDto } from './dto/onlyoffice.dto';

type OnlyOfficeDocumentType = 'word' | 'cell' | 'slide';

interface OnlyOfficeDocumentConfig {
  fileType: string;
  key: string;
  permissions: {
    comment: boolean;
    copy: boolean;
    download: boolean;
    edit: boolean;
    print: boolean;
    review: boolean;
  };
  title: string;
  url: string;
}

interface OnlyOfficeEditorConfig {
  document: OnlyOfficeDocumentConfig;
  documentType: OnlyOfficeDocumentType;
  editorConfig: {
    mode: 'view';
    customization: {
      compactToolbar: boolean;
      hideRightMenu: boolean;
    };
  };
  height: string;
  token?: string;
  type: 'embedded';
  width: string;
}

@ApiTags('onlyoffice')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiBadRequestResponse({ type: ApiErrorResponseDto })
@Controller('onlyoffice')
export class OnlyOfficeController {
  constructor(
    private readonly filesService: FilesService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Builds a read-only OnlyOffice editor config for a workspace document. */
  @Get('config')
  @ApiOperation({ summary: 'Build OnlyOffice viewer config for a file' })
  @ApiQuery({ name: 'path', required: true })
  @ApiOkResponse({ type: OnlyOfficeConfigResponseDto })
  async getConfig(
    @Query('path') filePath: string,
    @Req() request: FastifyRequest,
  ): Promise<OnlyOfficeConfigResponseDto> {
    const onlyofficeUrl = this.settingsService.getStringSetting(
      GENERAL_SETTING_KEYS.onlyofficeUrl,
    );
    if (!onlyofficeUrl) {
      throw new BadRequestException('OnlyOffice is not configured');
    }
    const normalizedOnlyOfficeUrl = this.normalizeHttpBaseUrl(
      onlyofficeUrl,
      'general.onlyofficeUrl',
    );

    const metadata = await this.filesService.getMetadata(filePath);
    if (metadata.type !== 'file') {
      throw new BadRequestException('OnlyOffice preview requires a file');
    }

    const fileType = this.getSupportedFileType(metadata.name);
    const documentType = this.getDocumentType(fileType);
    const documentUrl = this.buildDocumentUrl(request, metadata.path);
    const config: OnlyOfficeEditorConfig = {
      type: 'embedded',
      width: '100%',
      height: '100%',
      documentType,
      document: {
        fileType,
        key: this.buildDocumentKey(
          metadata.path,
          metadata.mtime,
          metadata.size,
        ),
        title: metadata.name,
        url: documentUrl,
        permissions: {
          comment: false,
          copy: true,
          download: true,
          edit: false,
          print: true,
          review: false,
        },
      },
      editorConfig: {
        mode: 'view',
        customization: {
          compactToolbar: true,
          hideRightMenu: true,
        },
      },
    };

    const secret = this.settingsService.getStringSetting(
      GENERAL_SETTING_KEYS.onlyofficeJwtSecret,
    );
    if (secret) {
      config.token = sign(config, secret, { algorithm: 'HS256' });
    }

    return {
      scriptUrl: this.joinUrl(
        normalizedOnlyOfficeUrl,
        '/web-apps/apps/api/documents/api.js',
      ),
      config: config as unknown as Record<string, unknown>,
    };
  }

  /** Validates supported Office extensions and returns the lowercase file type. */
  private getSupportedFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return ext;
    throw new BadRequestException(
      'OnlyOffice supports DOCX, XLSX, and PPTX previews',
    );
  }

  /** Maps a supported extension to OnlyOffice's documentType field. */
  private getDocumentType(fileType: string): OnlyOfficeDocumentType {
    if (fileType === 'docx') return 'word';
    if (fileType === 'xlsx') return 'cell';
    return 'slide';
  }

  /** Builds a stable cache key within OnlyOffice's 128-character limit. */
  private buildDocumentKey(
    filePath: string,
    mtime: number,
    size: number,
  ): string {
    return createHash('sha256')
      .update(`${filePath}:${mtime}:${size}`)
      .digest('hex')
      .slice(0, 48);
  }

  /** Builds an absolute file-serving URL reachable by the OnlyOffice Document Server. */
  private buildDocumentUrl(request: FastifyRequest, filePath: string): string {
    // Prefer explicit publicBaseUrl setting over request header inference
    const publicBaseUrl = this.settingsService.getStringSetting(
      GENERAL_SETTING_KEYS.publicBaseUrl,
    );
    let baseUrl: string;
    if (publicBaseUrl) {
      baseUrl = this.normalizeHttpBaseUrl(
        publicBaseUrl,
        'general.publicBaseUrl',
      );
    } else {
      const proto =
        this.firstHeaderValue(request.headers['x-forwarded-proto']) ?? 'http';
      const host =
        this.firstHeaderValue(request.headers['x-forwarded-host']) ??
        this.firstHeaderValue(request.headers.host);
      if (!host) {
        throw new BadRequestException(
          'Cannot determine public host for OnlyOffice document URL. Configure general.publicBaseUrl in Settings.',
        );
      }
      baseUrl = this.normalizeHttpBaseUrl(
        `${proto}://${host}`,
        'request host headers',
      );
    }

    const params = new URLSearchParams({ path: filePath });
    const token = this.extractBearerToken(request.headers.authorization);
    if (token) params.set('access_token', token);
    return this.joinUrl(baseUrl, `/api/files/serve?${params.toString()}`);
  }

  /** Extracts the first comma-delimited proxy header value (handles X-Forwarded-* multi-value). */
  private firstHeaderValue(
    value: string | string[] | undefined,
  ): string | null {
    const raw = this.singleHeader(value);
    return raw?.split(',')[0]?.trim() || null;
  }

  /** Extracts a scalar header value from Fastify's string-or-array header shape. */
  private singleHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  /** Normalizes configured/inferred URLs and rejects non-http(s) schemes. */
  private normalizeHttpBaseUrl(rawUrl: string, label: string): string {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/+$/, '');
    } catch {
      throw new BadRequestException(`${label} must be a valid http(s) URL`);
    }
  }

  /** Extracts a bearer token so OnlyOffice can fetch the protected document URL. */
  private extractBearerToken(authorization: string | undefined): string | null {
    const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
    return match?.[1] ?? null;
  }

  /** Joins a configured OnlyOffice base URL and API path without double slashes. */
  private joinUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
