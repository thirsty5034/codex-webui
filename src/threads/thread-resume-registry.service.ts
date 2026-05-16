/** Generation-scoped resume registry for non-idempotent thread/resume calls. */
import { Injectable, Logger } from '@nestjs/common';
import { CodexProcessManager } from '../codex/codex-process-manager.service';
import { CodexService } from '../codex/codex.service';
import type { v2 } from '../codex/codex-schema';

/** Prevents duplicate app-server resume calls for the same thread generation. */
@Injectable()
export class ThreadResumeRegistryService {
  private readonly logger = new Logger(ThreadResumeRegistryService.name);
  private readonly inFlight = new Map<
    string,
    Promise<v2.ThreadResumeResponse>
  >();
  private readonly resumed = new Set<string>();
  private readonly failed = new Map<string, string>();
  /** Monotonic epoch per key — stale in-flight promises check before marking resumed. */
  private readonly epoch = new Map<string, number>();

  constructor(
    private readonly codex: CodexService,
    private readonly codexManager: CodexProcessManager,
  ) {
    this.codexManager.addLifecycleListener((event) => {
      if (event.type === 'appServerReady') {
        this.pruneGenerations(event.generation);
      }
    });
  }

  /** Ensures a thread is resumed exactly once for the current app-server generation. */
  ensureResumed(threadId: string): Promise<v2.ThreadResumeResponse> {
    const key = this.key(threadId);
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    if (this.resumed.has(key)) {
      return this.readAsResume(threadId);
    }

    const callEpoch = this.bumpEpoch(key);
    const promise = this.codex
      .request<v2.ThreadResumeResponse>('thread/resume', {
        threadId,
        persistExtendedHistory: true,
      })
      .then((response) => {
        if (this.epoch.get(key) === callEpoch) {
          this.markResumed(threadId);
        }
        return response;
      })
      .catch((err: Error) => {
        if (this.epoch.get(key) === callEpoch) {
          this.failed.set(key, err.message);
        }
        throw err;
      })
      .finally(() => {
        if (this.epoch.get(key) === callEpoch) {
          this.inFlight.delete(key);
        }
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /** Marks a thread as already active in the current app-server generation. */
  markResumed(threadId: string): void {
    const key = this.key(threadId);
    this.resumed.add(key);
    this.failed.delete(key);
  }

  /** Returns true when the thread has already been resumed in this generation. */
  isResumed(threadId: string): boolean {
    return this.resumed.has(this.key(threadId));
  }

  /** Removes a thread from all registry state; bumps epoch so in-flight promises become no-ops. */
  forget(threadId: string): void {
    const key = this.key(threadId);
    this.resumed.delete(key);
    this.failed.delete(key);
    this.inFlight.delete(key);
    this.bumpEpoch(key);
  }

  /**
   * Falls back to thread/read when the thread was already resumed this generation.
   * Callers only rely on `thread` and `cwd`; other resume-specific fields are absent.
   */
  private async readAsResume(
    threadId: string,
  ): Promise<v2.ThreadResumeResponse> {
    const response = await this.codex.request<v2.ThreadReadResponse>(
      'thread/read',
      {
        threadId,
        includeTurns: true,
      },
    );
    return {
      thread: response.thread,
      cwd: response.thread.cwd,
    } as unknown as v2.ThreadResumeResponse;
  }

  private key(threadId: string): string {
    return `${this.codexManager.getGeneration()}:${threadId}`;
  }

  private bumpEpoch(key: string): number {
    const next = (this.epoch.get(key) ?? 0) + 1;
    this.epoch.set(key, next);
    return next;
  }

  private pruneGenerations(currentGeneration: number): void {
    const prefix = `${currentGeneration}:`;
    for (const key of this.resumed) {
      if (!key.startsWith(prefix)) this.resumed.delete(key);
    }
    for (const key of this.failed.keys()) {
      if (!key.startsWith(prefix)) this.failed.delete(key);
    }
    for (const key of this.inFlight.keys()) {
      if (!key.startsWith(prefix)) this.inFlight.delete(key);
    }
    for (const key of this.epoch.keys()) {
      if (!key.startsWith(prefix)) this.epoch.delete(key);
    }
    this.logger.debug(
      `Resume registry ready for generation=${currentGeneration}`,
    );
  }
}
